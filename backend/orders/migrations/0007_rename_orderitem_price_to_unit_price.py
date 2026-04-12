# Align ORM field unit_price with database (handles both price→unit_price rename and existing unit_price).

from django.db import migrations


def sync_orderitem_price_column(apps, schema_editor):
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'orders_orderitem'
            """
        )
        cols = {row[0] for row in cursor.fetchall()}

    with conn.cursor() as cursor:
        if "price" in cols and "unit_price" not in cols:
            cursor.execute('ALTER TABLE orders_orderitem RENAME COLUMN price TO unit_price')
        elif "price" in cols and "unit_price" in cols:
            cursor.execute("ALTER TABLE orders_orderitem DROP COLUMN price")


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0006_order_table_fk_data"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RenameField(
                    model_name="orderitem",
                    old_name="price",
                    new_name="unit_price",
                ),
            ],
            database_operations=[
                migrations.RunPython(sync_orderitem_price_column, migrations.RunPython.noop),
            ],
        ),
    ]
