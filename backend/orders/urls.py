from django.urls import path

from .views import (
    cashier_verify_khalti,
    confirm_order_for_kitchen,
    create_order_review,
    order_quote,
    orders_collection,
    orders_my,
    pay_cash,
    pay_khalti,
    update_order_billing,
    update_order_status,
    verify_khalti,
    verify_khalti_global,
)

urlpatterns = [
    path("my/", orders_my),
    path("quote/", order_quote),
    path("verify-khalti/", verify_khalti_global),
    path("<int:order_id>/review/", create_order_review),
    path("<int:order_id>/billing/", update_order_billing),
    path("<int:order_id>/confirm-kitchen/", confirm_order_for_kitchen),
    path("<int:order_id>/status/", update_order_status),
    path("<int:order_id>/pay-cash/", pay_cash),
    path("<int:order_id>/pay-khalti/", pay_khalti),
    path("<int:order_id>/verify-khalti/", verify_khalti),
    path("<int:order_id>/verify-khalti-status/", cashier_verify_khalti),
    path("", orders_collection),
]
