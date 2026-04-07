from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Order, OrderItem
from .serializers import OrderSerializer
from tables.models import Table
from menu.models import MenuItem


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def orders_collection(request):
    if not request.user.restaurant_id:
        return Response({"error": "No restaurant assigned to user"}, status=400)

    if request.method == "GET":
        orders = (
            Order.objects
            .filter(restaurant_id=request.user.restaurant_id)
            .order_by("-created_at")
        )
        return Response(OrderSerializer(orders, many=True).data)

    try:
        table_id = request.data.get("table_id")
        table_number = request.data.get("table")
        items = request.data.get("items")

        if not items:
            return Response({"error": "Missing data"}, status=400)

        if table_id:
            table = Table.objects.get(id=table_id)
        elif table_number:
            table = Table.objects.get(number=table_number, restaurant_id=request.user.restaurant_id)
        else:
            return Response({"error": "Missing table info"}, status=400)

        restaurant = table.restaurant

        if not request.user.restaurant_id:
            return Response({"error": "No restaurant assigned to user"}, status=400)

        if request.user.restaurant_id != restaurant.id:
            return Response({"error": "You cannot create orders for another restaurant"}, status=403)

        # ✅ Create order
        order = Order.objects.create(
            restaurant=restaurant,
            table=table.number,
            status="pending"
        )

        # ✅ Create order items
        for item in items:
            menu_item = MenuItem.objects.get(id=item["menu_item"], restaurant=restaurant)

            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=item["quantity"]
            )

        return Response({
            "message": "Order placed successfully",
            "order_id": order.id
        }, status=201)

    except Table.DoesNotExist:
        return Response({"error": "Table not found"}, status=404)
    except MenuItem.DoesNotExist:
        return Response({"error": "Menu item not found for this restaurant"}, status=404)

    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_order_status(request, order_id):
    if not request.user.restaurant_id:
        return Response({"error": "No restaurant assigned to user"}, status=400)

    try:
        order = Order.objects.get(id=order_id, restaurant_id=request.user.restaurant_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    status_value = request.data.get("status")
    if not status_value:
        return Response({"error": "Missing status"}, status=400)

    order.status = status_value
    order.save(update_fields=["status"])
    return Response({"message": "Order updated", "status": order.status})