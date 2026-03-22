from rest_framework import viewsets
from .models import Order
from .serializers import OrderSerializer

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer

    def get_queryset(self):
        table = self.request.query_params.get('table')

        if table:
            return Order.objects.filter(table=table)

        return Order.objects.all()