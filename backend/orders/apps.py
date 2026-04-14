from pathlib import Path

from django.apps import AppConfig


class OrdersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "orders"
    path = str(Path(__file__).resolve().parent)
