from django.contrib import admin

from .models import PlatformSettings


@admin.register(PlatformSettings)
class PlatformSettingsAdmin(admin.ModelAdmin):
    list_display = ("id", "allow_restaurant_registration", "updated_at")
