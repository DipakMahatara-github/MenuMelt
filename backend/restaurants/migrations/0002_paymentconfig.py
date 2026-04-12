# Generated manually for MenuMelt payment settings

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("restaurants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="PaymentConfig",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "provider",
                    models.CharField(
                        choices=[("esewa", "eSewa")],
                        default="esewa",
                        max_length=32,
                    ),
                ),
                (
                    "merchant_id",
                    models.CharField(
                        help_text="eSewa product_code / merchant code",
                        max_length=128,
                    ),
                ),
                ("secret_key", models.CharField(max_length=256)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "restaurant",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="payment_config",
                        to="restaurants.restaurant",
                    ),
                ),
            ],
        ),
    ]
