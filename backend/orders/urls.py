from django.urls import path

from .views import (
    cashier_verify_esewa,
    confirm_order_for_kitchen,
    create_order_review,
    order_quote,
    orders_collection,
    orders_my,
    pay_cash,
    pay_esewa,
    update_order_billing,
    update_order_status,
    verify_esewa,
    verify_esewa_global,
)

urlpatterns = [
    path("my/", orders_my),
    path("quote/", order_quote),
    path("verify-esewa/", verify_esewa_global),
    path("<int:order_id>/review/", create_order_review),
    path("<int:order_id>/billing/", update_order_billing),
    path("<int:order_id>/confirm-kitchen/", confirm_order_for_kitchen),
    path("<int:order_id>/status/", update_order_status),
    path("<int:order_id>/pay-cash/", pay_cash),
    path("<int:order_id>/pay-esewa/", pay_esewa),
    path("<int:order_id>/verify-esewa/", verify_esewa),
    path("<int:order_id>/verify-esewa-status/", cashier_verify_esewa),
    path("", orders_collection),
]
