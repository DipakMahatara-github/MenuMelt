import logging
import time
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from menu.models import MenuItem
from restaurants.models import PaymentConfig

from .customer_utils import assert_customer_can_access_order, resolve_customer_table_and_session
from .esewa import (
    ESEWA_FORM_URL,
    build_esewa_return_urls,
    build_form_fields,
    classify_esewa_transaction_status,
    decode_esewa_return_data_payload,
    extract_esewa_redirect_fields,
    fetch_transaction_status,
    format_esewa_amount,
    get_esewa_status_url,
)
from .models import Order, OrderItem
from .serializers import (
    CustomerOrderCreateSerializer,
    CustomerOrderSummarySerializer,
    OrderSerializer,
)

ESEWA_VERIFY_MAX_ATTEMPTS = 10
ESEWA_VERIFY_RETRY_DELAY_SEC = 2.0

ORDER_STATUS_VALUES = {Order.STATUS_PENDING, Order.STATUS_PREPARING, Order.STATUS_SERVED}

logger = logging.getLogger(__name__)


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
            .prefetch_related("items__menu_item")
            .order_by("-created_at")
        )
        role = getattr(request.user, "role", None)
        if role == "kitchen":
            qs = qs.filter(confirmed_for_kitchen_at__isnull=False)
        st = (request.query_params.get("status") or "").strip()
        if st:
            qs = qs.filter(status=st)
        return Response(OrderSerializer(qs, many=True).data)

    # POST — customer (no login); totals and line prices come only from MenuItem rows we validate.
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err

    print("TABLE:", table)
    print("SESSION:", session_id)

    ser = CustomerOrderCreateSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    data = ser.validated_data
    restaurant = table.restaurant
    items_in = data["items"]

    if not items_in:
        return Response({"error": "At least one item is required."}, status=status.HTTP_400_BAD_REQUEST)

    menu_ids = [row["menu_item"] for row in items_in]
    if len(menu_ids) != len(set(menu_ids)):
        return Response({"error": "Each menu item may only appear once per order."}, status=400)

    menu_items = list(
        MenuItem.objects.filter(id__in=menu_ids, restaurant_id=restaurant.id, is_available=True)
    )
    by_id = {m.id: m for m in menu_items}
    if len(by_id) != len(menu_ids):
        return Response(
            {"error": "One or more items are missing, unavailable, or not from this restaurant."},
            status=400,
        )

    total_price = Decimal("0")
    lines = []
    for row in items_in:
        mi = by_id[row["menu_item"]]
        if mi.restaurant_id != restaurant.id:
            return Response(
                {"error": "All items must belong to the same restaurant as this table."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qty = int(row["quantity"])
        if qty < 1:
            return Response({"error": "Each item must have quantity at least 1."}, status=400)
        # Authoritative price from DB only — never from the client payload.
        unit_price = mi.price
        if unit_price is None:
            return Response({"error": "Menu item has no valid price."}, status=400)
        total_price += unit_price * qty
        lines.append((mi, qty, unit_price))

    total_price = total_price.quantize(Decimal("0.01"))

    try:
        with transaction.atomic():
            order = Order.objects.create(
                restaurant=restaurant,
                table=table,
                session_id=session_id,
                customer_name=data["customer_name"],
                total_price=total_price,
                payment_status=Order.PAYMENT_ST_PENDING,
                status=Order.STATUS_PENDING,
            )
            for mi, qty, unit_price in lines:
                OrderItem.objects.create(
                    order=order,
                    menu_item=mi,
                    quantity=qty,
                    unit_price=unit_price,
                )
    except IntegrityError as exc:
        logger.warning("Order create IntegrityError: %s", exc, exc_info=True)
        print("Order IntegrityError:", exc)
        return Response(
            {"error": "Could not save your order. Please try again or ask staff for help."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception:
        logger.exception("Order creation failed")
        return Response(
            {"error": "An unexpected error occurred. Please try again later."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

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
        .prefetch_related("items__menu_item")
        .order_by("-created_at")
    )
    return Response(CustomerOrderSummarySerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_order_for_kitchen(request, order_id):
    """Staff or restaurant admin: release order to kitchen (required before kitchen role can see it)."""
    role = getattr(request.user, "role", None)
    if role not in ("staff", "restaurant_admin"):
        return Response({"error": "Only staff or restaurant admins can confirm orders for the kitchen."}, status=403)
    if not request.user.restaurant_id:
        return Response({"error": "No restaurant assigned to user"}, status=400)

    try:
        order = Order.objects.select_related("table").get(
            id=order_id, restaurant_id=request.user.restaurant_id
        )
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    if order.confirmed_for_kitchen_at:
        return Response(OrderSerializer(order).data)

    order.confirmed_for_kitchen_at = timezone.now()
    order.status = Order.STATUS_PREPARING
    order.save(update_fields=["confirmed_for_kitchen_at", "status"])
    logger.info("Order %s confirmed for kitchen by user=%s", order.pk, request.user.pk)
    return Response(OrderSerializer(order).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_order_status(request, order_id):
    if not request.user.restaurant_id:
        return Response({"error": "No restaurant assigned to user"}, status=400)

    try:
        order = Order.objects.select_related("table").get(
            id=order_id, restaurant_id=request.user.restaurant_id
        )
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    status_value = request.data.get("status")
    if not status_value or status_value not in ORDER_STATUS_VALUES:
        return Response(
            {"error": f"Invalid status. Allowed: {sorted(ORDER_STATUS_VALUES)}"},
            status=400,
        )

    role = getattr(request.user, "role", None)

    if role == "kitchen":
        if not order.confirmed_for_kitchen_at:
            return Response(
                {"error": "This order has not been released to the kitchen yet."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if status_value != Order.STATUS_SERVED or order.status != Order.STATUS_PREPARING:
            return Response(
                {
                    "error": "Kitchen can only mark orders as served when they are in preparing state.",
                },
                status=400,
            )

    if role == "staff":
        if (
            order.status == Order.STATUS_PENDING
            and status_value == Order.STATUS_PREPARING
            and not order.confirmed_for_kitchen_at
        ):
            return Response(
                {
                    "error": "Confirm the order for the kitchen first (Send to kitchen).",
                },
                status=400,
            )

    if role == "restaurant_admin":
        if (
            order.status == Order.STATUS_PENDING
            and status_value == Order.STATUS_PREPARING
            and not order.confirmed_for_kitchen_at
        ):
            return Response(
                {
                    "error": "Use Send to kitchen to release this order before changing status.",
                },
                status=400,
            )

    order.status = status_value
    order.save(update_fields=["status"])
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

    order.payment_method = Order.PAYMENT_CASH
    order.payment_status = Order.PAYMENT_ST_PENDING
    order.save(update_fields=["payment_method", "payment_status"])
    return Response(CustomerOrderSummarySerializer(order).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def pay_esewa(request, order_id):
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err
    try:
        order = Order.objects.select_related("restaurant", "table").get(id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    assert_customer_can_access_order(order, table, session_id)

    try:
        cfg = order.restaurant.payment_config
    except PaymentConfig.DoesNotExist:
        return Response({"error": "eSewa is not configured for this restaurant"}, status=400)

    merchant_id = (cfg.merchant_id or "").strip()
    secret_key = (cfg.secret_key or "").strip()
    if not merchant_id or not secret_key:
        return Response({"error": "eSewa merchant credentials are incomplete"}, status=400)

    if order.payment_status == Order.PAYMENT_ST_PAID:
        return Response({"error": "Order is already paid"}, status=400)

    base = (getattr(settings, "FRONTEND_URL", None) or "").rstrip("/")
    if not base:
        return Response({"error": "FRONTEND_URL is not configured on the server"}, status=500)

    # eSewa requires a new transaction_uuid for every payment initiation.
    txn = f"mm-{order.pk}-{uuid.uuid4().hex}"
    pay_amount_str = format_esewa_amount(order.total_price)
    order.esewa_transaction_uuid = txn
    order.esewa_pay_total_amount = pay_amount_str
    order.payment_method = Order.PAYMENT_ESEWA
    order.save(
        update_fields=["esewa_transaction_uuid", "esewa_pay_total_amount", "payment_method"]
    )

    # Path only — eSewa appends query params (e.g. data, transaction_uuid). Set FRONTEND_URL to your
    # public HTTPS origin (e.g. https://xxxx.ngrok-free.app) so this URL is reachable after payment.
    success_url, failure_url, esewa_url_warnings = build_esewa_return_urls(base, order_id=order.pk)
    if success_url.startswith("http://"):
        logger.warning(
            "eSewa success_url is not HTTPS (%s); eSewa may reject or shorten the payment flow.",
            success_url,
        )

    try:
        fields = build_form_fields(
            secret_key=secret_key,
            merchant_id=merchant_id,
            total_amount=order.total_price,
            transaction_uuid=txn,
            success_url=success_url,
            failure_url=failure_url,
        )
    except ValueError as exc:
        logger.warning("eSewa build_form_fields failed order_id=%s: %s", order.pk, exc)
        return Response(
            {"error": f"Invalid eSewa payment parameters: {exc}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    print("ESEWA FORM DATA:", fields)
    logger.info(
        "eSewa pay_esewa order_id=%s status_api_base=%s success_url=%s",
        order.pk,
        get_esewa_status_url(),
        success_url,
    )

    payload = {
        "form_url": ESEWA_FORM_URL,
        "method": "POST",
        "fields": fields,
        "order_id": order.pk,
        "transaction_uuid": txn,
        "esewa_pay_total_amount": pay_amount_str,
    }
    if esewa_url_warnings:
        payload["warnings"] = esewa_url_warnings
    return Response(payload)


def _esewa_status_total_amount_str(order: Order) -> str:
    """Exact total_amount string for status API — prefer value stored at pay-esewa time."""
    stored = (order.esewa_pay_total_amount or "").strip()
    if stored:
        return stored
    return format_esewa_amount(order.total_price)


def _run_esewa_verification_for_order(order: Order) -> Response:
    """Status polling and payment_status updates. Caller must have resolved `order` and access control."""
    try:
        cfg = order.restaurant.payment_config
    except PaymentConfig.DoesNotExist:
        return Response({"error": "eSewa is not configured for this restaurant"}, status=400)

    if not cfg.merchant_id or not cfg.secret_key:
        return Response({"error": "eSewa merchant credentials are incomplete"}, status=400)

    if not order.esewa_transaction_uuid:
        return Response({"error": "No eSewa transaction was started for this order"}, status=400)

    if order.payment_status == Order.PAYMENT_ST_PAID:
        logger.info("eSewa verify skip: order_id=%s already paid", order.pk)
        return Response(
            {
                "paid": True,
                "pending": False,
                "order": CustomerOrderSummarySerializer(order).data,
            }
        )

    total_s = _esewa_status_total_amount_str(order)
    product_code = cfg.merchant_id
    txn_uuid = order.esewa_transaction_uuid

    last_payload: dict = {}
    last_raw: str = ""
    last_url: str = ""

    for attempt in range(1, ESEWA_VERIFY_MAX_ATTEMPTS + 1):
        logger.info(
            "[eSewa verify] order_id=%s attempt=%s/%s transaction_uuid=%r total_amount=%r "
            "product_code=%r",
            order.pk,
            attempt,
            ESEWA_VERIFY_MAX_ATTEMPTS,
            txn_uuid,
            total_s,
            product_code,
        )
        print(
            f"[eSewa verify DEBUG] order_id={order.pk} attempt={attempt}/"
            f"{ESEWA_VERIFY_MAX_ATTEMPTS} transaction_uuid={txn_uuid!r} "
            f"total_amount={total_s!r} product_code={product_code!r}"
        )

        try:
            payload, raw, url = fetch_transaction_status(
                merchant_id=cfg.merchant_id,
                transaction_uuid=txn_uuid,
                total_amount_str=total_s,
            )
        except ValueError as e:
            logger.warning(
                "eSewa verify fetch error order_id=%s attempt=%s/%s: %s",
                order.pk,
                attempt,
                ESEWA_VERIFY_MAX_ATTEMPTS,
                e,
            )
            print(f"[eSewa verify DEBUG] fetch error: {e!r}")
            if attempt < ESEWA_VERIFY_MAX_ATTEMPTS:
                time.sleep(ESEWA_VERIFY_RETRY_DELAY_SEC)
                continue
            return Response(
                {
                    "paid": False,
                    "pending": True,
                    "error": str(e),
                    "esewa": {},
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        last_payload = payload
        last_raw = raw
        last_url = url

        logger.info(
            "[eSewa verify] order_id=%s attempt=%s/%s status_url=%s raw_response=%r parsed_json=%s",
            order.pk,
            attempt,
            ESEWA_VERIFY_MAX_ATTEMPTS,
            url,
            raw,
            payload,
        )
        print(f"[eSewa verify DEBUG] status_url={url}")
        print(f"[eSewa verify DEBUG] raw_response={raw!r}")
        print(f"[eSewa verify DEBUG] parsed_json={payload!r}")

        outcome = classify_esewa_transaction_status(payload)
        logger.info(
            "eSewa verify outcome order_id=%s attempt=%s/%s classified=%s payload_keys=%s",
            order.pk,
            attempt,
            ESEWA_VERIFY_MAX_ATTEMPTS,
            outcome,
            list(payload.keys()) if isinstance(payload, dict) else None,
        )

        if outcome == "success":
            order.payment_status = Order.PAYMENT_ST_PAID
            order.save(update_fields=["payment_status"])
            return Response(
                {
                    "paid": True,
                    "pending": False,
                    "esewa": payload,
                    "order": CustomerOrderSummarySerializer(order).data,
                }
            )

        if outcome == "failed":
            order.payment_status = Order.PAYMENT_ST_FAILED
            order.save(update_fields=["payment_status"])
            return Response({"paid": False, "pending": False, "esewa": payload}, status=200)

        if outcome == "not_found":
            logger.warning(
                "[eSewa verify] NOT_FOUND (possible uuid/amount/product_code mismatch vs eSewa) "
                "order_id=%s attempt=%s/%s",
                order.pk,
                attempt,
                ESEWA_VERIFY_MAX_ATTEMPTS,
            )
            print(
                "[eSewa verify DEBUG] NOT_FOUND — check transaction_uuid, total_amount, "
                "product_code against payment form"
            )

        if attempt < ESEWA_VERIFY_MAX_ATTEMPTS:
            time.sleep(ESEWA_VERIFY_RETRY_DELAY_SEC)

    logger.info(
        "eSewa verify still pending after retries order_id=%s attempts=%s last_url=%s",
        order.pk,
        ESEWA_VERIFY_MAX_ATTEMPTS,
        last_url,
    )
    return Response(
        {
            "paid": False,
            "pending": True,
            "esewa": last_payload,
            "debug": {
                "last_status_url": last_url,
                "last_raw_snippet": (last_raw[:500] + "…") if len(last_raw) > 500 else last_raw,
            },
        },
        status=200,
    )


def _coerce_verify_body(request) -> dict:
    data = request.data
    if isinstance(data, dict):
        return data
    if data is None:
        return {}
    return {}


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_esewa_global(request):
    """Resolve order by eSewa transaction_uuid from JSON body (success redirect params)."""
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err

    body = dict(_coerce_verify_body(request))
    print("QUERY PARAMS:", body)

    data_raw = body.get("data")
    decoded: dict = {}
    if data_raw is not None and str(data_raw).strip():
        decoded = decode_esewa_return_data_payload(str(data_raw))
        du, da, dc = extract_esewa_redirect_fields(decoded)
        if du and not (body.get("transaction_uuid") or "").strip():
            body["transaction_uuid"] = du
        if da and body.get("total_amount") in (None, ""):
            body["total_amount"] = da
        if dc and body.get("product_code") in (None, ""):
            body["product_code"] = dc
        logger.info(
            "eSewa verify decoded `data` keys=%s extracted_uuid=%r",
            list(decoded.keys()) if decoded else None,
            (body.get("transaction_uuid") or "")[:80],
        )

    transaction_uuid = (body.get("transaction_uuid") or "").strip()
    print("VERIFY transaction_uuid received:", repr(transaction_uuid))

    if not transaction_uuid:
        err_detail = (
            "Could not resolve transaction_uuid. Send `data` (base64 from eSewa) "
            "or `transaction_uuid` (+ optional total_amount, product_code)."
        )
        return Response(
            {
                "error": err_detail,
                "paid": False,
                "pending": False,
                "debug": {
                    "had_data_param": bool(data_raw and str(data_raw).strip()),
                    "decoded_keys": list(decoded.keys()) if decoded else None,
                },
            },
            status=400,
        )

    order = (
        Order.objects.filter(esewa_transaction_uuid=transaction_uuid)
        .select_related("restaurant", "table")
        .first()
    )

    if not order:
        sample = list(
            Order.objects.filter(esewa_transaction_uuid__isnull=False)
            .exclude(esewa_transaction_uuid="")
            .values_list("id", "esewa_transaction_uuid")[:5]
        )
        print("VERIFY no order for uuid; sample DB (id, esewa_transaction_uuid):", sample)
        return Response(
            {
                "error": "Order not found for this transaction_uuid.",
                "paid": False,
                "pending": False,
                "debug": {
                    "transaction_uuid_received": transaction_uuid,
                    "hint": "Ensure pay-esewa ran for this order so esewa_transaction_uuid is saved.",
                },
            },
            status=404,
        )

    print(
        f"VERIFY order matched id={order.pk} "
        f"stored esewa_transaction_uuid={order.esewa_transaction_uuid!r}"
    )

    try:
        cfg_dbg = order.restaurant.payment_config
        merchant_dbg = cfg_dbg.merchant_id
    except PaymentConfig.DoesNotExist:
        merchant_dbg = None

    logger.info(
        "[eSewa verify_esewa_global] order_id=%s stored_transaction_uuid=%r "
        "stored_esewa_pay_total_amount=%r product_code=%r",
        order.pk,
        order.esewa_transaction_uuid,
        order.esewa_pay_total_amount,
        merchant_dbg,
    )
    print(
        "[eSewa verify_esewa_global DEBUG] stored_transaction_uuid="
        f"{order.esewa_transaction_uuid!r} stored_esewa_pay_total_amount="
        f"{order.esewa_pay_total_amount!r} product_code={merchant_dbg!r}"
    )

    if decoded:
        du_chk, _, _ = extract_esewa_redirect_fields(decoded)
        if du_chk and du_chk != order.esewa_transaction_uuid:
            logger.warning(
                "eSewa verify decoded transaction_uuid != order row order_id=%s stored=%r decoded=%r",
                order.pk,
                order.esewa_transaction_uuid,
                du_chk,
            )

    raw_amt = body.get("total_amount")
    if raw_amt is not None and str(raw_amt).strip() != "":
        got = str(raw_amt).strip()
        stored_amt = (order.esewa_pay_total_amount or "").strip()
        if stored_amt:
            if got != stored_amt:
                logger.warning(
                    "eSewa verify redirect total_amount vs stored esewa_pay_total_amount "
                    "order_id=%s stored=%r redirect=%r",
                    order.pk,
                    stored_amt,
                    got,
                )
        else:
            expected = format_esewa_amount(order.total_price)
            if expected != got:
                logger.warning(
                    "eSewa verify total_amount mismatch (no esewa_pay_total_amount on order) "
                    "order_id=%s expected_from_total_price=%s client_sent=%r",
                    order.pk,
                    expected,
                    raw_amt,
                )

    product_code = (body.get("product_code") or "").strip()
    if product_code:
        try:
            if product_code != order.restaurant.payment_config.merchant_id:
                logger.warning(
                    "eSewa verify product_code mismatch order_id=%s sent=%r",
                    order.pk,
                    product_code,
                )
        except PaymentConfig.DoesNotExist:
            pass

    assert_customer_can_access_order(order, table, session_id)
    return _run_esewa_verification_for_order(order)


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_esewa(request, order_id):
    ok, table, session_id, ctx_err = resolve_customer_table_and_session(request)
    if not ok:
        return ctx_err

    body = dict(_coerce_verify_body(request))
    print("VERIFY REQUEST (by order_id):", body, "order_id=", order_id)

    try:
        order = Order.objects.select_related("restaurant", "table").get(id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    print(
        "VERIFY by order_id stored esewa_transaction_uuid=",
        repr(order.esewa_transaction_uuid),
    )

    data_raw = body.get("data")
    if data_raw is not None and str(data_raw).strip():
        dec = decode_esewa_return_data_payload(str(data_raw))
        du, _, _ = extract_esewa_redirect_fields(dec)
        if du and du != order.esewa_transaction_uuid:
            logger.warning(
                "eSewa verify_esewa(order_id): body `data` uuid != stored order_id=%s stored=%r decoded=%r",
                order.pk,
                order.esewa_transaction_uuid,
                du,
            )

    try:
        cfg_o = order.restaurant.payment_config
        merchant_o = cfg_o.merchant_id
    except PaymentConfig.DoesNotExist:
        merchant_o = None

    logger.info(
        "[eSewa verify_esewa] order_id=%s stored_transaction_uuid=%r "
        "stored_esewa_pay_total_amount=%r product_code=%r",
        order.pk,
        order.esewa_transaction_uuid,
        order.esewa_pay_total_amount,
        merchant_o,
    )
    print(
        "[eSewa verify_esewa DEBUG] stored_transaction_uuid="
        f"{order.esewa_transaction_uuid!r} stored_esewa_pay_total_amount="
        f"{order.esewa_pay_total_amount!r} product_code={merchant_o!r}"
    )

    assert_customer_can_access_order(order, table, session_id)
    return _run_esewa_verification_for_order(order)


@api_view(["GET"])
@permission_classes([AllowAny])
def debug_esewa(request):
    """Temporary: inspect stored eSewa fields for a transaction_uuid (query param `uuid`)."""
    u = (request.query_params.get("uuid") or "").strip()
    if not u:
        return Response({"error": "Query parameter uuid is required."}, status=400)

    order = (
        Order.objects.filter(esewa_transaction_uuid=u)
        .select_related("restaurant", "table")
        .first()
    )
    if not order:
        return Response({"error": "No order for this uuid.", "uuid": u}, status=404)

    try:
        mid = order.restaurant.payment_config.merchant_id
    except PaymentConfig.DoesNotExist:
        mid = None

    return Response(
        {
            "order": CustomerOrderSummarySerializer(order).data,
            "esewa_transaction_uuid": order.esewa_transaction_uuid,
            "esewa_pay_total_amount": order.esewa_pay_total_amount,
            "total_price": str(order.total_price),
            "payment_status": order.payment_status,
            "payment_method": order.payment_method,
            "product_code": mid,
        }
    )
