from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0011_order_billing_status"),
    ]

    operations = [
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("preparing", "Preparing"),
                    ("ready", "Ready"),
                    ("served", "Served"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]
