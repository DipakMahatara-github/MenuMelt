from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from django.db.models import Avg, Count, Sum
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from orders.models import Order, OrderItem, OrderReview
from restaurants.models import PaymentConfig
from tables.models import Table


def _resolve_user_restaurant(user):
    restaurant = getattr(user, "restaurant", None)
    if restaurant:
        return restaurant
    try:
        return user.owned_restaurant
    except Exception:
        return None


class PaymentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentConfig
        fields = ["provider", "merchant_id", "secret_key", "updated_at"]
        read_only_fields = ["provider", "updated_at"]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):

    try:
        restaurant = _resolve_user_restaurant(request.user)

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
        for order in orders.filter(billing_status=Order.BILLING_ST_PAID):
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
            for o in orders.filter(created_at__date=day, billing_status=Order.BILLING_ST_PAID):
                day_total += o.total_price

            daily_data.append(
                {
                    "date": day.strftime("%d %b"),
                    "revenue": float(day_total),
                }
            )

        # New Customers (Distinct session_id in the last 30 days)
        new_customers = orders.filter(created_at__gte=today - timedelta(days=30)).values("session_id").distinct().count()

        # Average Order Value (total)
        avg_order_value = orders.filter(billing_status=Order.BILLING_ST_PAID).aggregate(Avg("total_price"))["total_price__avg"] or str(Decimal("0.00"))
        
        # Table Occupancy
        total_tables = Table.objects.filter(restaurant=restaurant).count()
        empty_tables = max(0, total_tables - active_tables)
        table_occupancy = {
            "occupied": active_tables,
            "empty": empty_tables
        }

        # Popular Items
        popular_items_qs = OrderItem.objects.filter(
            order__restaurant=restaurant,
            order__billing_status=Order.BILLING_ST_PAID
        ).values(
            "menu_item__id", "menu_item__name", "menu_item__price", "menu_item__image"
        ).annotate(
            total_qty=Sum("quantity")
        ).order_by("-total_qty")[:6]

        popular_items = []
        for item in popular_items_qs:
            image_url = ""
            if item["menu_item__image"]:
                image_url = f"/media/{item['menu_item__image']}" 
            popular_items.append({
                "id": item["menu_item__id"],
                "name": item["menu_item__name"],
                "price": float(item["menu_item__price"]),
                "image": image_url
            })

        review_summary = OrderReview.objects.filter(restaurant=restaurant).aggregate(
            review_count=Count("id"),
            average_overall=Avg("overall_experience"),
            average_food=Avg("food_quality"),
            average_service=Avg("service"),
        )
        recent_reviews = (
            OrderReview.objects.filter(restaurant=restaurant)
            .select_related("order")
            .order_by("-created_at")[:5]
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
                "new_customers": new_customers,
                "avg_order_value": float(avg_order_value),
                "table_occupancy": table_occupancy,
                "popular_items": popular_items,
                "reviews": {
                    "count": int(review_summary.get("review_count") or 0),
                    "average_overall": float(review_summary["average_overall"]) if review_summary.get("average_overall") is not None else None,
                    "average_food": float(review_summary["average_food"]) if review_summary.get("average_food") is not None else None,
                    "average_service": float(review_summary["average_service"]) if review_summary.get("average_service") is not None else None,
                    "recent": [
                        {
                            "id": review.id,
                            "order_id": review.order_id,
                            "customer_name": review.customer_name,
                            "food_quality": review.food_quality,
                            "service": review.service,
                            "overall_experience": review.overall_experience,
                            "comment": review.comment,
                            "created_at": review.created_at.isoformat(),
                        }
                        for review in recent_reviews
                    ],
                },
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
    restaurant = _resolve_user_restaurant(user)
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
