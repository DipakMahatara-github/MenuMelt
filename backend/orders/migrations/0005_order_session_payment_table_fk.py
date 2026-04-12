# Schema only: new order fields + temporary FK column new_table_id (data in 0006)

import django.db.models.deletion
from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0004_remove_order_customer"),
        ("tables", "0005_table_qr_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="orderitem",
            name="price",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Unit price at time of order",
                max_digits=10,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="order",
            name="session_id",
            field=models.CharField(db_index=True, default="", max_length=64),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="order",
            name="customer_name",
            field=models.CharField(default="Guest", max_length=255),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="order",
            name="total_price",
            field=models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=10),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="order",
            name="payment_method",
            field=models.CharField(
                blank=True,
                choices=[("cash", "Cash"), ("esewa", "eSewa")],
                max_length=16,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("paid", "Paid"),
                    ("failed", "Failed"),
                ],
                default="pending",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="esewa_transaction_uuid",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="order",
            name="new_table",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="orders_m2",
                to="tables.table",
                db_column="new_table_id",
            ),
        ),
    ]
