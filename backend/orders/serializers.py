from decimal import Decimal

from rest_framework import serializers

from .models import (
    Order,
    OrderAppliedOffer,
    OrderItem,
    OrderItemCustomizationSelection,
    OrderReview,
)


class OrderItemCustomizationSelectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItemCustomizationSelection
        fields = ["id", "group_name", "option_name", "price_delta"]


class OrderItemSerializer(serializers.ModelSerializer):
    item_name = serializers.SerializerMethodField()
    # API keeps "price" for clients; DB field is unit_price
    base_price = serializers.DecimalField(
        source="base_unit_price",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    price = serializers.DecimalField(
        source="unit_price",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    selected_options = OrderItemCustomizationSelectionSerializer(many=True, read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ["id", "menu_item", "item_name", "quantity", "base_price", "price", "line_total", "selected_options"]

    def get_item_name(self, obj):
        menu_item = getattr(obj, "menu_item", None)
        if not menu_item:
            return ""
        variant = (menu_item.variant_label or "").strip()
        return f"{menu_item.name} · {variant}" if variant else menu_item.name

    def get_line_total(self, obj):
        return str(obj.line_total())


class OrderAppliedOfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderAppliedOffer
        fields = ["id", "name", "badge_text", "offer_type", "discount_amount"]


class OrderReviewSerializer(serializers.ModelSerializer):
    average_rating = serializers.SerializerMethodField()

    class Meta:
        model = OrderReview
        fields = [
            "id",
            "food_quality",
            "service",
            "overall_experience",
            "average_rating",
            "comment",
            "created_at",
        ]

    def get_average_rating(self, obj):
        avg = (Decimal(obj.food_quality) + Decimal(obj.service) + Decimal(obj.overall_experience)) / Decimal("3")
        return str(avg.quantize(Decimal("0.01")))


class OrderSerializer(serializers.ModelSerializer):
    """Restaurant admin / waiter / cashier / kitchen list."""

    items = OrderItemSerializer(many=True, read_only=True)
    table_number = serializers.IntegerField(source="table.number", read_only=True)
    confirmed_for_kitchen = serializers.SerializerMethodField()
    applied_offers = OrderAppliedOfferSerializer(many=True, read_only=True)
    review = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "table_number",
            "items",
            "status",
            "customer_name",
            "session_id",
            "subtotal_price",
            "discount_total",
            "tax_total",
            "total_price",
            "payment_method",
            "payment_status",
            "billing_status",
            "billed_at",
            "paid_at",
            "refunded_at",
            "applied_offers",
            "review",
            "confirmed_for_kitchen_at",
            "confirmed_for_kitchen",
            "created_at",
        ]
        read_only_fields = fields

    def get_confirmed_for_kitchen(self, obj) -> bool:
        return obj.confirmed_for_kitchen_at is not None

    def get_review(self, obj):
        try:
            review = obj.review
        except OrderReview.DoesNotExist:
            return None
        return OrderReviewSerializer(review).data


class CustomerOrderSummarySerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    table_number = serializers.IntegerField(source="table.number", read_only=True)
    applied_offers = OrderAppliedOfferSerializer(many=True, read_only=True)
    review = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "table_number",
            "customer_name",
            "subtotal_price",
            "discount_total",
            "tax_total",
            "total_price",
            "payment_method",
            "payment_status",
            "billing_status",
            "billed_at",
            "paid_at",
            "refunded_at",
            "status",
            "created_at",
            "items",
            "applied_offers",
            "review",
        ]

    def get_review(self, obj):
        try:
            review = obj.review
        except OrderReview.DoesNotExist:
            return None
        return OrderReviewSerializer(review).data


class CustomerOrderCreateItemSerializer(serializers.Serializer):
    menu_item = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)
    selected_option_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        default=list,
    )

    def validate_selected_option_ids(self, value):
        deduped = []
        seen = set()
        for option_id in value:
            if option_id in seen:
                continue
            seen.add(option_id)
            deduped.append(option_id)
        return deduped


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


class CustomerOrderQuoteSerializer(serializers.Serializer):
    items = CustomerOrderCreateItemSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required.")
        return value


class CustomerOrderReviewCreateSerializer(serializers.Serializer):
    food_quality = serializers.IntegerField(min_value=1, max_value=5)
    service = serializers.IntegerField(min_value=1, max_value=5)
    overall_experience = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate_comment(self, value):
        return (value or "").strip()
