from django.db import migrations, models


def migrate_staff_to_waiter(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(role="staff").update(role="waiter")


def migrate_waiter_to_staff(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(role="waiter").update(role="staff")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Platform Admin"),
                    ("restaurant_admin", "Restaurant Admin"),
                    ("waiter", "Waiter"),
                    ("cashier", "Cashier"),
                    ("kitchen", "Kitchen Staff"),
                    ("customer", "Customer"),
                ],
                default="customer",
                max_length=20,
            ),
        ),
        migrations.RunPython(migrate_staff_to_waiter, migrate_waiter_to_staff),
    ]
