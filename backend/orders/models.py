from decimal import Decimal

from django.db import models

from menu.models import MenuItem
from restaurants.models import Restaurant
from tables.models import Table


class Order(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PREPARING = "preparing"
    STATUS_READY = "ready"
    STATUS_SERVED = "served"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_PREPARING, "Preparing"),
        (STATUS_READY, "Ready"),
        (STATUS_SERVED, "Served"),
    )

    PAYMENT_CASH = "cash"
    PAYMENT_KHALTI = "khalti"
    PAYMENT_METHOD_CHOICES = (
        (PAYMENT_CASH, "Cash"),
        (PAYMENT_KHALTI, "Khalti"),
    )

    PAYMENT_ST_PENDING = "pending"
    PAYMENT_ST_PAID = "paid"
    PAYMENT_ST_FAILED = "failed"
    PAYMENT_STATUS_CHOICES = (
        (PAYMENT_ST_PENDING, "Pending"),
        (PAYMENT_ST_PAID, "Paid"),
        (PAYMENT_ST_FAILED, "Failed"),
    )

    BILLING_ST_UNBILLED = "unbilled"
    BILLING_ST_BILLED = "billed"
    BILLING_ST_PENDING_PAYMENT = "pending_payment"
    BILLING_ST_PAID = "paid"
    BILLING_ST_FAILED = "failed"
    BILLING_ST_REFUNDED = "refunded"
    BILLING_STATUS_CHOICES = (
        (BILLING_ST_UNBILLED, "Unbilled"),
        (BILLING_ST_BILLED, "Billed"),
        (BILLING_ST_PENDING_PAYMENT, "Pending Payment"),
        (BILLING_ST_PAID, "Paid"),
        (BILLING_ST_FAILED, "Failed"),
        (BILLING_ST_REFUNDED, "Refunded"),
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
    subtotal_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    discount_total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
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
    billing_status = models.CharField(
        max_length=24,
        choices=BILLING_STATUS_CHOICES,
        default=BILLING_ST_UNBILLED,
    )
    billed_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    khalti_pidx = models.CharField(max_length=255, blank=True, default="")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    # Waiter / restaurant admin releases to kitchen; kitchen role only sees orders after this is set.
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
    base_unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Menu item unit price after item-level offers but before customization extras.",
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Unit price at time of order (from menu at checkout; never from client)",
    )

    def line_total(self) -> Decimal:
        return self.unit_price * self.quantity

    def __str__(self):
        return f"{self.menu_item.name} x {self.quantity}"


class OrderItemCustomizationSelection(models.Model):
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.CASCADE,
        related_name="selected_options",
    )
    customization_option = models.ForeignKey(
        "menu.MenuItemCustomizationOption",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    group_name = models.CharField(max_length=100)
    option_name = models.CharField(max_length=100)
    price_delta = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.order_item} · {self.group_name}: {self.option_name}"


class OrderAppliedOffer(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="applied_offers",
    )
    offer = models.ForeignKey(
        "menu.MenuOffer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    name = models.CharField(max_length=120)
    badge_text = models.CharField(max_length=40, blank=True, default="")
    offer_type = models.CharField(max_length=16)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.order} · {self.name}"


class OrderReview(models.Model):
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="review",
    )
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    session_id = models.CharField(max_length=64, db_index=True)
    customer_name = models.CharField(max_length=255, blank=True, default="")
    # These legacy columns are still required in the live database schema.
    # Keep them in sync so review submission works before a cleanup migration.
    food_quality_legacy = models.PositiveSmallIntegerField(
        db_column="food_quality_rating",
        null=True,
        blank=True,
        editable=False,
    )
    service_legacy = models.PositiveSmallIntegerField(
        db_column="service_rating",
        null=True,
        blank=True,
        editable=False,
    )
    overall_experience_legacy = models.PositiveSmallIntegerField(
        db_column="overall_rating",
        null=True,
        blank=True,
        editable=False,
    )
    food_quality = models.PositiveSmallIntegerField()
    service = models.PositiveSmallIntegerField()
    overall_experience = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["restaurant", "session_id", "order"],
                name="orders_unique_review_session_order",
            )
        ]

    def __str__(self):
        return f"Review for order {self.order_id}"

    def save(self, *args, **kwargs):
        self.food_quality_legacy = self.food_quality
        self.service_legacy = self.service
        self.overall_experience_legacy = self.overall_experience
        super().save(*args, **kwargs)
