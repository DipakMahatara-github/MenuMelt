from django.db import models
from django.conf import settings

class Restaurant(models.Model):

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,   # 🔥 FIX HERE
        on_delete=models.CASCADE,
        related_name="owned_restaurant",
        limit_choices_to={"role": "restaurant_admin"}
    )

    name = models.CharField(max_length=255)
    address = models.TextField()

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name