from django.db import models
from django.conf import settings


class Restaurant(models.Model):

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_restaurant",
        limit_choices_to={"role": "restaurant_admin"},
    )

    name = models.CharField(max_length=255)
    address = models.TextField()

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class PaymentConfig(models.Model):
    """Per-restaurant eSewa (or future provider) credentials — never exposed to the client."""

    PROVIDER_ESEWA = "esewa"
    PROVIDER_CHOICES = ((PROVIDER_ESEWA, "eSewa"),)

    restaurant = models.OneToOneField(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="payment_config",
    )
    provider = models.CharField(max_length=32, choices=PROVIDER_CHOICES, default=PROVIDER_ESEWA)
    merchant_id = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="eSewa product_code / merchant code",
    )
    secret_key = models.CharField(max_length=256, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.restaurant.name} · {self.provider}"
