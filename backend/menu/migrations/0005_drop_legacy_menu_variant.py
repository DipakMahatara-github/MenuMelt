# Old installs may still have menu_variant pointing at menu_menuitem, which blocks DELETE.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("menu", "0004_menuitemsize"),
    ]

    operations = [
        migrations.RunSQL(
            sql='DROP TABLE IF EXISTS menu_variant CASCADE;',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
