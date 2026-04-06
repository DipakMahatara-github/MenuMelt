from django.db import models
import uuid


class Table(models.Model):

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="tables"
    )

    number = models.IntegerField()

    # 🔥 ADD THIS
    qr_code = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    class Meta:
        unique_together = ("restaurant", "number")

    def __str__(self):
        return f"{self.restaurant.name} - Table {self.number}"