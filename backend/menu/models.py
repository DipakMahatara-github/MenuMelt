from django.db import models


class MenuCategory(models.Model):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="menu_categories",
    )
    name = models.CharField(max_length=100)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["restaurant", "name"],
                name="menu_unique_category_name_per_restaurant",
            )
        ]

    def __str__(self):
        return self.name


class MenuItem(models.Model):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="menu_items",
    )
    category = models.ForeignKey(
        MenuCategory,
        on_delete=models.PROTECT,
        related_name="items",
    )

    name = models.CharField(max_length=200)
    variant_label = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Optional: Small, Large, etc. Same dish name can repeat per category with different variants.",
    )
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    image = models.ImageField(upload_to="menu/", blank=True, null=True)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["category__sort_order", "category__name", "name", "variant_label"]
        constraints = [
            models.UniqueConstraint(
                fields=["category", "name", "variant_label"],
                name="menu_unique_item_name_variant_per_category",
            )
        ]

    def __str__(self):
        if self.variant_label:
            return f"{self.name} ({self.variant_label})"
        return self.name


class MenuItemCustomizationGroup(models.Model):
    MODE_SINGLE = "single"
    MODE_MULTIPLE = "multiple"
    MODE_CHOICES = (
        (MODE_SINGLE, "Single choice"),
        (MODE_MULTIPLE, "Multiple choice"),
    )

    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name="customization_groups",
    )
    name = models.CharField(max_length=100)
    selection_mode = models.CharField(max_length=16, choices=MODE_CHOICES, default=MODE_SINGLE)
    is_required = models.BooleanField(default=False)
    max_select = models.PositiveSmallIntegerField(default=1)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["menu_item", "name"],
                name="menu_unique_customization_group_name_per_item",
            )
        ]

    def __str__(self):
        return f"{self.menu_item} · {self.name}"


class MenuItemCustomizationOption(models.Model):
    group = models.ForeignKey(
        MenuItemCustomizationGroup,
        on_delete=models.CASCADE,
        related_name="options",
    )
    name = models.CharField(max_length=100)
    price_delta = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["group", "name"],
                name="menu_unique_customization_option_name_per_group",
            )
        ]

    def __str__(self):
        return f"{self.group} · {self.name}"


class MenuOffer(models.Model):
    TYPE_FIXED = "fixed"
    TYPE_PERCENTAGE = "percentage"
    TYPE_COMBO = "combo"
    TYPE_CHOICES = (
        (TYPE_FIXED, "Fixed discount"),
        (TYPE_PERCENTAGE, "Percentage discount"),
        (TYPE_COMBO, "Combo / special meal"),
    )

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="menu_offers",
    )
    name = models.CharField(max_length=120)
    offer_type = models.CharField(max_length=16, choices=TYPE_CHOICES)
    description = models.TextField(blank=True, default="")
    badge_text = models.CharField(max_length=40, blank=True, default="")
    is_active = models.BooleanField(default=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    fixed_discount_amount = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    percentage_discount = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    combo_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "name"]

    def __str__(self):
        return self.name


class MenuOfferItem(models.Model):
    offer = models.ForeignKey(
        MenuOffer,
        on_delete=models.CASCADE,
        related_name="items",
    )
    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name="offer_links",
    )
    quantity = models.PositiveSmallIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["offer", "menu_item"],
                name="menu_unique_offer_item_per_offer",
            )
        ]
        ordering = ["id"]

    def __str__(self):
        return f"{self.offer} · {self.menu_item} x {self.quantity}"
