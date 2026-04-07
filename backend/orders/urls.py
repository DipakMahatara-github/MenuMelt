from django.urls import path
from .views import orders_collection, update_order_status

urlpatterns = [
    path("", orders_collection),
    path("<int:order_id>/status/", update_order_status),
    path("create/", orders_collection),
]