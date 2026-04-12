from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from orders.models import Order
from restaurants.models import PaymentConfig


class PaymentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentConfig
        fields = ["provider", "merchant_id", "secret_key", "updated_at"]
        read_only_fields = ["provider", "updated_at"]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):

    try:
        restaurant = request.user.restaurant

        if not restaurant:
            return Response({"error": "No restaurant assigned"}, status=400)

        today = timezone.now().date()

        orders = Order.objects.filter(restaurant=restaurant)

        today_orders = orders.filter(created_at__date=today).count()
        pending_orders = orders.filter(status=Order.STATUS_PENDING).count()
        awaiting_kitchen = orders.filter(
            confirmed_for_kitchen_at__isnull=True,
            status=Order.STATUS_PENDING,
        ).count()
        active_tables = (
            orders.exclude(status=Order.STATUS_SERVED).values("table_id").distinct().count()
        )

        revenue = Decimal("0")
        for order in orders.filter(payment_status=Order.PAYMENT_ST_PAID):
            revenue += order.total_price

        recent_orders = orders.order_by("-created_at")[:5]

        recent_data = []
        for o in recent_orders:
            items_list = [f"{item.menu_item.name} x {item.quantity}" for item in o.items.all()]
            recent_data.append(
                {
                    "id": o.id,
                    "table": o.table.number,
                    "items": ", ".join(items_list),
                    "status": o.status,
                    "amount": str(o.total_price),
                }
            )

        daily_data = []

        for i in range(6, -1, -1):
            day = today - timedelta(days=i)

            day_total = Decimal("0")
            for o in orders.filter(created_at__date=day, payment_status=Order.PAYMENT_ST_PAID):
                day_total += o.total_price

            daily_data.append(
                {
                    "date": day.strftime("%d %b"),
                    "revenue": float(day_total),
                }
            )

        return Response(
            {
                "today_orders": today_orders,
                "pending_orders": pending_orders,
                "awaiting_kitchen_release": awaiting_kitchen,
                "active_tables": active_tables,
                "revenue": float(revenue),
                "recent_orders": recent_data,
                "chart_data": daily_data,
            }
        )

    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def payment_config_view(request):
    user = request.user
    if getattr(user, "role", None) == "admin":
        return Response({"error": "Platform admin cannot edit payment config here."}, status=403)
    restaurant = user.restaurant
    if not restaurant:
        return Response({"error": "No restaurant assigned"}, status=400)

    cfg, _ = PaymentConfig.objects.get_or_create(
        restaurant=restaurant,
        defaults={
            "provider": PaymentConfig.PROVIDER_ESEWA,
            "merchant_id": "",
            "secret_key": "",
        },
    )

    if request.method == "GET":
        return Response(PaymentConfigSerializer(cfg).data)

    ser = PaymentConfigSerializer(cfg, data=request.data, partial=request.method != "PUT")
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data, status=status.HTTP_200_OK)
