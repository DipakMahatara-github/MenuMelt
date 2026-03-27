from django.urls import path
from .views import login_user, register_user, get_profile, change_password

urlpatterns = [
    path("login/", login_user),
    path("register/", register_user),
    path("profile/", get_profile),
    path("change-password/", change_password),
]