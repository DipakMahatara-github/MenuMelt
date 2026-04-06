from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Order, OrderItem
from tables.models import Table
from menu.models import MenuItem


@api_view(["POST"])
def create_order(request):

    try:
        table_id = request.data.get("table_id")
        items = request.data.get("items")

        if not table_id or not items:
            return Response({"error": "Missing data"}, status=400)

        table = Table.objects.get(id=table_id)
        restaurant = table.restaurant

        # ✅ Create order
        order = Order.objects.create(
            restaurant=restaurant,
            table=table.number,
            status="pending"
        )

        # ✅ Create order items
        for item in items:
            menu_item = MenuItem.objects.get(id=item["menu_item"])

            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=item["quantity"]
            )

        return Response({
            "message": "Order placed successfully",
            "order_id": order.id
        })

    except Table.DoesNotExist:
        return Response({"error": "Table not found"}, status=404)

    except Exception as e:
        return Response({"error": str(e)}, status=500)