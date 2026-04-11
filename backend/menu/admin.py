from django.contrib import admin

from .models import MenuCategory, MenuItem


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
