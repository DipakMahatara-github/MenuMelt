from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0009_order_esewa_pay_total_amount_nullable"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="confirmed_for_kitchen_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
