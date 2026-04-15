from django.contrib import admin

from .models import Order, OrderAppliedOffer, OrderItem, OrderItemCustomizationSelection, OrderReview


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("base_unit_price", "unit_price")


class OrderAppliedOfferInline(admin.TabularInline):
    model = OrderAppliedOffer
    extra = 0
    readonly_fields = ("name", "badge_text", "offer_type", "discount_amount")


class OrderReviewInline(admin.StackedInline):
    model = OrderReview
    extra = 0
    readonly_fields = ("session_id", "customer_name", "created_at")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "restaurant",
        "table",
        "customer_name",
        "subtotal_price",
        "discount_total",
        "total_price",
        "payment_method",
        "billing_status",
        "payment_status",
        "status",
        "created_at",
    )
    list_filter = ("status", "billing_status", "payment_status", "payment_method")
    inlines = [OrderItemInline, OrderAppliedOfferInline, OrderReviewInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("order", "menu_item", "quantity", "base_unit_price", "unit_price")


@admin.register(OrderItemCustomizationSelection)
class OrderItemCustomizationSelectionAdmin(admin.ModelAdmin):
    list_display = ("order_item", "group_name", "option_name", "price_delta")


@admin.register(OrderAppliedOffer)
class OrderAppliedOfferAdmin(admin.ModelAdmin):
    list_display = ("order", "name", "offer_type", "discount_amount")


@admin.register(OrderReview)
class OrderReviewAdmin(admin.ModelAdmin):
    list_display = ("order", "restaurant", "food_quality", "service", "overall_experience", "created_at")
