from django.contrib import admin
from .models import MenuItem

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "category", "available")
    list_filter = ("category", "available")
    search_fields = ("name",)
