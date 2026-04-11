import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("menu", "0003_menuitem_price_column"),
    ]

    operations = [
        migrations.CreateModel(
            name="MenuItemSize",
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
                ("label", models.CharField(max_length=50)),
                ("price", models.DecimalField(decimal_places=2, max_digits=8)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "menu_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sizes",
                        to="menu.menuitem",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="menuitemsize",
            constraint=models.UniqueConstraint(
                fields=("menu_item", "label"),
                name="menu_unique_size_label_per_item",
            ),
        ),
    ]
