from rest_framework.exceptions import PermissionDenied
from tables.models import Table


def resolve_restaurant(request):
    user = request.user

    table_token = request.headers.get("X-Table-Token")
    # Table token must take precedence for QR customer flow, even if
    # an auth token is also present in browser storage.
    if table_token:
        try:
            table = Table.objects.select_related("restaurant").get(qr_code=table_token)
        except Table.DoesNotExist as exc:
            raise PermissionDenied("Invalid table token") from exc
        return table.restaurant

    if user and user.is_authenticated:
        return user.restaurant

    raise PermissionDenied("Table token required")
