from django.conf import settings


def table_menu_qr_url(table) -> str:
    """QR target: FRONTEND_URL from backend/.env (ngrok HTTPS) + /menu?table_token=..."""
    base = (settings.FRONTEND_URL or "").rstrip("/")
    return f"{base}/menu?table_token={table.qr_code}"
