from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Table
from .serializers import TableSerializer


class TableViewSet(viewsets.ModelViewSet):
    serializer_class = TableSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Table.objects.filter(
            restaurant=self.request.user.restaurant
        )

    def perform_create(self, serializer):
        serializer.save(
            restaurant=self.request.user.restaurant
        )