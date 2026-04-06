from django.db import models
from menu.models import MenuItem
from restaurants.models import Restaurant


class Order(models.Model):

    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="orders"
    )

    table = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    status = models.CharField(
        max_length=20,
        default="pending"
    )

    def __str__(self):
        return f"Table {self.table} - {self.status}"


class OrderItem(models.Model):

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items"
    )

    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE
    )

    quantity = models.IntegerField()

    def __str__(self):
        return f"{self.menu_item.name} x {self.quantity}"