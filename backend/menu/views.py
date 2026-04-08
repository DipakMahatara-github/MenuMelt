from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import MenuItem
from .serializers import MenuItemSerializer
from .utils import resolve_restaurant

class MenuViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        print("REQUEST USER:", user)
        print("TABLE TOKEN:", self.request.headers.get("X-Table-Token"))

        # Platform admins can inspect all items if needed.
        if user.is_authenticated and user.role == "admin":
            return MenuItem.objects.all()

        restaurant = resolve_restaurant(self.request)
        print("RESOLVED RESTAURANT:", restaurant.id if restaurant else None)
        if not restaurant:
            return MenuItem.objects.none()

        queryset = MenuItem.objects.filter(restaurant=restaurant)
        print("MENU ITEMS COUNT:", queryset.count())
        return queryset

    def perform_create(self, serializer):
        if self.request.user.role == "admin":
            raise PermissionDenied("Platform admin cannot create menu items from this endpoint.")

        if not self.request.user.restaurant_id:
            raise ValidationError("No restaurant is assigned to this user.")

        serializer.save(restaurant_id=self.request.user.restaurant_id)