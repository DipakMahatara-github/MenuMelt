from django.urls import path

from .views import (
    admin_change_password,
    admin_dashboard,
    admin_restaurant_update,
    admin_restaurants,
    admin_settings,
    admin_user_update,
    admin_users,
)

urlpatterns = [
    path("", admin_dashboard),
    path("users/", admin_users),
    path("users/<int:user_id>/", admin_user_update),
    path("restaurants/", admin_restaurants),
    path("restaurants/<int:restaurant_id>/", admin_restaurant_update),
    path("settings/", admin_settings),
    path("settings/change-password/", admin_change_password),
]
