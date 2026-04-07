from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from .models import MenuItem
from .serializers import MenuItemSerializer

class MenuViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # Platform admins can inspect all items if needed.
        if user.role == "admin":
            return MenuItem.objects.all()

        if not user.restaurant_id:
            return MenuItem.objects.none()

        return MenuItem.objects.filter(restaurant_id=user.restaurant_id)

    def perform_create(self, serializer):
        if self.request.user.role == "admin":
            raise PermissionDenied("Platform admin cannot create menu items from this endpoint.")

        if not self.request.user.restaurant_id:
            raise ValidationError("No restaurant is assigned to this user.")

        serializer.save(restaurant_id=self.request.user.restaurant_id)