from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("menu", "0008_menuitemcustomizationgroup_menuoffer_menuofferitem_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE menu_menuitem DROP COLUMN IF EXISTS is_popular CASCADE;
            ALTER TABLE menu_menuitem DROP COLUMN IF EXISTS is_special_offer CASCADE;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
