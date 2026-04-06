from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import MenuItem


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_menu(request):

    restaurant = request.user.restaurant

    if not restaurant:
        return Response({"error": "No restaurant assigned"}, status=400)

    items = MenuItem.objects.filter(restaurant=restaurant)

    data = [
        {
            "id": item.id,
            "name": item.name,
            "price": item.price,
            "category": item.category,
        }
        for item in items
    ]

    return Response(data)