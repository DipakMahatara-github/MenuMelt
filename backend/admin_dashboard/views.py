from datetime import timedelta

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from orders.models import Order
from restaurants.models import Restaurant, RestaurantSubscription, SubscriptionPlan
from tables.models import Table

from .models import PlatformSettings

MANUAL_UNLOCK_PLAN_CODE = "manual-access"
MANUAL_UNLOCK_PLAN_NAME = "Manual Access"
MANUAL_UNLOCK_DURATION_DAYS = 365


def _platform_admin_or_403(user):
    if getattr(user, "role", None) != "admin":
        return Response({"error": "Only platform admins can access this area."}, status=403)
    return None


def _platform_settings():
    return PlatformSettings.get_solo()


def _manual_unlock_plan():
    plan, _ = SubscriptionPlan.objects.get_or_create(
        code=MANUAL_UNLOCK_PLAN_CODE,
        defaults={
            "name": MANUAL_UNLOCK_PLAN_NAME,
            "price": 0,
            "duration_days": MANUAL_UNLOCK_DURATION_DAYS,
            "description": "Complimentary access unlocked by a platform admin.",
            "is_active": True,
            "sort_order": 999,
        },
    )
    return plan


def _unlock_restaurant_access(restaurant: Restaurant) -> RestaurantSubscription:
    now = timezone.now()
    subscription = restaurant.current_subscription

    if subscription is None:
        subscription = RestaurantSubscription.objects.create(
            restaurant=restaurant,
            plan=_manual_unlock_plan(),
            status=RestaurantSubscription.STATUS_ACTIVE,
            starts_at=now,
            ends_at=now + timedelta(days=MANUAL_UNLOCK_DURATION_DAYS),
            paid_at=now,
        )
    else:
        duration_days = max(int(subscription.plan.duration_days or 0), 30)
        subscription.status = RestaurantSubscription.STATUS_ACTIVE
        subscription.starts_at = subscription.starts_at or now
        if not subscription.ends_at or subscription.ends_at <= now:
            subscription.ends_at = now + timedelta(days=duration_days)
        subscription.paid_at = subscription.paid_at or now
        subscription.save(update_fields=["status", "starts_at", "ends_at", "paid_at", "updated_at"])

    if not restaurant.is_active:
        restaurant.is_active = True
        restaurant.save(update_fields=["is_active"])

    return subscription


def _lock_restaurant_access(restaurant: Restaurant):
    subscription = restaurant.current_subscription
    if subscription and subscription.status == RestaurantSubscription.STATUS_ACTIVE:
        subscription.status = RestaurantSubscription.STATUS_CANCELLED
        if not subscription.ends_at:
            subscription.ends_at = timezone.now()
        subscription.save(update_fields=["status", "ends_at", "updated_at"])

    if restaurant.is_active:
        restaurant.is_active = False
        restaurant.save(update_fields=["is_active"])

    return subscription


class AdminUserSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.SerializerMethodField()
    last_login = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "role",
            "is_active",
            "restaurant_name",
            "created_at",
            "last_login",
        ]

    def get_restaurant_name(self, obj):
        if obj.restaurant_id and obj.restaurant:
            return obj.restaurant.name
        return None


class AdminRestaurantSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.full_name", read_only=True)
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    current_subscription_status = serializers.SerializerMethodField()
    current_plan_name = serializers.SerializerMethodField()
    current_plan_code = serializers.SerializerMethodField()
    tables_count = serializers.IntegerField(read_only=True)
    team_size = serializers.IntegerField(read_only=True)
    orders_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Restaurant
        fields = [
            "id",
            "name",
            "address",
            "is_active",
            "created_at",
            "owner_name",
            "owner_email",
            "current_subscription_status",
            "current_plan_name",
            "current_plan_code",
            "tables_count",
            "team_size",
            "orders_count",
        ]

    def get_current_subscription_status(self, obj):
        return obj.current_subscription_status

    def get_current_plan_name(self, obj):
        sub = obj.current_subscription
        return sub.plan.name if sub and sub.plan_id else None

    def get_current_plan_code(self, obj):
        sub = obj.current_subscription
        return sub.plan.code if sub and sub.plan_id else None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    err = _platform_admin_or_403(request.user)
    if err:
        return err

    now = timezone.now()
    today = now.date()
    settings_obj = _platform_settings()

    stats = {
        "total_users": User.objects.count(),
        "active_users": User.objects.filter(is_active=True).count(),
        "total_restaurants": Restaurant.objects.count(),
        "active_restaurants": Restaurant.objects.filter(is_active=True).count(),
        "locked_restaurants": Restaurant.objects.filter(is_active=False).count(),
        "total_orders": Order.objects.count(),
        "orders_today": Order.objects.filter(created_at__date=today).count(),
        "active_subscriptions": RestaurantSubscription.objects.filter(
            status=RestaurantSubscription.STATUS_ACTIVE
        ).count(),
        "pending_subscriptions": RestaurantSubscription.objects.filter(
            status=RestaurantSubscription.STATUS_PENDING
        ).count(),
        "failed_subscriptions": RestaurantSubscription.objects.filter(
            status=RestaurantSubscription.STATUS_FAILED
        ).count(),
        "total_tables": Table.objects.count(),
        "registration_open": settings_obj.allow_restaurant_registration,
    }

    recent_users = User.objects.select_related("restaurant").order_by("-created_at")[:6]
    recent_restaurants = (
        Restaurant.objects.select_related("owner")
        .annotate(
            tables_count=Count("tables", distinct=True),
            team_size=Count(
                "users",
                filter=Q(users__role__in=["restaurant_admin", "waiter", "cashier", "kitchen"]),
                distinct=True,
            ),
            orders_count=Count("orders", distinct=True),
        )
        .order_by("-created_at")[:6]
    )

    return Response(
        {
            "stats": stats,
            "recent_users": AdminUserSerializer(recent_users, many=True).data,
            "recent_restaurants": AdminRestaurantSerializer(recent_restaurants, many=True).data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_users(request):
    err = _platform_admin_or_403(request.user)
    if err:
        return err

    users = User.objects.select_related("restaurant").order_by("-created_at")

    search = (request.query_params.get("search") or "").strip()
    if search:
        users = users.filter(
            Q(full_name__icontains=search)
            | Q(email__icontains=search)
            | Q(restaurant__name__icontains=search)
        )

    role = (request.query_params.get("role") or "").strip()
    if role:
        users = users.filter(role=role)

    status_filter = (request.query_params.get("status") or "").strip().lower()
    if status_filter == "active":
        users = users.filter(is_active=True)
    elif status_filter == "inactive":
        users = users.filter(is_active=False)

    return Response(
        {
            "users": AdminUserSerializer(users[:200], many=True).data,
            "roles": [choice[0] for choice in User.ROLE_CHOICES],
        }
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_user_update(request, user_id):
    err = _platform_admin_or_403(request.user)
    if err:
        return err

    try:
        user = User.objects.select_related("restaurant").get(pk=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=404)

    if request.method == "DELETE":
        if user.pk == request.user.pk:
            return Response({"error": "You cannot delete your own platform admin account."}, status=400)

        if user.role == "admin" and User.objects.filter(role="admin", is_active=True).count() <= 1:
            return Response(
                {"error": "You cannot delete the last active platform admin account."},
                status=400,
            )

        owned_restaurant = Restaurant.objects.filter(owner=user).first()
        cascade_summary = None
        if owned_restaurant:
            cascade_summary = {
                "restaurant_id": owned_restaurant.id,
                "restaurant_name": owned_restaurant.name,
                "team_accounts": User.objects.filter(restaurant_id=owned_restaurant.id).exclude(pk=user.pk).count(),
            }

        deleted_user = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        }
        user.delete()

        message = f"Deleted {deleted_user['email']}."
        if cascade_summary:
            message = (
                f"Deleted {deleted_user['email']} and removed restaurant "
                f"“{cascade_summary['restaurant_name']}” with its linked staff accounts."
            )

        payload = {
            "message": message,
            "deleted_user": deleted_user,
        }
        if cascade_summary:
            payload["cascade"] = cascade_summary
        return Response(payload)

    if "is_active" not in request.data:
        return Response({"error": "is_active is required."}, status=400)

    is_active = request.data.get("is_active")
    if not isinstance(is_active, bool):
        return Response({"error": "is_active must be true or false."}, status=400)

    if user.pk == request.user.pk and not is_active:
        return Response({"error": "You cannot deactivate your own platform admin account."}, status=400)

    user.is_active = is_active
    user.save(update_fields=["is_active"])
    return Response(AdminUserSerializer(user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_restaurants(request):
    err = _platform_admin_or_403(request.user)
    if err:
        return err

    restaurants = (
        Restaurant.objects.select_related("owner")
        .annotate(
            tables_count=Count("tables", distinct=True),
            team_size=Count(
                "users",
                filter=Q(users__role__in=["restaurant_admin", "waiter", "cashier", "kitchen"]),
                distinct=True,
            ),
            orders_count=Count("orders", distinct=True),
        )
        .order_by("-created_at")
    )

    search = (request.query_params.get("search") or "").strip()
    if search:
        restaurants = restaurants.filter(
            Q(name__icontains=search)
            | Q(owner__full_name__icontains=search)
            | Q(owner__email__icontains=search)
        )

    status_filter = (request.query_params.get("status") or "").strip().lower()
    if status_filter == "active":
        restaurants = restaurants.filter(is_active=True)
    elif status_filter == "inactive":
        restaurants = restaurants.filter(is_active=False)

    return Response({"restaurants": AdminRestaurantSerializer(restaurants[:200], many=True).data})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def admin_restaurant_update(request, restaurant_id):
    err = _platform_admin_or_403(request.user)
    if err:
        return err

    try:
        restaurant = Restaurant.objects.select_related("owner").get(pk=restaurant_id)
    except Restaurant.DoesNotExist:
        return Response({"error": "Restaurant not found."}, status=404)

    action = (request.data.get("action") or "").strip().lower()
    if action == "unlock":
        _unlock_restaurant_access(restaurant)
    elif action == "lock":
        _lock_restaurant_access(restaurant)
    else:
        return Response({"error": "Unsupported action. Use `unlock` or `lock`."}, status=400)

    refreshed = (
        Restaurant.objects.select_related("owner")
        .annotate(
            tables_count=Count("tables", distinct=True),
            team_size=Count(
                "users",
                filter=Q(users__role__in=["restaurant_admin", "waiter", "cashier", "kitchen"]),
                distinct=True,
            ),
            orders_count=Count("orders", distinct=True),
        )
        .get(pk=restaurant.pk)
    )
    return Response(AdminRestaurantSerializer(refreshed).data)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def admin_settings(request):
    err = _platform_admin_or_403(request.user)
    if err:
        return err

    settings_obj = _platform_settings()

    if request.method == "GET":
        return Response(
            {
                "profile": {
                    "full_name": request.user.full_name,
                    "email": request.user.email,
                },
                "settings": {
                    "allow_restaurant_registration": settings_obj.allow_restaurant_registration,
                    "updated_at": settings_obj.updated_at,
                },
            }
        )

    full_name = (request.data.get("full_name") or request.user.full_name).strip()
    raw_email = (request.data.get("email") or request.user.email).strip()
    email = User.objects.normalize_email(raw_email)

    if not full_name:
        return Response({"error": "full_name is required."}, status=400)
    if not email:
        return Response({"error": "email is required."}, status=400)

    if User.objects.filter(email__iexact=email).exclude(pk=request.user.pk).exists():
        return Response({"error": "That email address is already in use."}, status=400)

    allow_registration = request.data.get("allow_restaurant_registration")
    if allow_registration is not None and not isinstance(allow_registration, bool):
        return Response({"error": "allow_restaurant_registration must be true or false."}, status=400)

    request.user.full_name = full_name[:255]
    request.user.email = email
    request.user.save(update_fields=["full_name", "email"])

    if isinstance(allow_registration, bool):
        settings_obj.allow_restaurant_registration = allow_registration
        settings_obj.save(update_fields=["allow_restaurant_registration", "updated_at"])

    return Response(
        {
            "message": "Platform settings updated.",
            "profile": {
                "full_name": request.user.full_name,
                "email": request.user.email,
            },
            "settings": {
                "allow_restaurant_registration": settings_obj.allow_restaurant_registration,
                "updated_at": settings_obj.updated_at,
            },
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_change_password(request):
    err = _platform_admin_or_403(request.user)
    if err:
        return err

    current_password = request.data.get("current_password")
    new_password = request.data.get("new_password")

    if not current_password or not new_password:
        return Response({"error": "current_password and new_password are required."}, status=400)

    if not request.user.check_password(current_password):
        return Response({"error": "Wrong current password."}, status=400)

    try:
        validate_password(new_password, request.user)
    except DjangoValidationError as exc:
        return Response({"error": "; ".join(exc.messages)}, status=400)

    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])
    return Response({"message": "Password updated successfully."})
