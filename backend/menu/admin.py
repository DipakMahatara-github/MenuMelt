from django.contrib import admin

from .models import MenuCategory, MenuItem, MenuOffer, MenuOfferItem


@admin.register(MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "restaurant", "sort_order")
    list_filter = ("restaurant",)
    search_fields = ("name",)


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ("name", "variant_label", "price", "category", "is_available", "created_at")
    list_filter = ("category", "is_available")
    search_fields = ("name", "variant_label")


class MenuOfferItemInline(admin.TabularInline):
    model = MenuOfferItem
    extra = 0


@admin.register(MenuOffer)
class MenuOfferAdmin(admin.ModelAdmin):
    list_display = ("name", "restaurant", "offer_type", "is_active", "starts_at", "ends_at", "created_at")
    list_filter = ("restaurant", "offer_type", "is_active")
    search_fields = ("name", "badge_text")
    inlines = [MenuOfferItemInline]
