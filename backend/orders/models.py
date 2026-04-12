from decimal import Decimal

from django.db import models

from menu.models import MenuItem
from restaurants.models import Restaurant
from tables.models import Table


class Order(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PREPARING = "preparing"
    STATUS_SERVED = "served"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_PREPARING, "Preparing"),
        (STATUS_SERVED, "Served"),
    )

    PAYMENT_CASH = "cash"
    PAYMENT_ESEWA = "esewa"
    PAYMENT_METHOD_CHOICES = (
        (PAYMENT_CASH, "Cash"),
        (PAYMENT_ESEWA, "eSewa"),
    )

    PAYMENT_ST_PENDING = "pending"
    PAYMENT_ST_PAID = "paid"
    PAYMENT_ST_FAILED = "failed"
    PAYMENT_STATUS_CHOICES = (
        (PAYMENT_ST_PENDING, "Pending"),
        (PAYMENT_ST_PAID, "Paid"),
        (PAYMENT_ST_FAILED, "Failed"),
    )

    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="orders",
    )
    table = models.ForeignKey(
        Table,
        on_delete=models.CASCADE,
        related_name="orders",
    )
    session_id = models.CharField(max_length=64, db_index=True)
    customer_name = models.CharField(max_length=255)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    payment_method = models.CharField(
        max_length=16,
        choices=PAYMENT_METHOD_CHOICES,
        blank=True,
        null=True,
    )
    payment_status = models.CharField(
        max_length=16,
        choices=PAYMENT_STATUS_CHOICES,
        default=PAYMENT_ST_PENDING,
    )
    esewa_transaction_uuid = models.CharField(max_length=128, blank=True, default="")
    esewa_pay_total_amount = models.CharField(max_length=24, blank=True, null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    # Staff releases to kitchen; kitchen role only sees orders after this is set.
    confirmed_for_kitchen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Order {self.pk} · Table {self.table.number}"


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )
    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Unit price at time of order (from menu at checkout; never from client)",
    )

    def line_total(self) -> Decimal:
        return self.unit_price * self.quantity

    def __str__(self):
        return f"{self.menu_item.name} x {self.quantity}"
