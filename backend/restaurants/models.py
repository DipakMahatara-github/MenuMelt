from django.db import models
from django.conf import settings
from django.utils import timezone


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

    @property
    def current_subscription(self):
        return self.subscriptions.order_by("-created_at").first()

    @property
    def current_subscription_status(self):
        sub = self.current_subscription
        if not sub:
            return "inactive"
        if sub.status == RestaurantSubscription.STATUS_ACTIVE and sub.ends_at and sub.ends_at < timezone.now():
            return RestaurantSubscription.STATUS_EXPIRED
        return sub.status


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


class SubscriptionPlan(models.Model):
    code = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_days = models.PositiveIntegerField()
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "price", "name"]

    def __str__(self):
        return f"{self.name} ({self.price})"


class RestaurantSubscription(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACTIVE = "active"
    STATUS_FAILED = "failed"
    STATUS_EXPIRED = "expired"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_FAILED, "Failed"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_CANCELLED, "Cancelled"),
    )

    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name="subscriptions",
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.restaurant.name} · {self.plan.name} · {self.status}"


class SubscriptionPayment(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_PAID, "Paid"),
        (STATUS_FAILED, "Failed"),
    )

    PROVIDER_ESEWA = "esewa"
    PROVIDER_CHOICES = ((PROVIDER_ESEWA, "eSewa"),)

    subscription = models.ForeignKey(
        RestaurantSubscription,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    provider = models.CharField(max_length=32, choices=PROVIDER_CHOICES, default=PROVIDER_ESEWA)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    transaction_uuid = models.CharField(max_length=128, unique=True)
    esewa_total_amount = models.CharField(max_length=24, blank=True, default="")
    raw_response = models.JSONField(blank=True, null=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.subscription.restaurant.name} · {self.amount} · {self.status}"
