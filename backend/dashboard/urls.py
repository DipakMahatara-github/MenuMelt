from django.urls import path

from .views import dashboard_stats, payment_config_view

urlpatterns = [
    path("", dashboard_stats),
    path("payment-config/", payment_config_view),
]