from django.urls import path
from .views import guest_place_order, orders_collection, update_order_status

urlpatterns = [
    path("", orders_collection),
    path("place/", guest_place_order),
    path("<int:order_id>/status/", update_order_status),
    path("create/", orders_collection),
]