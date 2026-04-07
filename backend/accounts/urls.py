from django.urls import path
from .views import login_user, register_user, get_profile, change_password
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("login/", login_user),
    path("register/", register_user),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("profile/", get_profile),
    path("change-password/", change_password),
]