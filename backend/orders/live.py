import asyncio
import json
from typing import Any, Dict, List, Optional, Tuple, Union
from urllib.parse import parse_qs

from asgiref.sync import async_to_sync, sync_to_async
from rest_framework_simplejwt.authentication import JWTAuthentication

from tables.models import Table

from .models import Order
from .serializers import CustomerOrderSummarySerializer, OrderSerializer

_MAX_SESSION_ID_LEN = 64
_STAFF_ROLES = {"restaurant_admin", "waiter", "cashier", "kitchen"}
_connections = {}
_connections_lock = asyncio.Lock()


def _restaurant_group(restaurant_id: int) -> str:
    return f"restaurant:{restaurant_id}"


def _customer_group(table_id: int, session_id: str) -> str:
    return f"customer:{table_id}:{session_id}"


async def _register_connection(groups, queue: asyncio.Queue) -> None:
    async with _connections_lock:
        for group in groups:
            _connections.setdefault(group, set()).add(queue)


async def _unregister_connection(groups, queue: asyncio.Queue) -> None:
    async with _connections_lock:
        for group in groups:
            queues = _connections.get(group)
            if not queues:
                continue
            queues.discard(queue)
            if not queues:
                _connections.pop(group, None)


async def _broadcast_event(groups, event: dict) -> None:
    async with _connections_lock:
        targets = set()
        for group in groups:
            targets.update(_connections.get(group, ()))
    for queue in targets:
        queue.put_nowait(event)


def _build_event_payload(
    order_id: int, event_type: str
) -> Tuple[Optional[List[str]], Optional[Dict[str, Any]]]:
    order = (
        Order.objects.filter(pk=order_id)
        .select_related("table", "restaurant")
        .prefetch_related(
            "applied_offers",
            "review",
            "items__menu_item",
            "items__selected_options",
        )
        .first()
    )
    if not order:
        return None, None

    groups = [
        _restaurant_group(order.restaurant_id),
        _customer_group(order.table_id, order.session_id),
    ]
    event = {
        "type": f"order.{event_type}",
        "order_id": order.id,
        "restaurant_id": order.restaurant_id,
        "table_id": order.table_id,
        "session_id": order.session_id,
        "staff_order": OrderSerializer(order).data,
        "customer_order": CustomerOrderSummarySerializer(order).data,
    }
    return groups, event


async def _broadcast_order_event_async(order_id: int, event_type: str) -> None:
    groups, event = await sync_to_async(_build_event_payload)(order_id, event_type)
    if not groups or not event:
        return
    await _broadcast_event(groups, event)


def publish_order_event(order: Union[Order, int], event_type: str = "updated") -> None:
    order_id = order.pk if isinstance(order, Order) else int(order)
    async_to_sync(_broadcast_order_event_async)(order_id, event_type)


def _authenticate_staff(access_token: str):
    auth = JWTAuthentication()
    validated = auth.get_validated_token(access_token)
    user = auth.get_user(validated)
    if not user or not user.is_active:
        raise PermissionError("Inactive user.")
    if getattr(user, "role", None) not in _STAFF_ROLES:
        raise PermissionError("Staff access required.")
    if not getattr(user, "restaurant_id", None):
        raise PermissionError("No restaurant assigned.")
    return {
        "audience": "staff",
        "groups": [_restaurant_group(user.restaurant_id)],
        "meta": {
            "role": user.role,
            "restaurant_id": user.restaurant_id,
        },
    }


def _authenticate_customer(table_token: str, session_id: str):
    if not session_id or len(session_id) > _MAX_SESSION_ID_LEN:
        raise PermissionError("Invalid customer session.")
    try:
        table = Table.objects.select_related("restaurant").get(qr_code=table_token)
    except (Table.DoesNotExist, ValueError) as exc:
        raise PermissionError("Invalid table token.") from exc
    return {
        "audience": "customer",
        "groups": [_customer_group(table.id, session_id)],
        "meta": {
            "table_id": table.id,
            "restaurant_id": table.restaurant_id,
            "session_id": session_id,
        },
    }


async def authenticate_order_socket(scope):
    params = parse_qs(scope.get("query_string", b"").decode("utf-8"))
    access_token = (params.get("access_token", [""])[0] or "").strip()
    if access_token:
        return await sync_to_async(_authenticate_staff)(access_token)

    table_token = (params.get("table_token", [""])[0] or "").strip()
    session_id = (params.get("session_id", [""])[0] or "").strip()
    if table_token and session_id:
        return await sync_to_async(_authenticate_customer)(table_token, session_id)

    raise PermissionError("Missing socket credentials.")


async def order_socket_app(scope, receive, send) -> None:
    try:
        actor = await authenticate_order_socket(scope)
    except Exception:
        await send({"type": "websocket.close", "code": 4401})
        return

    queue: asyncio.Queue = asyncio.Queue()
    groups = actor["groups"]
    await _register_connection(groups, queue)
    await send({"type": "websocket.accept"})
    await send(
        {
            "type": "websocket.send",
            "text": json.dumps(
                {
                    "type": "connection.ready",
                    "audience": actor["audience"],
                    **actor["meta"],
                }
            ),
        }
    )

    try:
        while True:
            receive_task = asyncio.create_task(receive())
            queue_task = asyncio.create_task(queue.get())
            done, pending = await asyncio.wait(
                {receive_task, queue_task},
                return_when=asyncio.FIRST_COMPLETED,
            )

            for task in pending:
                task.cancel()

            if queue_task in done:
                await send(
                    {
                        "type": "websocket.send",
                        "text": json.dumps(queue_task.result()),
                    }
                )
                continue

            message = receive_task.result()
            if message["type"] == "websocket.disconnect":
                break
            if message["type"] == "websocket.receive":
                text = (message.get("text") or "").strip().lower()
                if text == "ping":
                    await send({"type": "websocket.send", "text": json.dumps({"type": "pong"})})
    finally:
        await _unregister_connection(groups, queue)
