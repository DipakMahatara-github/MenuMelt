from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Prefetch, Q, Sum
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from orders.models import Order, OrderReview

from .models import (
    MenuCategory,
    MenuItem,
    MenuItemCustomizationGroup,
    MenuItemCustomizationOption,
    MenuOffer,
    MenuOfferItem,
)
from .pricing import NEW_ITEM_WINDOW_DAYS, active_offer_queryset, build_offer_context, quantize_money
from .serializers import (
    MenuCategorySerializer,
    MenuItemSerializer,
    MenuOfferSerializer,
)
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


def _menu_prefetch():
    return Prefetch(
        "customization_groups",
        queryset=MenuItemCustomizationGroup.objects.order_by("sort_order", "id").prefetch_related(
            Prefetch(
                "options",
                queryset=MenuItemCustomizationOption.objects.order_by("sort_order", "id"),
            )
        ),
    )


def _customer_sort_key(sort_value: str, item, offer_context):
    customer_price = Decimal(str(offer_context.get(item.id, {}).get("effective_price", item.price)))
    popularity = int(getattr(item, "popularity_score", 0) or 0)
    created_at = item.created_at
    if sort_value == "price_desc":
        return (-customer_price, item.name.lower(), (item.variant_label or "").lower())
    if sort_value == "price_asc":
        return (customer_price, item.name.lower(), (item.variant_label or "").lower())
    if sort_value == "newest":
        return (-created_at.timestamp(), item.name.lower(), (item.variant_label or "").lower())
    if sort_value == "popular":
        return (-popularity, item.name.lower(), (item.variant_label or "").lower())
    return (item.category.sort_order, item.category.name.lower(), item.name.lower(), (item.variant_label or "").lower())


def _filter_customer_items(items, offer_context, query_params):
    category_value = (query_params.get("category") or "").strip()
    search_value = (query_params.get("search") or "").strip().lower()
    sort_value = (query_params.get("sort") or "").strip()
    min_price_raw = (query_params.get("min_price") or "").strip()
    max_price_raw = (query_params.get("max_price") or "").strip()
    popular_only = (query_params.get("popular_only") or "").strip().lower() in {"1", "true", "yes"}
    new_only = (query_params.get("new_only") or "").strip().lower() in {"1", "true", "yes"}

    min_price = quantize_money(min_price_raw) if min_price_raw else None
    max_price = quantize_money(max_price_raw) if max_price_raw else None

    filtered = []
    for item in items:
        context = offer_context.get(item.id, {})
        customer_price = Decimal(str(context.get("effective_price", item.price)))
        display_name = item.name if not (item.variant_label or "").strip() else f"{item.name} · {item.variant_label.strip()}"
        is_new = item.created_at >= timezone.now() - timedelta(days=NEW_ITEM_WINDOW_DAYS)
        if category_value and str(item.category_id) != category_value and item.category.name.lower() != category_value.lower():
            continue
        if min_price is not None and customer_price < min_price:
            continue
        if max_price is not None and customer_price > max_price:
            continue
        if popular_only and int(getattr(item, "popularity_score", 0) or 0) <= 0:
            continue
        if new_only and not is_new:
            continue
        if search_value:
            haystack = " ".join(
                [
                    item.name or "",
                    item.variant_label or "",
                    display_name,
                    item.description or "",
                    item.category.name or "",
                ]
            ).lower()
            if search_value not in haystack:
                continue
        filtered.append(item)

    return sorted(filtered, key=lambda item: _customer_sort_key(sort_value, item, offer_context))


def _restaurant_review_summary(restaurant_id: int):
    data = OrderReview.objects.filter(restaurant_id=restaurant_id).aggregate(
        average_rating=Avg("overall_experience"),
        review_count=Count("id"),
    )
    review_count = int(data.get("review_count") or 0)
    average = data.get("average_rating")
    return {
        "average_rating": float(average) if average is not None else None,
        "review_count": review_count,
    }


def _serialize_offer_list(offers, *, context):
    return MenuOfferSerializer(offers, many=True, context=context).data


def _customer_offer_queryset(restaurant_id: int):
    now = timezone.now()
    return (
        MenuOffer.objects.filter(restaurant_id=restaurant_id, is_active=True)
        .filter(Q(ends_at__isnull=True) | Q(ends_at__gte=now))
        .prefetch_related(Prefetch("items", queryset=MenuOfferItem.objects.select_related("menu_item")))
        .order_by("starts_at", "-created_at", "name")
    )


def _ensure_restaurant_operator(request):
    user = request.user
    if not user.is_authenticated:
        raise PermissionDenied("Authentication required.")
    if getattr(user, "role", None) == "admin":
        raise PermissionDenied("Platform admin cannot manage restaurant menu offers here.")
    if not getattr(user, "restaurant_id", None):
        raise ValidationError("No restaurant is assigned to this user.")
    return user


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


class MenuOfferCollectionView(generics.ListCreateAPIView):
    serializer_class = MenuOfferSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = _ensure_restaurant_operator(self.request)
        return (
            MenuOffer.objects.filter(restaurant_id=user.restaurant_id)
            .prefetch_related(Prefetch("items", queryset=MenuOfferItem.objects.select_related("menu_item")))
            .order_by("-created_at", "name")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class MenuOfferDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MenuOfferSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = "offer_id"

    def get_queryset(self):
        user = _ensure_restaurant_operator(self.request)
        return (
            MenuOffer.objects.filter(restaurant_id=user.restaurant_id)
            .prefetch_related(Prefetch("items", queryset=MenuOfferItem.objects.select_related("menu_item")))
            .order_by("-created_at", "name")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class MenuViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def _admin_queryset(self):
        return MenuItem.objects.select_related("category", "restaurant").prefetch_related(_menu_prefetch()).all()

    def _customer_base_queryset(self, restaurant):
        return (
            MenuItem.objects.filter(restaurant=restaurant, is_available=True)
            .select_related("category", "restaurant")
            .prefetch_related(_menu_prefetch())
            .annotate(
                popularity_score=Sum(
                    "orderitem__quantity",
                    filter=Q(orderitem__order__restaurant=restaurant)
                    & (
                        Q(orderitem__order__status=Order.STATUS_SERVED)
                        | Q(orderitem__order__billing_status=Order.BILLING_ST_PAID)
                    ),
                )
            )
        )

    def get_queryset(self):
        user = self.request.user
        table_flow = bool((self.request.headers.get("X-Table-Token") or "").strip())

        if user.is_authenticated and getattr(user, "role", None) == "admin" and not table_flow:
            return self._admin_queryset()

        restaurant = resolve_restaurant(self.request)
        if not restaurant:
            return MenuItem.objects.none()

        if user.is_authenticated and not table_flow:
            return (
                MenuItem.objects.filter(restaurant=restaurant)
                .select_related("category", "restaurant")
                .prefetch_related(_menu_prefetch())
            )

        return self._customer_base_queryset(restaurant)

    def list(self, request, *args, **kwargs):
        table_flow = bool((request.headers.get("X-Table-Token") or "").strip())
        user = request.user
        if table_flow or not user.is_authenticated:
            restaurant = resolve_restaurant(request)
            base_items = list(self._customer_base_queryset(restaurant))
            live_offers = list(active_offer_queryset(restaurant.id))
            customer_offers = list(_customer_offer_queryset(restaurant.id))
            offer_context = build_offer_context(base_items, live_offers)
            serializer_context = {**self.get_serializer_context(), "offer_context": offer_context}
            filtered_items = _filter_customer_items(base_items, offer_context, request.query_params)
            serializer = self.get_serializer(filtered_items, many=True, context=serializer_context)

            categories = [
                {"id": item.category_id, "name": item.category.name}
                for item in sorted(base_items, key=lambda menu_item: (menu_item.category.sort_order, menu_item.category.name.lower()))
            ]
            deduped_categories = list({row["id"]: row for row in categories}.values())
            customer_prices = [
                Decimal(str(offer_context[item.id].get("effective_price", item.price)))
                for item in base_items
            ]
            review_summary = _restaurant_review_summary(restaurant.id)

            return Response(
                {
                    "restaurant": {
                        "id": restaurant.id,
                        "name": restaurant.name,
                        **review_summary,
                    },
                    "filters": {
                        "categories": deduped_categories,
                        "price_range": {
                            "min": str(min(customer_prices)) if customer_prices else "0.00",
                            "max": str(max(customer_prices)) if customer_prices else "0.00",
                        },
                    },
                    "items": serializer.data,
                    "special_offers": _serialize_offer_list(customer_offers, context=serializer_context),
                }
            )

        queryset = self.filter_queryset(self.get_queryset())
        role = getattr(user, "role", None)
        serializer_context = self.get_serializer_context()
        if role != "admin" and getattr(user, "restaurant_id", None):
            queryset = list(queryset)
            offers = list(active_offer_queryset(user.restaurant_id))
            serializer_context = {
                **serializer_context,
                "offer_context": build_offer_context(queryset, offers),
            }
        serializer = self.get_serializer(queryset, many=True, context=serializer_context)
        return Response(serializer.data)

    def perform_create(self, serializer):
        if self.request.user.role == "admin":
            raise PermissionDenied("Platform admin cannot create menu items from this endpoint.")

        if not self.request.user.restaurant_id:
            raise ValidationError("No restaurant is assigned to this user.")

        serializer.save(restaurant_id=self.request.user.restaurant_id)

    def perform_destroy(self, instance):
        _purge_legacy_menu_variant_rows(instance.pk)
        instance.delete()
