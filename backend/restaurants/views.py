import time
import uuid
from datetime import timedelta
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from orders.khalti import initiate_khalti_payment, verify_khalti_payment

from .models import RestaurantSubscription, SubscriptionPayment, SubscriptionPlan

KHALTI_VERIFY_MAX_ATTEMPTS = 3


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = ["id", "code", "name", "price", "duration_days", "description", "is_active"]


class RestaurantSubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)

    class Meta:
        model = RestaurantSubscription
        fields = ["id", "status", "starts_at", "ends_at", "paid_at", "created_at", "plan"]


class SubscriptionPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPayment
        fields = ["id", "provider", "amount", "status", "transaction_uuid", "paid_at", "created_at"]


class AdminSubscriptionSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.CharField(source="restaurant.name", read_only=True)
    restaurant_id = serializers.IntegerField(source="restaurant.id", read_only=True)
    restaurant_active = serializers.BooleanField(source="restaurant.is_active", read_only=True)
    owner_name = serializers.CharField(source="restaurant.owner.full_name", read_only=True)
    owner_email = serializers.EmailField(source="restaurant.owner.email", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    plan_price = serializers.DecimalField(source="plan.price", max_digits=10, decimal_places=2, read_only=True)
    latest_payment = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    expiring_soon = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantSubscription
        fields = [
            "id",
            "restaurant_id",
            "restaurant_name",
            "restaurant_active",
            "owner_name",
            "owner_email",
            "status",
            "starts_at",
            "ends_at",
            "paid_at",
            "created_at",
            "plan_name",
            "plan_price",
            "latest_payment",
            "days_remaining",
            "expiring_soon",
        ]

    def get_latest_payment(self, obj):
        payment = obj.payments.order_by("-created_at").first()
        return SubscriptionPaymentSerializer(payment).data if payment else None

    def get_days_remaining(self, obj):
        if not obj.ends_at:
            return None
        delta = obj.ends_at - timezone.now()
        return max(delta.days, 0)

    def get_expiring_soon(self, obj):
        if obj.status != RestaurantSubscription.STATUS_ACTIVE or not obj.ends_at:
            return False
        now = timezone.now()
        return now <= obj.ends_at <= now + timedelta(days=7)


def _restaurant_admin_or_403(user):
    if getattr(user, "role", None) != "restaurant_admin":
        return Response({"error": "Only restaurant admins can manage subscriptions."}, status=403)
    if not getattr(user, "restaurant_id", None):
        return Response({"error": "No restaurant assigned."}, status=400)
    return None


def _platform_admin_or_403(user):
    if getattr(user, "role", None) != "admin":
        return Response({"error": "Only platform admins can manage restaurant subscriptions."}, status=403)
    return None


def _platform_khalti_credentials():
    from admin_dashboard.models import PlatformSettings
    settings_obj = PlatformSettings.get_solo()
    
    public_key = (settings_obj.khalti_public_key or "").strip()
    secret_key = (settings_obj.khalti_secret_key or "").strip()
    
    if not public_key:
        public_key = getattr(settings, "KHALTI_PUBLIC_KEY", "").strip()
    if not secret_key:
        secret_key = getattr(settings, "KHALTI_SECRET_KEY", "").strip()
        
    if not public_key or not secret_key:
        raise ValueError("Platform Khalti credentials are not configured.")
    return public_key, secret_key


def _merge_query_params(url: str, extra: dict) -> str:
    parts = urlparse(url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    for key, value in extra.items():
        if value is not None and key not in q:
            q[key] = str(value)
    return urlunparse((parts.scheme, parts.netloc, parts.path, parts.params, urlencode(q), parts.fragment))


def _build_subscription_return_urls(payment_id: int) -> str:
    base = (getattr(settings, "FRONTEND_URL", None) or "").rstrip("/")
    if not base:
        raise ValueError("FRONTEND_URL is not configured on the server.")
    return _merge_query_params(
        f"{base}/restaurant-admin/subscription",
        {"khalti": "success", "payment_id": payment_id},
    )


def _subscription_payload(restaurant):
    subscription = restaurant.current_subscription
    payment = subscription.payments.first() if subscription else None
    return {
        "restaurant_name": restaurant.name,
        "restaurant_active": restaurant.is_active,
        "subscription_status": restaurant.current_subscription_status,
        "current_subscription": RestaurantSubscriptionSerializer(subscription).data if subscription else None,
        "latest_payment": SubscriptionPaymentSerializer(payment).data if payment else None,
    }


def _set_subscription_state(subscription: RestaurantSubscription, next_status: str, *, extend_days: int = 0) -> None:
    now = timezone.now()
    restaurant = subscription.restaurant

    if next_status == RestaurantSubscription.STATUS_ACTIVE:
        starts_at = subscription.starts_at or now
        base_end = subscription.ends_at if subscription.ends_at and subscription.ends_at > now else starts_at
        total_days = subscription.plan.duration_days + max(int(extend_days or 0), 0)
        subscription.status = RestaurantSubscription.STATUS_ACTIVE
        subscription.starts_at = starts_at
        subscription.ends_at = base_end + timedelta(days=total_days if subscription.paid_at is None else max(int(extend_days or 0), 0))
        if subscription.paid_at is None:
            subscription.paid_at = now
        restaurant.is_active = True
        restaurant.save(update_fields=["is_active"])
    elif next_status == RestaurantSubscription.STATUS_CANCELLED:
        subscription.status = RestaurantSubscription.STATUS_CANCELLED
        restaurant.is_active = False
        restaurant.save(update_fields=["is_active"])
    elif next_status == RestaurantSubscription.STATUS_EXPIRED:
        subscription.status = RestaurantSubscription.STATUS_EXPIRED
        subscription.ends_at = subscription.ends_at or now
        restaurant.is_active = False
        restaurant.save(update_fields=["is_active"])
    elif next_status == RestaurantSubscription.STATUS_FAILED:
        subscription.status = RestaurantSubscription.STATUS_FAILED
        restaurant.is_active = False
        restaurant.save(update_fields=["is_active"])
    elif next_status == RestaurantSubscription.STATUS_PENDING:
        subscription.status = RestaurantSubscription.STATUS_PENDING
        restaurant.is_active = False
        restaurant.save(update_fields=["is_active"])
    else:
        raise ValueError("Unsupported subscription status")

    subscription.save(update_fields=["status", "starts_at", "ends_at", "paid_at", "updated_at"])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def subscription_plans(request):
    err = _restaurant_admin_or_403(request.user)
    if err:
        return err
    plans = SubscriptionPlan.objects.filter(is_active=True).order_by("sort_order", "price", "name")
    return Response(SubscriptionPlanSerializer(plans, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def subscription_current(request):
    err = _restaurant_admin_or_403(request.user)
    if err:
        return err
    return Response(_subscription_payload(request.user.restaurant))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def subscription_checkout(request):
    err = _restaurant_admin_or_403(request.user)
    if err:
        return err

    plan_id = request.data.get("plan_id")
    try:
        plan = SubscriptionPlan.objects.get(id=plan_id, is_active=True)
    except SubscriptionPlan.DoesNotExist:
        return Response({"error": "Subscription plan not found."}, status=404)

    restaurant = request.user.restaurant
    if restaurant.is_active and restaurant.current_subscription_status == RestaurantSubscription.STATUS_ACTIVE:
        return Response({"error": "Your restaurant already has an active subscription."}, status=400)

    try:
        public_key, secret_key = _platform_khalti_credentials()
    except ValueError as exc:
        return Response({"error": str(exc)}, status=500)

    with transaction.atomic():
        subscription = RestaurantSubscription.objects.create(
            restaurant=restaurant,
            plan=plan,
            status=RestaurantSubscription.STATUS_PENDING,
        )
        payment = SubscriptionPayment.objects.create(
            subscription=subscription,
            amount=plan.price,
            status=SubscriptionPayment.STATUS_PENDING,
            transaction_uuid=f"mm-sub-{restaurant.id}-{uuid.uuid4().hex}",
        )

    try:
        return_url = _build_subscription_return_urls(payment.id)
        res_data = initiate_khalti_payment(
            order_id=subscription.id,
            amount_npr=plan.price,
            purchase_order_name=f"Subscription: {plan.name}",
            return_url=return_url,
            secret_key=secret_key
        )
        pidx = res_data.get("pidx")
        payment_url = res_data.get("payment_url")
        if not pidx or not payment_url:
            return Response({"error": "Failed to get payment details from Khalti"}, status=502)
        
        payment.khalti_pidx = pidx
        payment.save(update_fields=["khalti_pidx"])
        
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)

    return Response(
        {
            "payment_url": payment_url,
            "pidx": pidx,
            "payment_id": payment.id,
            "subscription_id": subscription.id,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def subscription_verify(request):
    err = _restaurant_admin_or_403(request.user)
    if err:
        return err

    payment_id = request.data.get("payment_id") or request.query_params.get("payment_id")
    if not payment_id:
        return Response({"error": "payment_id is required."}, status=400)

    try:
        payment = SubscriptionPayment.objects.select_related(
            "subscription__restaurant",
            "subscription__plan",
        ).get(id=payment_id, subscription__restaurant=request.user.restaurant)
    except SubscriptionPayment.DoesNotExist:
        return Response({"error": "Subscription payment not found."}, status=404)

    if not payment.khalti_pidx:
        return Response({"error": "No Khalti transaction for this payment."}, status=400)

    try:
        _, secret_key = _platform_khalti_credentials()
        res_data = verify_khalti_payment(payment.khalti_pidx, secret_key=secret_key)
        status_text = res_data.get("status")
        
        if status_text == "Completed":
            now = timezone.now()
            subscription = payment.subscription
            subscription.status = RestaurantSubscription.STATUS_ACTIVE
            subscription.starts_at = now
            subscription.ends_at = now + timedelta(days=subscription.plan.duration_days)
            subscription.paid_at = now
            subscription.save(update_fields=["status", "starts_at", "ends_at", "paid_at", "updated_at"])

            restaurant = subscription.restaurant
            restaurant.is_active = True
            restaurant.save(update_fields=["is_active"])

            payment.status = SubscriptionPayment.STATUS_PAID
            payment.paid_at = now
            payment.raw_response = res_data
            payment.save(update_fields=["status", "paid_at", "raw_response", "updated_at"])
            return Response({"paid": True, **_subscription_payload(restaurant)})

        if status_text in ("Expired", "User canceled"):
            subscription = payment.subscription
            subscription.status = RestaurantSubscription.STATUS_FAILED
            subscription.save(update_fields=["status", "updated_at"])
            payment.status = SubscriptionPayment.STATUS_FAILED
            payment.raw_response = res_data
            payment.save(update_fields=["status", "raw_response", "updated_at"])
            return Response({"paid": False, "pending": False, **_subscription_payload(subscription.restaurant)})

        return Response({"paid": False, "pending": True, "status": status_text})

    except Exception as exc:
        return Response({"error": str(exc)}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_subscription_overview(request):
    err = _platform_admin_or_403(request.user)
    if err:
        return err

    now = timezone.now()
    upcoming_cutoff = now + timedelta(days=7)
    qs = RestaurantSubscription.objects.select_related("restaurant__owner", "plan").prefetch_related("payments")

    status_filter = (request.query_params.get("status") or "").strip()
    if status_filter:
        qs = qs.filter(status=status_filter)

    only_expiring = (request.query_params.get("expiring") or "").strip().lower() == "true"
    if only_expiring:
        qs = qs.filter(status=RestaurantSubscription.STATUS_ACTIVE, ends_at__gte=now, ends_at__lte=upcoming_cutoff)

    search = (request.query_params.get("search") or "").strip()
    if search:
        qs = qs.filter(
            Q(restaurant__name__icontains=search)
            | Q(restaurant__owner__full_name__icontains=search)
            | Q(restaurant__owner__email__icontains=search)
            | Q(plan__name__icontains=search)
        )

    stats_base = RestaurantSubscription.objects.all()
    stats = stats_base.aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(status=RestaurantSubscription.STATUS_ACTIVE)),
        pending=Count("id", filter=Q(status=RestaurantSubscription.STATUS_PENDING)),
        failed=Count("id", filter=Q(status=RestaurantSubscription.STATUS_FAILED)),
        expired=Count("id", filter=Q(status=RestaurantSubscription.STATUS_EXPIRED)),
        cancelled=Count("id", filter=Q(status=RestaurantSubscription.STATUS_CANCELLED)),
        expiring_soon=Count(
            "id",
            filter=Q(status=RestaurantSubscription.STATUS_ACTIVE, ends_at__gte=now, ends_at__lte=upcoming_cutoff),
        ),
    )
    revenue = SubscriptionPayment.objects.filter(status=SubscriptionPayment.STATUS_PAID).aggregate(total=Sum("amount"))["total"] or 0

    return Response(
        {
            "stats": {**stats, "revenue": revenue},
            "subscriptions": AdminSubscriptionSerializer(qs.order_by("ends_at", "-created_at"), many=True).data,
        }
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def admin_subscription_update(request, subscription_id):
    err = _platform_admin_or_403(request.user)
    if err:
        return err

    try:
        subscription = RestaurantSubscription.objects.select_related("restaurant", "plan").get(id=subscription_id)
    except RestaurantSubscription.DoesNotExist:
        return Response({"error": "Subscription not found."}, status=404)

    next_status = (request.data.get("status") or "").strip()
    if next_status not in {
        RestaurantSubscription.STATUS_PENDING,
        RestaurantSubscription.STATUS_ACTIVE,
        RestaurantSubscription.STATUS_FAILED,
        RestaurantSubscription.STATUS_EXPIRED,
        RestaurantSubscription.STATUS_CANCELLED,
    }:
        return Response({"error": "Invalid subscription status."}, status=400)

    extend_days_raw = request.data.get("extend_days", 0)
    try:
        extend_days = int(extend_days_raw or 0)
    except (TypeError, ValueError):
        return Response({"error": "extend_days must be an integer."}, status=400)

    if extend_days < 0:
        return Response({"error": "extend_days cannot be negative."}, status=400)

    try:
        _set_subscription_state(subscription, next_status, extend_days=extend_days)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)

    return Response(AdminSubscriptionSerializer(subscription).data)
