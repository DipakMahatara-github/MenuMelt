from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from orders.models import Order
from restaurants.models import Restaurant   # 🔥 ADD THIS


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    if request.user.role != "admin":
        return Response({"error": "Forbidden"}, status=403)

    return Response({
        "total_users": User.objects.count(),
        "total_orders": Order.objects.count(),
        "total_restaurants": Restaurant.objects.count()  # 🔥 HERE
    })