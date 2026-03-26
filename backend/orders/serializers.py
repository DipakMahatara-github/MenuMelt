from rest_framework import serializers
from .models import Order, OrderItem


# ================= ORDER ITEM =================
class OrderItemSerializer(serializers.ModelSerializer):

    # 🔥 ADD ITEM NAME (IMPORTANT FIX)
    item_name = serializers.CharField(source="menu_item.name", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["menu_item", "item_name", "quantity"]


# ================= ORDER =================
class OrderSerializer(serializers.ModelSerializer):

    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = ["id", "table", "items", "status", "created_at"]

    def create(self, validated_data):

        items_data = validated_data.pop("items")

        # Create Order
        order = Order.objects.create(**validated_data)

        # Create Order Items
        for item in items_data:
            OrderItem.objects.create(
                order=order,
                menu_item=item["menu_item"],
                quantity=item["quantity"]
            )

        return order