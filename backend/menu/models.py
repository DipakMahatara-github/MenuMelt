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
