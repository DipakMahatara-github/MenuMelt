from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Order
from .serializers import OrderSerializer


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().order_by("-created_at")
    serializer_class = OrderSerializer

    def get_queryset(self):
        table = self.request.query_params.get('table')

        if table:
            return Order.objects.filter(table=table)

        return Order.objects.all()

    # 🔥 FIXED STATUS ACTION
    @action(detail=True, methods=["patch"])
    def status(self, request, pk=None):

        order = self.get_object()
        status_value = request.data.get("status")

        if status_value not in ["pending", "accepted", "preparing", "done"]:
            return Response({"error": "Invalid status"}, status=400)

        order.status = status_value
        order.save()

        return Response({"message": "Status updated"})