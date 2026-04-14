"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

from orders.live import order_socket_app


async def application(scope, receive, send):
    if scope["type"] == "websocket":
        if scope.get("path") == "/ws/orders/stream/":
            await order_socket_app(scope, receive, send)
            return
        await send({"type": "websocket.close", "code": 4404})
        return

    await django_asgi_app(scope, receive, send)
