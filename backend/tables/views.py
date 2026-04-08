from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Table
from .serializers import TableSerializer


class TableViewSet(viewsets.ModelViewSet):
    serializer_class = TableSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Table.objects.filter(
            restaurant=self.request.user.restaurant
        )
        print("USER:", self.request.user, self.request.user.restaurant_id)
        print("TABLES:", queryset)
        return queryset

    def perform_create(self, serializer):
        serializer.save(
            restaurant=self.request.user.restaurant
        )