from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from tables.models import Table

# Matches Order.session_id max_length
_MAX_SESSION_ID_LEN = 64


def _query_param(request, key: str):
    qp = getattr(request, "query_params", None)
    if qp is not None:
        return qp.get(key)
    return request.GET.get(key)


def _table_token_from_request(request) -> str:
    """Header (preferred), then query param, then cookie."""
    raw = (
        request.headers.get("X-Table-Token")
        or _query_param(request, "table_token")
        or request.COOKIES.get("table_token")
    )
    return (raw or "").strip()


def _session_raw_from_request(request) -> str:
    """Header (preferred), then query param, then cookie."""
    raw = (
        request.headers.get("X-Session-Id")
        or _query_param(request, "session_id")
        or request.COOKIES.get("session_id")
    )
    return (raw or "").strip()


def resolve_customer_table_and_session(request) -> tuple[bool, Table | None, str | None, Response | None]:
    """
    Resolve table QR token and anonymous session for customer APIs.

    Returns (ok, table, session_id, error_response).
    On success: (True, table, session_id, None).
    On failure: (False, None, None, Response(...)).
    """
    token = _table_token_from_request(request)
    if not token:
        return False, None, None, Response(
            {"error": "Invalid or missing table"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        table = Table.objects.select_related("restaurant").get(qr_code=token)
    except (Table.DoesNotExist, ValueError):
        return False, None, None, Response(
            {"error": "Invalid or missing table"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    session_id = _session_raw_from_request(request)
    if not session_id:
        return False, None, None, Response(
            {"error": "Invalid or missing session"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(session_id) > _MAX_SESSION_ID_LEN:
        return False, None, None, Response(
            {"error": "Invalid or missing session"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return True, table, session_id, None


def assert_customer_can_access_order(order, table: Table, session_id: str) -> None:
    if order.table_id != table.id:
        raise PermissionDenied("Order does not belong to this table.")
    if order.session_id != session_id:
        raise PermissionDenied("Order does not belong to this session.")
