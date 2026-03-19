import qrcode
from io import BytesIO
from django.core.files.base import ContentFile

def generate_qr_code(table):
    qr_data = f"http://127.0.0.1:5173/menu/{table.id}?table={table.number}"

    qr = qrcode.make(qr_data)

    buffer = BytesIO()
    qr.save(buffer, format='PNG')

    file_name = f"table_{table.number}.png"   

    table.qr_code.save(
        file_name,
        ContentFile(buffer.getvalue()),
        save=False
    )