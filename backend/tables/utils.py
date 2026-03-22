import qrcode
from io import BytesIO
from django.core.files.base import ContentFile
from django.conf import settings


def generate_qr_code(table):

    # ❌ NO fallback — force correct value
    base_url = settings.FRONTEND_URL

    print("🔥 USING BASE URL:", base_url)

    qr_data = f"{base_url}/menu/{table.id}?table={table.number}"

    qr = qrcode.make(qr_data)

    buffer = BytesIO()
    qr.save(buffer, format='PNG')

    file_name = f"table_{table.number}.png"

    table.qr_code.save(
        file_name,
        ContentFile(buffer.getvalue()),
        save=False
    )