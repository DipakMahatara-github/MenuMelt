from rest_framework import serializers
from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):

    class Meta:
        model = OrderItem
        fields = ["menu_item", "quantity"]


class OrderSerializer(serializers.ModelSerializer):

    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = ["id", "table", "items", "status", "created_at"]

    def create(self, validated_data):

        items_data = validated_data.pop("items")

        order = Order.objects.create(**validated_data)

        for item in items_data:

            OrderItem.objects.create(
                order=order,
                menu_item=item["menu_item"],
                quantity=item["quantity"]
            )

        return order