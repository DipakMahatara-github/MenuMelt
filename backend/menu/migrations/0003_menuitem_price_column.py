# Drifted DBs may be missing `price` after partial / alternate migrations.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("menu", "0002_menucategory_and_item_refactor"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE menu_menuitem ADD COLUMN IF NOT EXISTS price numeric(10, 2);
            UPDATE menu_menuitem SET price = COALESCE(price, 0);
            ALTER TABLE menu_menuitem ALTER COLUMN price SET DEFAULT 0;
            ALTER TABLE menu_menuitem ALTER COLUMN price SET NOT NULL;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
