from django.urls import path

from .views import (
    confirm_order_for_kitchen,
    orders_collection,
    orders_my,
    pay_cash,
    pay_esewa,
    update_order_status,
    verify_esewa,
    verify_esewa_global,
)

urlpatterns = [
    path("my/", orders_my),
    path("verify-esewa/", verify_esewa_global),
    path("<int:order_id>/confirm-kitchen/", confirm_order_for_kitchen),
    path("<int:order_id>/status/", update_order_status),
    path("<int:order_id>/pay-cash/", pay_cash),
    path("<int:order_id>/pay-esewa/", pay_esewa),
    path("<int:order_id>/verify-esewa/", verify_esewa),
    path("", orders_collection),
]
