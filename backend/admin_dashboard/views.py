from rest_framework.decorators import api_view
from rest_framework.response import Response

from accounts.models import User
from orders.models import Order
from restaurants.models import Restaurant   # 🔥 ADD THIS


@api_view(["GET"])
def admin_dashboard(request):

    return Response({
        "total_users": User.objects.count(),
        "total_orders": Order.objects.count(),
        "total_restaurants": Restaurant.objects.count()  # 🔥 HERE
    })