from django.db import migrations, models
import django.db.models.deletion


def seed_subscription_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("restaurants", "SubscriptionPlan")
    plans = [
        {
            "code": "starter-monthly",
            "name": "Starter",
            "price": "999.00",
            "duration_days": 30,
            "description": "QR ordering, menu management, and core floor operations for one restaurant.",
            "sort_order": 1,
        },
        {
            "code": "growth-quarterly",
            "name": "Growth",
            "price": "2799.00",
            "duration_days": 90,
            "description": "Quarterly savings with billing console, kitchen monitor, and analytics.",
            "sort_order": 2,
        },
        {
            "code": "scale-yearly",
            "name": "Scale",
            "price": "9999.00",
            "duration_days": 365,
            "description": "Full-year access for serious restaurant teams running MenuMelt daily.",
            "sort_order": 3,
        },
    ]
    for plan in plans:
        SubscriptionPlan.objects.update_or_create(code=plan["code"], defaults=plan)


class Migration(migrations.Migration):

    dependencies = [
        ("restaurants", "0003_paymentconfig_blank_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="SubscriptionPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.SlugField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=100)),
                ("price", models.DecimalField(decimal_places=2, max_digits=10)),
                ("duration_days", models.PositiveIntegerField()),
                ("description", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["sort_order", "price", "name"]},
        ),
        migrations.CreateModel(
            name="RestaurantSubscription",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("pending", "Pending"), ("active", "Active"), ("failed", "Failed"), ("expired", "Expired"), ("cancelled", "Cancelled")], default="pending", max_length=16)),
                ("starts_at", models.DateTimeField(blank=True, null=True)),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("plan", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="subscriptions", to="restaurants.subscriptionplan")),
                ("restaurant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="subscriptions", to="restaurants.restaurant")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="SubscriptionPayment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(choices=[("esewa", "eSewa")], default="esewa", max_length=32)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=10)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("paid", "Paid"), ("failed", "Failed")], default="pending", max_length=16)),
                ("transaction_uuid", models.CharField(max_length=128, unique=True)),
                ("esewa_total_amount", models.CharField(blank=True, default="", max_length=24)),
                ("raw_response", models.JSONField(blank=True, null=True)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("subscription", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payments", to="restaurants.restaurantsubscription")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.RunPython(seed_subscription_plans, migrations.RunPython.noop),
    ]
