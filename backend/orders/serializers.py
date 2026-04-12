from decimal import Decimal

from rest_framework import serializers

from menu.models import MenuItem
from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="menu_item.name", read_only=True)
    # API keeps "price" for clients; DB field is unit_price
    price = serializers.DecimalField(
        source="unit_price",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = OrderItem
        fields = ["id", "menu_item", "item_name", "quantity", "price"]


class OrderSerializer(serializers.ModelSerializer):
    """Restaurant admin / staff / kitchen list."""

    items = OrderItemSerializer(many=True, read_only=True)
    table_number = serializers.IntegerField(source="table.number", read_only=True)
    confirmed_for_kitchen = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "table_number",
            "items",
            "status",
            "customer_name",
            "session_id",
            "total_price",
            "payment_method",
            "payment_status",
            "confirmed_for_kitchen_at",
            "confirmed_for_kitchen",
            "created_at",
        ]
        read_only_fields = fields

    def get_confirmed_for_kitchen(self, obj) -> bool:
        return obj.confirmed_for_kitchen_at is not None


class CustomerOrderSummarySerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    table_number = serializers.IntegerField(source="table.number", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "table_number",
            "customer_name",
            "total_price",
            "payment_method",
            "payment_status",
            "status",
            "created_at",
            "items",
        ]


class CustomerOrderCreateItemSerializer(serializers.Serializer):
    menu_item = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class CustomerOrderCreateSerializer(serializers.Serializer):
    customer_name = serializers.CharField(max_length=255)
    items = CustomerOrderCreateItemSerializer(many=True)

    def validate_customer_name(self, value):
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("Customer name is required.")
        return name[:255]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required.")
        return value
