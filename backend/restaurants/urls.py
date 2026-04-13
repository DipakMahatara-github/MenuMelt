from django.urls import path

from .views import (
    admin_subscription_overview,
    admin_subscription_update,
    subscription_checkout,
    subscription_current,
    subscription_plans,
    subscription_verify,
)

urlpatterns = [
    path("subscription/plans/", subscription_plans),
    path("subscription/current/", subscription_current),
    path("subscription/checkout/", subscription_checkout),
    path("subscription/verify/", subscription_verify),
    path("admin/subscriptions/", admin_subscription_overview),
    path("admin/subscriptions/<int:subscription_id>/", admin_subscription_update),
]
