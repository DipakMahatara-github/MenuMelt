# Add variant_label; split MenuItemSize rows into separate MenuItems; drop MenuItemSize.

from django.db import migrations, models


def split_sized_items_into_rows(apps, schema_editor):
    MenuItem = apps.get_model("menu", "MenuItem")
    MenuItemSize = apps.get_model("menu", "MenuItemSize")

    parent_ids = (
        MenuItemSize.objects.values_list("menu_item_id", flat=True).distinct().order_by()
    )
    for parent_id in parent_ids:
        try:
            item = MenuItem.objects.get(pk=parent_id)
        except MenuItem.DoesNotExist:
            continue
        sizes = list(
            MenuItemSize.objects.filter(menu_item_id=parent_id).order_by("sort_order", "id")
        )
        if not sizes:
            continue
        used_counts = {}
        for i, sz in enumerate(sizes):
            base = (sz.label or "").strip()[:50] or f"Option {i + 1}"
            key = base.lower()
            c = used_counts.get(key, 0)
            used_counts[key] = c + 1
            label = base if c == 0 else f"{base[:40]} ({c + 1})"
            MenuItem.objects.create(
                restaurant_id=item.restaurant_id,
                category_id=item.category_id,
                name=item.name,
                variant_label=label,
                description=item.description or "",
                price=sz.price,
                image=item.image,
                is_available=item.is_available,
            )
        item.delete()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    # PostgreSQL: RunPython + constraint DDL in one transaction can raise
    # "cannot ALTER TABLE ... pending trigger events". Commit between steps.
    atomic = False

    dependencies = [
        ("menu", "0005_drop_legacy_menu_variant"),
    ]

    operations = [
        migrations.AddField(
            model_name="menuitem",
            name="variant_label",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.RemoveConstraint(
            model_name="menuitem",
            name="menu_unique_item_name_per_category",
        ),
        migrations.RunPython(split_sized_items_into_rows, noop_reverse),
        migrations.DeleteModel(
            name="MenuItemSize",
        ),
        migrations.AddConstraint(
            model_name="menuitem",
            constraint=models.UniqueConstraint(
                fields=("category", "name", "variant_label"),
                name="menu_unique_item_name_variant_per_category",
            ),
        ),
        migrations.AlterModelOptions(
            name="menuitem",
            options={
                "ordering": [
                    "category__sort_order",
                    "category__name",
                    "name",
                    "variant_label",
                ],
            },
        ),
    ]
