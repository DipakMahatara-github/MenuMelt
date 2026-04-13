from django.db import migrations, models


def backfill_billing_status(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    for order in Order.objects.all().iterator():
        payment_status = (order.payment_status or "").strip()
        payment_method = (order.payment_method or "").strip()

        if payment_status == "paid":
            order.billing_status = "paid"
        elif payment_status == "failed":
            order.billing_status = "failed"
        elif payment_method:
            order.billing_status = "pending_payment"
        else:
            order.billing_status = "unbilled"

        order.save(update_fields=["billing_status"])


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0010_order_confirmed_for_kitchen"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="billing_status",
            field=models.CharField(
                choices=[
                    ("unbilled", "Unbilled"),
                    ("billed", "Billed"),
                    ("pending_payment", "Pending Payment"),
                    ("paid", "Paid"),
                    ("failed", "Failed"),
                    ("refunded", "Refunded"),
                ],
                default="unbilled",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="billed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="paid_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="refunded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_billing_status, migrations.RunPython.noop),
    ]
