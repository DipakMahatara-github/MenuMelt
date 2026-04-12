from django.db.models.deletion import ProtectedError
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import MenuCategory, MenuItem
from .serializers import MenuCategorySerializer, MenuItemSerializer
from .utils import resolve_restaurant


def _purge_legacy_menu_variant_rows(menu_item_id: int) -> None:
    """Remove rows from an old menu_variant table (pre–MenuItemSize) so DELETE on MenuItem can succeed."""
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'menu_variant'
            )
            """
        )
        if not cursor.fetchone()[0]:
            return
        cursor.execute(
            "DELETE FROM menu_variant WHERE menu_item_id = %s",
            [menu_item_id],
        )


class MenuCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = MenuCategorySerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "role", None) == "admin":
            return MenuCategory.objects.select_related("restaurant").all()
        if not user.restaurant_id:
            return MenuCategory.objects.none()
        return MenuCategory.objects.filter(restaurant_id=user.restaurant_id).order_by(
            "sort_order", "name"
        )

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, "role", None) == "admin":
            raise PermissionDenied("Platform admin cannot create categories from this endpoint.")
        if not user.restaurant_id:
            raise ValidationError("No restaurant is assigned to this user.")
        serializer.save(restaurant_id=user.restaurant_id)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": "Cannot delete this category while menu items still reference it. "
                    "Delete or move those items first."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class MenuViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        # QR / table flow: return restaurant branding even if a JWT is also present (same browser).
        if (request.headers.get("X-Table-Token") or "").strip():
            restaurant = resolve_restaurant(request)
            return Response(
                {
                    "restaurant": {"id": restaurant.id, "name": restaurant.name},
                    "items": serializer.data,
                }
            )
        return Response(serializer.data)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user

        if user.is_authenticated and getattr(user, "role", None) == "admin":
            return MenuItem.objects.select_related("category", "restaurant").all()

        restaurant = resolve_restaurant(self.request)
        if not restaurant:
            return MenuItem.objects.none()

        qs = MenuItem.objects.filter(restaurant=restaurant).select_related(
            "category", "restaurant"
        )
        # QR / guest flow: only show items that can be ordered.
        if not user.is_authenticated:
            qs = qs.filter(is_available=True)
        return qs

    def perform_create(self, serializer):
        if self.request.user.role == "admin":
            raise PermissionDenied("Platform admin cannot create menu items from this endpoint.")

        if not self.request.user.restaurant_id:
            raise ValidationError("No restaurant is assigned to this user.")

        serializer.save(restaurant_id=self.request.user.restaurant_id)

    def perform_destroy(self, instance):
        _purge_legacy_menu_variant_rows(instance.pk)
        instance.delete()
