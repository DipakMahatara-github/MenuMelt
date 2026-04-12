# Data migration: fill new_table_id, drop legacy int `table`, rename to table_id, model field `table`

from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


def forwards_fill_order_table_and_totals(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    OrderItem = apps.get_model("orders", "OrderItem")
    Table = apps.get_model("tables", "Table")
    conn = schema_editor.connection

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'orders_order' AND column_name = 'table'
              AND data_type IN ('integer', 'bigint', 'smallint')
            )
            """
        )
        has_legacy_int_table = cursor.fetchone()[0]

    order_rows = []
    with conn.cursor() as cursor:
        if has_legacy_int_table:
            cursor.execute('SELECT id, restaurant_id, "table" FROM orders_order')
            order_rows = cursor.fetchall()
        else:
            cursor.execute("SELECT id, restaurant_id FROM orders_order")
            order_rows = [(r[0], r[1], None) for r in cursor.fetchall()]

    status_map = {
        "pending": "pending",
        "processing": "preparing",
        "preparing": "preparing",
        "accepted": "preparing",
        "completed": "served",
        "done": "served",
    }

    for pk, restaurant_id, table_num in order_rows:
        t = None
        if table_num is not None:
            t = Table.objects.filter(restaurant_id=restaurant_id, number=table_num).first()
        if not t:
            t = Table.objects.filter(restaurant_id=restaurant_id).order_by("id").first()
        if not t:
            raise ValueError(
                f"Migration cannot link Order id={pk}: no Table rows for "
                f"restaurant_id={restaurant_id}. Create tables before migrating."
            )

        order = Order.objects.get(pk=pk)
        mapped = status_map.get(order.status, order.status)
        if mapped not in ("pending", "preparing", "served"):
            mapped = "pending"

        total = Decimal("0")
        for oi in OrderItem.objects.filter(order_id=pk).select_related("menu_item"):
            unit = oi.menu_item.price
            OrderItem.objects.filter(pk=oi.pk).update(price=unit)
            total += unit * oi.quantity

        Order.objects.filter(pk=pk).update(
            new_table_id=t.pk,
            status=mapped,
            total_price=total,
        )


def drop_legacy_int_table_column(apps, schema_editor):
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'orders_order' AND column_name = 'table'
              AND data_type IN ('integer', 'bigint', 'smallint')
            )
            """
        )
        if cursor.fetchone()[0]:
            cursor.execute('ALTER TABLE orders_order DROP COLUMN "table" CASCADE')


def rename_new_table_id_to_table_id(apps, schema_editor):
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'orders_order'
            """
        )
        cols = {r[0] for r in cursor.fetchall()}

    if "new_table_id" not in cols:
        return

    with conn.cursor() as cursor:
        if "table_id" in cols:
            cursor.execute(
                """
                UPDATE orders_order
                SET table_id = new_table_id
                WHERE new_table_id IS NOT NULL
                """
            )
            cursor.execute("ALTER TABLE orders_order DROP COLUMN new_table_id")
        else:
            cursor.execute(
                "ALTER TABLE orders_order RENAME COLUMN new_table_id TO table_id"
            )


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0005_order_session_payment_table_fk"),
    ]

    operations = [
        migrations.RunPython(forwards_fill_order_table_and_totals, migrations.RunPython.noop),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name="order",
                    name="table",
                ),
            ],
            database_operations=[
                migrations.RunPython(
                    drop_legacy_int_table_column,
                    migrations.RunPython.noop,
                ),
            ],
        ),
        migrations.RunPython(rename_new_table_id_to_table_id, migrations.RunPython.noop),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name="order",
                    name="new_table",
                ),
                migrations.AddField(
                    model_name="order",
                    name="table",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="orders",
                        to="tables.table",
                    ),
                ),
            ],
            database_operations=[],
        ),
    ]
