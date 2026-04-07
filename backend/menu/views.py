from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from .models import MenuItem
from .serializers import MenuItemSerializer

class MenuViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return MenuItem.objects.filter(
                restaurant=self.request.user.restaurant
            )
        return MenuItem.objects.none()

    def perform_create(self, serializer):
        serializer.save(
            restaurant=self.request.user.restaurant
        )