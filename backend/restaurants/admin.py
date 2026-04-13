from django.contrib import admin

from .models import PaymentConfig, Restaurant, RestaurantSubscription, SubscriptionPayment, SubscriptionPlan


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_active", "current_subscription_status", "created_at")


@admin.register(PaymentConfig)
class PaymentConfigAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "provider", "merchant_id", "updated_at")


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "price", "duration_days", "is_active", "sort_order")
    list_filter = ("is_active",)


@admin.register(RestaurantSubscription)
class RestaurantSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "plan", "status", "starts_at", "ends_at", "paid_at", "created_at")
    list_filter = ("status", "plan")


@admin.register(SubscriptionPayment)
class SubscriptionPaymentAdmin(admin.ModelAdmin):
    list_display = ("subscription", "provider", "amount", "status", "transaction_uuid", "paid_at", "created_at")
    list_filter = ("status", "provider")
