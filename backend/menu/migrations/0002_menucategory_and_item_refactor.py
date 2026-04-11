# MenuCategory + MenuItem.category FK refactor
# Tolerates drifted DBs: missing price, varchar `category` replaced early by `category_id`, etc.

import django.db.models.deletion
from collections import defaultdict

import django.utils.timezone
from django.db import migrations, models


def _menuitem_columns(schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'menu_menuitem'
            """
        )
        return {row[0] for row in cursor.fetchall()}


def forwards_migrate_categories(apps, schema_editor):
    MenuItem = apps.get_model("menu", "MenuItem")
    MenuCategory = apps.get_model("menu", "MenuCategory")
    cols = _menuitem_columns(schema_editor)

    if "category" in cols:
        for row in MenuItem.objects.values("id", "restaurant_id", "category").iterator(
            chunk_size=500
        ):
            raw = (row["category"] or "").strip() or "Uncategorized"
            cat, _ = MenuCategory.objects.get_or_create(
                restaurant_id=row["restaurant_id"],
                name=raw[:100],
                defaults={"sort_order": 0},
            )
            MenuItem.objects.filter(pk=row["id"]).update(category_new_id=cat.id)
        return

    # Drifted schema (e.g. FK category_id but empty / new menu_menucategory table): assign a default bucket.
    for rid in MenuItem.objects.values_list("restaurant_id", flat=True).distinct():
        if rid is None:
            continue
        if not MenuItem.objects.filter(restaurant_id=rid).exists():
            continue
        cat, _ = MenuCategory.objects.get_or_create(
            restaurant_id=rid,
            name="Uncategorized",
            defaults={"sort_order": 0},
        )
        MenuItem.objects.filter(restaurant_id=rid, category_new_id__isnull=True).update(
            category_new_id=cat.id
        )


def forwards_dedupe_names(apps, schema_editor):
    MenuItem = apps.get_model("menu", "MenuItem")
    buckets = defaultdict(list)
    for row in MenuItem.objects.filter(category_new_id__isnull=False).values(
        "id", "category_new_id", "name"
    ):
        buckets[(row["category_new_id"], row["name"])].append(row["id"])
    for (_cid, name), ids in buckets.items():
        if len(ids) <= 1:
            continue
        for i, pk in enumerate(sorted(ids)[1:], start=2):
            base = (name or "Item")[:180]
            MenuItem.objects.filter(pk=pk).update(name=f"{base} ({i})")


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("menu", "0001_initial"),
        ("restaurants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="MenuCategory",
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
                ("name", models.CharField(max_length=100)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "restaurant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="menu_categories",
                        to="restaurants.restaurant",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.AddConstraint(
            model_name="menucategory",
            constraint=models.UniqueConstraint(
                fields=("restaurant", "name"),
                name="menu_unique_category_name_per_restaurant",
            ),
        ),
        migrations.AddField(
            model_name="menuitem",
            name="category_new",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="items_migrating",
                to="menu.menucategory",
            ),
        ),
        migrations.RunPython(forwards_migrate_categories, noop_reverse),
        migrations.RunPython(forwards_dedupe_names, noop_reverse),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="ALTER TABLE menu_menuitem DROP COLUMN IF EXISTS category CASCADE;",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.RemoveField(
                    model_name="menuitem",
                    name="category",
                ),
            ],
        ),
        migrations.RunSQL(
            sql="ALTER TABLE menu_menuitem DROP COLUMN IF EXISTS category_id CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RenameField(
            model_name="menuitem",
            old_name="category_new",
            new_name="category",
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                    DO $rename_avail$
                    BEGIN
                      IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'menu_menuitem'
                          AND column_name = 'available'
                      ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'menu_menuitem'
                          AND column_name = 'is_available'
                      ) THEN
                        ALTER TABLE menu_menuitem RENAME COLUMN available TO is_available;
                      END IF;
                    END
                    $rename_avail$;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.RenameField(
                    model_name="menuitem",
                    old_name="available",
                    new_name="is_available",
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                    ALTER TABLE menu_menuitem
                    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT NOW() NOT NULL;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="menuitem",
                    name="created_at",
                    field=models.DateTimeField(
                        auto_now_add=True,
                        default=django.utils.timezone.now,
                    ),
                    preserve_default=False,
                ),
            ],
        ),
        migrations.AlterField(
            model_name="menuitem",
            name="category",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="items",
                to="menu.menucategory",
            ),
        ),
        migrations.AddConstraint(
            model_name="menuitem",
            constraint=models.UniqueConstraint(
                fields=("category", "name"),
                name="menu_unique_item_name_per_category",
            ),
        ),
        migrations.AlterModelOptions(
            name="menuitem",
            options={
                "ordering": ["category__sort_order", "category__name", "name"],
            },
        ),
    ]
