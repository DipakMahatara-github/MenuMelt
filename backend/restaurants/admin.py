from django.contrib import admin

from .models import PaymentConfig, Restaurant


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_active", "created_at")


@admin.register(PaymentConfig)
class PaymentConfigAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "provider", "merchant_id", "updated_at")
