from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
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


@api_view(["POST"])
@permission_classes([AllowAny])
def guest_place_order(request):
    """QR / table guest: create order using X-Table-Token (table QR), no login."""
    token = request.headers.get("X-Table-Token")
    if not token:
        return Response({"error": "Missing table token"}, status=400)
    try:
        table = Table.objects.select_related("restaurant").get(qr_code=token)
    except (Table.DoesNotExist, ValueError):
        return Response({"error": "Invalid or expired table link"}, status=404)

    items = request.data.get("items")
    if not isinstance(items, list) or len(items) == 0:
        return Response({"error": "Add at least one item"}, status=400)

    restaurant = table.restaurant
    try:
        with transaction.atomic():
            order = Order.objects.create(
                restaurant=restaurant,
                table=table.number,
                status="pending",
            )
            for row in items:
                mid = row.get("menu_item")
                if mid is None:
                    raise ValueError("invalid")
                try:
                    qty = int(row.get("quantity", 1))
                except (TypeError, ValueError):
                    raise ValueError("invalid")
                if qty < 1 or qty > 99:
                    raise ValueError("invalid")
                menu_item = MenuItem.objects.get(
                    id=int(mid), restaurant=restaurant, is_available=True
                )
                OrderItem.objects.create(order=order, menu_item=menu_item, quantity=qty)
    except MenuItem.DoesNotExist:
        return Response({"error": "One or more items are unavailable."}, status=400)
    except ValueError:
        return Response({"error": "Invalid order data."}, status=400)

    return Response(
        {"message": "Order placed successfully", "order_id": order.id},
        status=201,
    )


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