import logging
import time
import uuid
from decimal import Decimal
from typing import Optional, Tuple

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from menu.models import MenuItem, MenuItemCustomizationGroup, MenuItemCustomizationOption
from menu.pricing import active_offer_queryset, quote_order_lines
from restaurants.models import PaymentConfig

from .customer_utils import assert_customer_can_access_order, resolve_customer_table_and_session
from .khalti import initiate_khalti_payment, verify_khalti_payment
from .live import publish_order_event
from .models import (
    Order,
    OrderAppliedOffer,
    OrderItem,
    OrderItemCustomizationSelection,
    OrderReview,
)
from .serializers import (
    CustomerOrderCreateSerializer,
    CustomerOrderQuoteSerializer,
    OrderReviewSerializer,
    CustomerOrderReviewCreateSerializer,
    CustomerOrderSummarySerializer,
    OrderSerializer,
)

# Khalti doesn't need polling but we might retry lookup if it fails.
KHALTI_VERIFY_MAX_ATTEMPTS = 3

ORDER_STATUS_VALUES = {
    Order.STATUS_PENDING,
    Order.STATUS_PREPARING,
    Order.STATUS_READY,
    Order.STATUS_SERVED,
}
ORDER_STATUS_TRANSITIONS = {
    Order.STATUS_PENDING: {Order.STATUS_PREPARING},
    Order.STATUS_PREPARING: {Order.STATUS_READY},
    Order.STATUS_READY: {Order.STATUS_SERVED},
    Order.STATUS_SERVED: set(),
}
BILLING_STATUS_VALUES = {
    Order.BILLING_ST_UNBILLED,
    Order.BILLING_ST_BILLED,
    Order.BILLING_ST_PENDING_PAYMENT,
    Order.BILLING_ST_PAID,
    Order.BILLING_ST_FAILED,
    Order.BILLING_ST_REFUNDED,
}
BILLING_STATUS_TRANSITIONS = {
    Order.BILLING_ST_UNBILLED: {Order.BILLING_ST_BILLED, Order.BILLING_ST_PENDING_PAYMENT},
    Order.BILLING_ST_BILLED: {
        Order.BILLING_ST_PENDING_PAYMENT,
        Order.BILLING_ST_PAID,
    },
    Order.BILLING_ST_PENDING_PAYMENT: {
        Order.BILLING_ST_PAID,
        Order.BILLING_ST_FAILED,
    },
    Order.BILLING_ST_FAILED: {
        Order.BILLING_ST_PENDING_PAYMENT,
    },
    Order.BILLING_ST_PAID: {Order.BILLING_ST_REFUNDED},
    Order.BILLING_ST_REFUNDED: set(),
}

logger = logging.getLogger(__name__)


def _customer_menu_item_queryset(restaurant_id: int, menu_ids):
    return (
        MenuItem.objects.filter(id__in=menu_ids, restaurant_id=restaurant_id, is_available=True)
        .select_related("category", "restaurant")
        .prefetch_related(
            Prefetch(
                "customization_groups",
                queryset=MenuItemCustomizationGroup.objects.order_by("sort_order", "id").prefetch_related(
                    Prefetch(
                        "options",
                        queryset=MenuItemCustomizationOption.objects.order_by("sort_order", "id"),
                    )
                ),
            )
        )
    )


def _order_prefetch():
    return [
        "applied_offers",
        "review",
        Prefetch(
            "items",
            queryset=OrderItem.objects.select_related("menu_item").prefetch_related("selected_options"),
        ),
    ]


def _quote_customer_order(*, restaurant, items_in):
    menu_ids = [row["menu_item"] for row in items_in]
    menu_items = list(_customer_menu_item_queryset(restaurant.id, menu_ids))
    by_id = {menu_item.id: menu_item for menu_item in menu_items}
    if len(by_id) != len(set(menu_ids)):
        raise PermissionDenied("One or more items are missing, unavailable, or not from this restaurant.")
    offers = list(active_offer_queryset(restaurant.id))
    return quote_order_lines(
        restaurant_id=restaurant.id,
        menu_items_by_id=by_id,
        items_in=items_in,
        offers=offers,
    )


def _serialize_quote(quote):
    return {
        "subtotal_price": str(quote["subtotal_price"]),
        "discount_total": str(quote["discount_total"]),
        "total_price": str(quote["total_price"]),
        "items": [
            {
                "menu_item": line["menu_item"].id,
                "item_name": line["menu_item"].name,
                "quantity": line["quantity"],
                "base_price": str(line["base_unit_price"]),
                "price": str(line["unit_price"]),
                "line_total": str(line["line_total"]),
                "selected_options": [
                    {
                        "group_name": option["group_name"],
                        "option_name": option["option_name"],
                        "price_delta": str(option["price_delta"]),
                    }
                    for option in line["selected_options"]
                ],
            }
            for line in quote["lines"]
        ],
        "applied_offers": [
            {
                "name": offer["name"],
                "badge_text": offer["badge_text"],
                "offer_type": offer["offer_type"],
                "discount_amount": str(offer["discount_amount"]),
            }
            for offer in quote["applied_offers"]
        ],
    }


def _notify_order_change(order: Order, *, event_type: str = "updated") -> None:
    try:
        publish_order_event(order, event_type=event_type)
    except Exception:
        logger.exception("Failed to publish live order event for order_id=%s", order.pk)


def _legacy_payment_status_for_billing(billing_status: str) -> str:
    if billing_status == Order.BILLING_ST_PAID:
        return Order.PAYMENT_ST_PAID
    if billing_status in {Order.BILLING_ST_FAILED, Order.BILLING_ST_REFUNDED}:
        return Order.PAYMENT_ST_FAILED
    return Order.PAYMENT_ST_PENDING


def _apply_billing_state(order: Order, billing_status: str, *, payment_method=None) -> None:
    now = timezone.now()
    order.billing_status = billing_status
    order.payment_status = _legacy_payment_status_for_billing(billing_status)
    if payment_method is not None:
        order.payment_method = payment_method

    if billing_status == Order.BILLING_ST_BILLED and order.billed_at is None:
        order.billed_at = now
    if billing_status == Order.BILLING_ST_PENDING_PAYMENT and order.billed_at is None:
        order.billed_at = now
    if billing_status == Order.BILLING_ST_PAID:
        if order.billed_at is None:
            order.billed_at = now
        order.paid_at = now
        order.refunded_at = None
    elif billing_status == Order.BILLING_ST_REFUNDED:
        if order.paid_at is None:
            order.paid_at = now
        order.refunded_at = now
    else:
        if billing_status != Order.BILLING_ST_REFUNDED:
            order.refunded_at = None
        if billing_status != Order.BILLING_ST_PAID:
            order.paid_at = None


def _validate_billing_transition(order: Order, next_status: str) -> Optional[str]:
    if next_status not in BILLING_STATUS_VALUES:
        return f"Invalid billing status. Allowed: {sorted(BILLING_STATUS_VALUES)}"
    current = order.billing_status or Order.BILLING_ST_UNBILLED
    if next_status == current:
        return None
    allowed = BILLING_STATUS_TRANSITIONS.get(current, set())
    if next_status not in allowed:
        return f"Cannot move billing status from {current} to {next_status}."
    return None


def _validate_service_transition(order: Order, next_status: str, role: Optional[str]) -> Optional[str]:
    current = order.status
    if next_status not in ORDER_STATUS_VALUES:
        return f"Invalid status. Allowed: {sorted(ORDER_STATUS_VALUES)}"
    if next_status == current:
        return None

    if role == "cashier":
        return "Cashiers cannot change kitchen or service status."

    allowed = ORDER_STATUS_TRANSITIONS.get(current, set())
    if next_status not in allowed:
        return f"Cannot move order status from {current} to {next_status}."

    if current == Order.STATUS_PENDING and next_status == Order.STATUS_PREPARING and not order.confirmed_for_kitchen_at:
        return "Use Send to kitchen to release this order before changing status."

    if role == "kitchen":
        if not order.confirmed_for_kitchen_at:
            return "This order has not been released to the kitchen yet."
        if not (current == Order.STATUS_PREPARING and next_status == Order.STATUS_READY):
            return "Kitchen can only mark orders as ready after they are preparing."
        return None

    if role == "waiter":
        if not (current == Order.STATUS_READY and next_status == Order.STATUS_SERVED):
            return "Waiters can only mark ready orders as served."
        return None

    if role == "restaurant_admin":
        return None

    return "You do not have permission to change order status."


def _resolve_restaurant_order_for_user(request, order_id: int) -> Tuple[Optional[Order], Optional[Response]]:
    if not request.user.restaurant_id:
        return None, Response({"error": "No restaurant assigned to user"}, status=400)
    try:
        order = Order.objects.select_related("restaurant", "table").get(
            id=order_id, restaurant_id=request.user.restaurant_id
        )
        return order, None
    except Order.DoesNotExist:
        return None, Response({"error": "Order not found"}, status=404)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def orders_collection(request):
    if request.method == "GET":
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        if not getattr(request.user, "restaurant_id", None):
            return Response({"error": "No restaurant assigned to user"}, status=400)

        qs = (
            Order.objects.filter(restaurant_id=request.user.restaurant_id)
            .select_related("table")
            .prefetch_related(*_order_prefetch())
            .order_by("-created_at")
        )
        role = getattr(request.user, "role", None)
        if role == "kitchen":
            qs = qs.filter(confirmed_for_kitchen_at__isnull=False)
        st = (request.query_params.get("status") or "").strip()
        if st:
            qs = qs.filter(status=st)
        billing_st = (request.query_params.get("billing_status") or "").strip()
        if billing_st:
            qs = qs.filter(billing_status=billing_st)
        return Response(OrderSerializer(qs, many=True).data)

    # POST — customer (no login); totals and discounts come only from server-side validation.
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err

    ser = CustomerOrderCreateSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    data = ser.validated_data
    restaurant = table.restaurant
    items_in = data["items"]

    if not items_in:
        return Response({"error": "At least one item is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        quote = _quote_customer_order(restaurant=restaurant, items_in=items_in)
    except PermissionDenied as exc:
        return Response({"error": str(exc.detail)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        if hasattr(exc, "detail"):
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        logger.exception("Order quote failed")
        return Response({"error": "Could not validate this order."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            order = Order.objects.create(
                restaurant=restaurant,
                table=table,
                session_id=session_id,
                customer_name=data["customer_name"],
                subtotal_price=quote["subtotal_price"],
                discount_total=quote["discount_total"],
                total_price=quote["total_price"],
                billing_status=Order.BILLING_ST_UNBILLED,
                payment_status=Order.PAYMENT_ST_PENDING,
                status=Order.STATUS_PENDING,
            )
            for line in quote["lines"]:
                order_item = OrderItem.objects.create(
                    order=order,
                    menu_item=line["menu_item"],
                    quantity=line["quantity"],
                    base_unit_price=line["base_unit_price"],
                    unit_price=line["unit_price"],
                )
                for option in line["selected_options"]:
                    OrderItemCustomizationSelection.objects.create(
                        order_item=order_item,
                        customization_option=option["customization_option"],
                        group_name=option["group_name"],
                        option_name=option["option_name"],
                        price_delta=option["price_delta"],
                    )
            for offer in quote["applied_offers"]:
                offer_obj = offer.get("offer")
                OrderAppliedOffer.objects.create(
                    order=order,
                    offer=offer_obj if hasattr(offer_obj, "pk") else offer_obj.get("offer") if isinstance(offer_obj, dict) else None,
                    name=offer["name"],
                    badge_text=offer["badge_text"],
                    offer_type=offer["offer_type"],
                    discount_amount=offer["discount_amount"],
                )
    except IntegrityError as exc:
        logger.warning("Order create IntegrityError: %s", exc, exc_info=True)
        return Response(
            {"error": "Could not save your order. Please try again or ask the restaurant team for help."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception:
        logger.exception("Order creation failed")
        return Response(
            {"error": "An unexpected error occurred. Please try again later."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    _notify_order_change(order, event_type="created")
    order = Order.objects.select_related("table").prefetch_related(*_order_prefetch()).get(pk=order.pk)

    return Response(
        CustomerOrderSummarySerializer(order).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def orders_my(request):
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err
    qs = (
        Order.objects.filter(table_id=table.id, session_id=session_id)
        .select_related("table")
        .prefetch_related(*_order_prefetch())
        .order_by("-created_at")
    )
    return Response(CustomerOrderSummarySerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def order_quote(request):
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err

    ser = CustomerOrderQuoteSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    items_in = ser.validated_data["items"]
    if not items_in:
        return Response({"error": "At least one item is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        quote = _quote_customer_order(restaurant=table.restaurant, items_in=items_in)
    except PermissionDenied as exc:
        return Response({"error": str(exc.detail)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        if hasattr(exc, "detail"):
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        logger.exception("Order quote failed")
        return Response({"error": "Could not validate this order."}, status=status.HTTP_400_BAD_REQUEST)

    return Response(_serialize_quote(quote))


@api_view(["POST"])
@permission_classes([AllowAny])
def create_order_review(request, order_id):
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err

    try:
        order = Order.objects.select_related("restaurant", "table").get(id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        assert_customer_can_access_order(order, table, session_id)
    except PermissionDenied as exc:
        return Response({"error": str(exc.detail)}, status=status.HTTP_403_FORBIDDEN)

    if order.status != Order.STATUS_SERVED:
        return Response(
            {"error": "You can review an order only after it has been served."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    existing_review = OrderReview.objects.filter(order=order).first()
    if existing_review:
        return Response(
            {"error": "A review has already been submitted for this order."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = CustomerOrderReviewCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    review = None
    try:
        with transaction.atomic():
            review = OrderReview.objects.create(
                order=order,
                restaurant=order.restaurant,
                session_id=session_id,
                customer_name=order.customer_name,
                **serializer.validated_data,
            )
    except IntegrityError:
        existing_review = OrderReview.objects.filter(order=order).first()
        if existing_review:
            return Response(
                {"error": "A review has already been submitted for this order."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        logger.exception("Review creation hit an IntegrityError for order_id=%s", order_id)
        return Response(
            {"error": "Could not submit your review right now. Please try again."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception:
        logger.exception("Review creation failed for order_id=%s", order_id)
        return Response(
            {"error": "Could not submit your review right now. Please try again."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        order = Order.objects.select_related("table").prefetch_related(*_order_prefetch()).get(pk=order.pk)
        _notify_order_change(order)
        return Response(CustomerOrderSummarySerializer(order).data, status=status.HTTP_201_CREATED)
    except Exception:
        logger.exception("Review submit succeeded but order refresh failed for order_id=%s", order_id)
        return Response(
            {
                "id": order.id,
                "review": OrderReviewSerializer(review).data if review else None,
            },
            status=status.HTTP_201_CREATED,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_order_for_kitchen(request, order_id):
    """Waiter or restaurant admin: release order to kitchen."""
    role = getattr(request.user, "role", None)
    if role not in ("waiter", "restaurant_admin"):
        return Response(
            {"error": "Only waiters or restaurant admins can confirm orders for the kitchen."},
            status=403,
        )
    order, err = _resolve_restaurant_order_for_user(request, order_id)
    if err:
        return err

    if order.confirmed_for_kitchen_at:
        return Response(OrderSerializer(order).data)

    order.confirmed_for_kitchen_at = timezone.now()
    order.status = Order.STATUS_PREPARING
    order.save(update_fields=["confirmed_for_kitchen_at", "status"])
    logger.info("Order %s confirmed for kitchen by user=%s", order.pk, request.user.pk)
    _notify_order_change(order)
    return Response(OrderSerializer(order).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_order_status(request, order_id):
    order, err = _resolve_restaurant_order_for_user(request, order_id)
    if err:
        return err

    status_value = request.data.get("status")
    role = getattr(request.user, "role", None)
    transition_error = _validate_service_transition(order, status_value, role)
    if transition_error:
        forbidden_roles = {"cashier", None}
        return Response(
            {"error": transition_error},
            status=status.HTTP_403_FORBIDDEN if role in forbidden_roles else 400,
        )

    order.status = status_value
    order.save(update_fields=["status"])
    _notify_order_change(order)
    return Response(OrderSerializer(order).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_order_billing(request, order_id):
    role = getattr(request.user, "role", None)
    if role not in ("cashier", "restaurant_admin"):
        return Response(
            {"error": "Only cashiers or restaurant admins can update billing status."},
            status=status.HTTP_403_FORBIDDEN,
        )

    order, err = _resolve_restaurant_order_for_user(request, order_id)
    if err:
        return err

    next_status = (request.data.get("billing_status") or "").strip()
    payment_method = request.data.get("payment_method")
    if payment_method is not None:
        payment_method = (str(payment_method).strip() or None)
        if payment_method not in {None, Order.PAYMENT_CASH, Order.PAYMENT_KHALTI}:
            return Response(
                {"error": f"Invalid payment method. Allowed: {[Order.PAYMENT_CASH, Order.PAYMENT_KHALTI]}"},
                status=400,
            )

    transition_error = _validate_billing_transition(order, next_status)
    if transition_error:
        return Response({"error": transition_error}, status=400)

    if next_status in {
        Order.BILLING_ST_PENDING_PAYMENT,
        Order.BILLING_ST_PAID,
    } and not (payment_method or order.payment_method):
        return Response(
            {"error": "payment_method is required when moving an order into payment collection."},
            status=400,
        )

    _apply_billing_state(order, next_status, payment_method=payment_method)
    order.save(
        update_fields=[
            "billing_status",
            "payment_status",
            "payment_method",
            "billed_at",
            "paid_at",
            "refunded_at",
        ]
    )
    _notify_order_change(order)
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def pay_cash(request, order_id):
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err
    try:
        order = Order.objects.select_related("restaurant", "table").get(id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    assert_customer_can_access_order(order, table, session_id)
    if order.restaurant_id != table.restaurant_id:
        return Response({"error": "Invalid order"}, status=400)

    _apply_billing_state(
        order,
        Order.BILLING_ST_PENDING_PAYMENT,
        payment_method=Order.PAYMENT_CASH,
    )
    order.save(
        update_fields=[
            "payment_method",
            "payment_status",
            "billing_status",
            "billed_at",
            "paid_at",
            "refunded_at",
        ]
    )
    _notify_order_change(order)
    return Response(CustomerOrderSummarySerializer(order).data)


def _get_restaurant_khalti_key(restaurant) -> str:
    from restaurants.models import PaymentConfig
    config = PaymentConfig.objects.filter(restaurant=restaurant).first()
    if not config or not config.secret_key:
        raise ValueError(f"Khalti is not configured for {restaurant.name}. Please set up keys in settings.")
    return config.secret_key.strip()


@api_view(["POST"])
@permission_classes([AllowAny])
def pay_khalti(request, order_id):
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err
    try:
        order = Order.objects.select_related("restaurant", "table").get(id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    assert_customer_can_access_order(order, table, session_id)

    if order.billing_status == Order.BILLING_ST_PAID:
        return Response({"error": "Order is already paid"}, status=400)

    base = (getattr(settings, "FRONTEND_URL", None) or "").rstrip("/")
    if not base:
        return Response({"error": "FRONTEND_URL is not configured on the server"}, status=500)

    return_url = f"{base}/payment/khalti/success"
    
    try:
        # Fetch restaurant's specific Khalti key
        secret_key = _get_restaurant_khalti_key(order.restaurant)

        # Initiate payment with Khalti
        res_data = initiate_khalti_payment(
            order_id=order.pk,
            amount_npr=order.total_price,
            purchase_order_name=f"Order #{order.pk}",
            return_url=return_url,
            secret_key=secret_key
        )
        
        pidx = res_data.get("pidx")
        payment_url = res_data.get("payment_url")
        
        if not pidx or not payment_url:
            return Response({"error": "Failed to get payment details from Khalti"}, status=502)
            
        order.khalti_pidx = pidx
        _apply_billing_state(
            order,
            Order.BILLING_ST_PENDING_PAYMENT,
            payment_method=Order.PAYMENT_KHALTI,
        )
        order.save(update_fields=["khalti_pidx", "payment_method", "payment_status", "billing_status", "billed_at"])
        
        _notify_order_change(order)
        
        return Response({
            "payment_url": payment_url,
            "pidx": pidx,
            "order_id": order.pk
        })
        
    except Exception as e:
        logger.exception("Khalti pay failed")
        return Response({"error": str(e)}, status=400)


def _run_khalti_verification(order: Order, pidx: str) -> Response:
    try:
        secret_key = _get_restaurant_khalti_key(order.restaurant)
        res_data = verify_khalti_payment(pidx, secret_key=secret_key)
        status_text = res_data.get("status")
        
        if status_text == "Completed":
            _apply_billing_state(order, Order.BILLING_ST_PAID, payment_method=Order.PAYMENT_KHALTI)
            order.save(update_fields=["payment_method", "payment_status", "billing_status", "paid_at"])
            _notify_order_change(order)
            return Response({
                "paid": True,
                "status": status_text,
                "order": CustomerOrderSummarySerializer(order).data
            })
        
        return Response({
            "paid": False,
            "status": status_text,
            "detail": "Payment not completed yet."
        })
        
    except Exception as e:
        logger.exception("Khalti verification failed")
        return Response({"error": str(e)}, status=400)

@api_view(["POST"])
@permission_classes([AllowAny])
def verify_khalti(request, order_id):
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err
    try:
        order = Order.objects.select_related("restaurant", "table").get(id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    assert_customer_can_access_order(order, table, session_id)
    
    pidx = request.data.get("pidx") or order.khalti_pidx
    if not pidx:
        return Response({"error": "No pidx provided or found for this order"}, status=400)
        
    return _run_khalti_verification(order, pidx)

@api_view(["POST"])
@permission_classes([AllowAny])
def verify_khalti_global(request):
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err
        
    pidx = request.data.get("pidx")
    if not pidx:
        return Response({"error": "pidx is required"}, status=400)
        
    order = Order.objects.filter(khalti_pidx=pidx).first()
    if not order:
        return Response({"error": "Order not found for this pidx"}, status=404)
        
    assert_customer_can_access_order(order, table, session_id)
    return _run_khalti_verification(order, pidx)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cashier_verify_khalti(request, order_id):
    role = getattr(request.user, "role", None)
    if role not in ("cashier", "restaurant_admin"):
        return Response({"error": "Unauthorized"}, status=403)
        
    order, err = _resolve_restaurant_order_for_user(request, order_id)
    if err: return err
    
    if not order.khalti_pidx:
        return Response({"error": "No Khalti transaction for this order"}, status=400)
        
    return _run_khalti_verification(order, order.khalti_pidx)
