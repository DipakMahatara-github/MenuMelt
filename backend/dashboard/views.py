from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from orders.models import Order


@api_view(["GET"])
def dashboard_stats(request):

    try:
        today = timezone.now().date()
        orders = Order.objects.all()

        # ===== STATS =====
        today_orders = orders.filter(created_at__date=today).count()
        pending_orders = orders.filter(status="pending").count()
        active_tables = orders.exclude(status="completed").values("table").distinct().count()

        # ===== REVENUE =====
        revenue = 0
        for order in orders:
            if order.status == "completed":
                for item in order.items.all():
                    revenue += item.menu_item.price * item.quantity

        # ===== RECENT ORDERS =====
        recent_orders = orders.order_by("-created_at")[:5]

        recent_data = []
        for o in recent_orders:

            total = 0
            items_list = []

            for item in o.items.all():
                total += item.menu_item.price * item.quantity
                items_list.append(f"{item.menu_item.name} x {item.quantity}")

            recent_data.append({
                "id": o.id,
                "table": o.table,
                "items": ", ".join(items_list),
                "status": o.status,
                "amount": total
            })

        # ===== CHART DATA (LAST 7 DAYS) =====
        daily_data = []

        for i in range(6, -1, -1):
            day = today - timedelta(days=i)

            day_orders = orders.filter(
                created_at__date=day,
                status="completed"
            )

            total = 0
            for o in day_orders:
                for item in o.items.all():
                    total += item.menu_item.price * item.quantity

            daily_data.append({
                "date": day.strftime("%d %b"),
                "revenue": total
            })

        return Response({
            "today_orders": today_orders,
            "pending_orders": pending_orders,
            "active_tables": active_tables,
            "revenue": revenue,
            "recent_orders": recent_data,
            "chart_data": daily_data
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)