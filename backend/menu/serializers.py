import json
from datetime import timedelta
from decimal import Decimal
from urllib.parse import urlparse

from rest_framework import serializers

from .models import (
    MenuCategory,
    MenuItem,
    MenuItemCustomizationGroup,
    MenuItemCustomizationOption,
    MenuOffer,
    MenuOfferItem,
)
from .pricing import NEW_ITEM_WINDOW_DAYS, POPULAR_MIN_ORDERED_QTY


class FlexibleJSONField(serializers.JSONField):
    def to_internal_value(self, data):
        if isinstance(data, str):
            data = data.strip()
            if not data:
                return None
            try:
                data = json.loads(data)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError("Invalid JSON payload.") from exc
        return super().to_internal_value(data)


class MenuCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuCategory
        fields = ["id", "name", "sort_order"]
        read_only_fields = ["id"]

    def validate_name(self, value):
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("This field may not be blank.")
        return name[:100]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        restaurant_id = None
        if self.instance:
            restaurant_id = self.instance.restaurant_id
        elif user and user.is_authenticated and getattr(user, "role", None) != "admin":
            restaurant_id = user.restaurant_id

        if restaurant_id is None:
            return attrs

        name = attrs.get("name")
        if name is None and self.instance:
            name = self.instance.name
        name = ((name or "") if isinstance(name, str) else "").strip()[:100]
        qs = MenuCategory.objects.filter(restaurant_id=restaurant_id, name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {"name": "A category with this name already exists for your restaurant."}
            )
        return attrs


class MenuCustomizationOptionInputSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=100)
    price_delta = serializers.DecimalField(max_digits=8, decimal_places=2, required=False, default=Decimal("0.00"))
    sort_order = serializers.IntegerField(min_value=0, required=False, default=0)

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Option name is required.")
        return value[:100]

    def validate_price_delta(self, value):
        if value < 0:
            raise serializers.ValidationError("Extra price cannot be negative.")
        return value


class MenuCustomizationGroupInputSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=100)
    selection_mode = serializers.ChoiceField(choices=MenuItemCustomizationGroup.MODE_CHOICES)
    is_required = serializers.BooleanField(required=False, default=False)
    max_select = serializers.IntegerField(min_value=1, required=False, default=1)
    sort_order = serializers.IntegerField(min_value=0, required=False, default=0)
    options = MenuCustomizationOptionInputSerializer(many=True)

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Group name is required.")
        return value[:100]

    def validate(self, attrs):
        options = attrs.get("options") or []
        if not options:
            raise serializers.ValidationError({"options": "Add at least one option."})

        selection_mode = attrs.get("selection_mode")
        max_select = attrs.get("max_select", 1)
        if selection_mode == MenuItemCustomizationGroup.MODE_SINGLE:
            attrs["max_select"] = 1
        elif max_select < 1:
            raise serializers.ValidationError({"max_select": "Max choices must be at least 1."})

        option_names = set()
        for option in options:
            name_key = option["name"].strip().lower()
            if name_key in option_names:
                raise serializers.ValidationError({"options": "Option names must be unique within a group."})
            option_names.add(name_key)
        return attrs


class MenuCustomizationOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItemCustomizationOption
        fields = ["id", "name", "price_delta", "sort_order"]


class MenuCustomizationGroupSerializer(serializers.ModelSerializer):
    options = MenuCustomizationOptionSerializer(many=True, read_only=True)

    class Meta:
        model = MenuItemCustomizationGroup
        fields = ["id", "name", "selection_mode", "is_required", "max_select", "sort_order", "options"]


class MenuOfferItemInputSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    menu_item = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, required=False, default=1)


class MenuOfferItemSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.SerializerMethodField()
    menu_item_display_name = serializers.SerializerMethodField()

    class Meta:
        model = MenuOfferItem
        fields = ["id", "menu_item", "menu_item_name", "menu_item_display_name", "quantity"]

    def get_menu_item_name(self, obj):
        return obj.menu_item.name

    def get_menu_item_display_name(self, obj):
        variant = (obj.menu_item.variant_label or "").strip()
        return f"{obj.menu_item.name} · {variant}" if variant else obj.menu_item.name


class MenuOfferSerializer(serializers.ModelSerializer):
    items = MenuOfferItemSerializer(many=True, read_only=True)
    items_payload = MenuOfferItemInputSerializer(many=True, write_only=True, required=False)
    is_currently_valid = serializers.SerializerMethodField()

    class Meta:
        model = MenuOffer
        fields = [
            "id",
            "name",
            "offer_type",
            "description",
            "badge_text",
            "is_active",
            "is_currently_valid",
            "starts_at",
            "ends_at",
            "fixed_discount_amount",
            "percentage_discount",
            "combo_price",
            "items",
            "items_payload",
            "created_at",
        ]
        read_only_fields = ["id", "is_currently_valid", "items", "created_at"]

    def get_is_currently_valid(self, obj):
        from django.utils import timezone

        now = timezone.now()
        if not obj.is_active:
            return False
        if obj.starts_at and obj.starts_at > now:
            return False
        if obj.ends_at and obj.ends_at < now:
            return False
        return True

    def validate_items_payload(self, value):
        if not value:
            raise serializers.ValidationError("Add at least one menu item.")
        seen = set()
        normalized = []
        for row in value:
            menu_item_id = row["menu_item"]
            if menu_item_id in seen:
                raise serializers.ValidationError("Each menu item can only appear once per offer.")
            seen.add(menu_item_id)
            normalized.append(
                {
                    **({"id": row["id"]} if row.get("id") else {}),
                    "menu_item": menu_item_id,
                    "quantity": row.get("quantity", 1),
                }
            )
        return normalized

    def validate(self, attrs):
        offer_type = attrs.get("offer_type") or getattr(self.instance, "offer_type", None)
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        items_payload = attrs.get("items_payload")
        if items_payload is None and self.instance:
            items_payload = [{"menu_item": row.menu_item_id, "quantity": row.quantity} for row in self.instance.items.all()]
        if not items_payload:
            raise serializers.ValidationError({"items_payload": "Add at least one menu item."})

        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "End date must be after the start date."})

        if offer_type == MenuOffer.TYPE_FIXED:
            amount = attrs.get("fixed_discount_amount", getattr(self.instance, "fixed_discount_amount", None))
            if amount is None or amount <= 0:
                raise serializers.ValidationError({"fixed_discount_amount": "Enter a fixed discount amount."})
            attrs["percentage_discount"] = None
            attrs["combo_price"] = None
        elif offer_type == MenuOffer.TYPE_PERCENTAGE:
            percentage = attrs.get("percentage_discount", getattr(self.instance, "percentage_discount", None))
            if percentage is None or percentage <= 0 or percentage > 100:
                raise serializers.ValidationError({"percentage_discount": "Enter a percentage between 0 and 100."})
            attrs["fixed_discount_amount"] = None
            attrs["combo_price"] = None
        elif offer_type == MenuOffer.TYPE_COMBO:
            combo_price = attrs.get("combo_price", getattr(self.instance, "combo_price", None))
            if combo_price is None or combo_price <= 0:
                raise serializers.ValidationError({"combo_price": "Enter the combo price."})
            if not items_payload or len(items_payload) < 2:
                raise serializers.ValidationError({"items_payload": "Combo offers need at least two menu items."})
            attrs["fixed_discount_amount"] = None
            attrs["percentage_discount"] = None

        if items_payload:
            request = self.context.get("request")
            user = getattr(request, "user", None)
            restaurant_id = getattr(user, "restaurant_id", None)
            valid_item_ids = set(MenuItem.objects.filter(restaurant_id=restaurant_id, id__in=[row["menu_item"] for row in items_payload]).values_list("id", flat=True))
            invalid = [row["menu_item"] for row in items_payload if row["menu_item"] not in valid_item_ids]
            if invalid:
                raise serializers.ValidationError({"items_payload": "Offers can only include your restaurant's menu items."})
        return attrs

    def _sync_items(self, offer, items_payload):
        existing = {row.id: row for row in offer.items.all()}
        keep_ids = set()
        for row in items_payload:
            row_id = row.get("id")
            if row_id and row_id in existing:
                record = existing[row_id]
                record.menu_item_id = row["menu_item"]
                record.quantity = row.get("quantity", 1)
                record.save(update_fields=["menu_item", "quantity"])
            else:
                record = MenuOfferItem.objects.create(
                    offer=offer,
                    menu_item_id=row["menu_item"],
                    quantity=row.get("quantity", 1),
                )
            keep_ids.add(record.id)
        offer.items.exclude(id__in=keep_ids).delete()

    def create(self, validated_data):
        items_payload = validated_data.pop("items_payload", [])
        request = self.context.get("request")
        offer = MenuOffer.objects.create(
            restaurant_id=request.user.restaurant_id,
            **validated_data,
        )
        self._sync_items(offer, items_payload)
        return offer

    def update(self, instance, validated_data):
        items_payload = validated_data.pop("items_payload", None)
        offer = super().update(instance, validated_data)
        if items_payload is not None:
            self._sync_items(offer, items_payload)
        return offer


class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    available = serializers.BooleanField(source="is_available", required=False, default=True)
    display_name = serializers.SerializerMethodField(read_only=True)
    customization_groups = MenuCustomizationGroupSerializer(many=True, read_only=True)
    customization_groups_payload = FlexibleJSONField(write_only=True, required=False)
    customer_price = serializers.SerializerMethodField(read_only=True)
    offer_badges = serializers.SerializerMethodField(read_only=True)
    active_item_offer = serializers.SerializerMethodField(read_only=True)
    is_new = serializers.SerializerMethodField(read_only=True)
    is_popular = serializers.SerializerMethodField(read_only=True)
    popularity_score = serializers.IntegerField(read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "restaurant",
            "name",
            "variant_label",
            "display_name",
            "description",
            "price",
            "customer_price",
            "image",
            "category",
            "category_name",
            "available",
            "customization_groups",
            "customization_groups_payload",
            "offer_badges",
            "active_item_offer",
            "is_new",
            "is_popular",
            "popularity_score",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "restaurant",
            "category_name",
            "display_name",
            "customization_groups",
            "created_at",
        ]

    def get_display_name(self, obj):
        v = (obj.variant_label or "").strip()
        return f"{obj.name} · {v}" if v else obj.name

    def _offer_context(self, obj):
        context = self.context.get("offer_context") or {}
        return context.get(obj.id, {})

    def get_customer_price(self, obj):
        offer_context = self._offer_context(obj)
        value = offer_context.get("effective_price", obj.price)
        return str(value)

    def get_offer_badges(self, obj):
        return self._offer_context(obj).get("badges", [])

    def get_active_item_offer(self, obj):
        return self._offer_context(obj).get("item_offer")

    def get_is_new(self, obj):
        from django.utils import timezone

        created_at = getattr(obj, "created_at", None)
        if not created_at:
            return False
        return created_at >= timezone.now() - timedelta(days=NEW_ITEM_WINDOW_DAYS)

    def get_is_popular(self, obj):
        return int(getattr(obj, "popularity_score", 0) or 0) >= POPULAR_MIN_ORDERED_QTY

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        field = self.fields.get("category")
        if not field:
            return
        if user and user.is_authenticated:
            if getattr(user, "role", None) == "admin":
                field.queryset = MenuCategory.objects.all()
            elif user.restaurant_id:
                field.queryset = MenuCategory.objects.filter(restaurant_id=user.restaurant_id)
            else:
                field.queryset = MenuCategory.objects.none()
        else:
            field.queryset = MenuCategory.objects.none()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.image:
            url = instance.image.url
            if url.startswith("http"):
                data["image"] = urlparse(url).path or url
            else:
                data["image"] = url
        else:
            data["image"] = None
        return data

    def validate_name(self, value):
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("This field may not be blank.")
        return name

    def validate_variant_label(self, value):
        if value is None:
            return ""
        return (value or "").strip()[:50]

    def validate_category(self, category):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return category
        if getattr(user, "role", None) == "admin":
            return category
        if category.restaurant_id != user.restaurant_id:
            raise serializers.ValidationError("Invalid category for this restaurant.")
        return category

    def validate_customization_groups_payload(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Customization groups must be a list.")
        serializer = MenuCustomizationGroupInputSerializer(data=value, many=True)
        serializer.is_valid(raise_exception=True)

        group_names = set()
        for group in serializer.validated_data:
            name_key = group["name"].strip().lower()
            if name_key in group_names:
                raise serializers.ValidationError("Customization group names must be unique for an item.")
            group_names.add(name_key)
        return serializer.validated_data

    def validate(self, attrs):
        instance = self.instance
        category = attrs.get("category")
        name = attrs.get("name")

        if instance:
            category = category if category is not None else instance.category
            if name is None:
                name = instance.name
            if "variant_label" in attrs:
                variant_norm = (attrs.get("variant_label") or "").strip()[:50]
            else:
                variant_norm = (instance.variant_label or "").strip()[:50]
        else:
            variant_norm = (attrs.get("variant_label") or "").strip()[:50]

        if category is None or name is None:
            return attrs

        name_stripped = name.strip() if isinstance(name, str) else str(name)
        qs = MenuItem.objects.filter(
            category=category,
            name__iexact=name_stripped,
            variant_label__iexact=variant_norm,
        )
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "An item with this name and size/variant already exists in this category. "
                        "Use a different variant label (e.g. Small, Medium) or a different name."
                    ]
                }
            )

        if not instance or "variant_label" in attrs:
            attrs["variant_label"] = variant_norm
        return attrs

    def _sync_customization_groups(self, item: MenuItem, groups_payload):
        existing_groups = {group.id: group for group in item.customization_groups.prefetch_related("options")}
        keep_group_ids = set()

        for group_data in groups_payload:
            options_payload = group_data.pop("options", [])
            group_id = group_data.pop("id", None)

            if group_id and group_id in existing_groups:
                group = existing_groups[group_id]
                for field, value in group_data.items():
                    setattr(group, field, value)
                group.save(update_fields=["name", "selection_mode", "is_required", "max_select", "sort_order"])
            else:
                group = MenuItemCustomizationGroup.objects.create(menu_item=item, **group_data)

            keep_group_ids.add(group.id)

            existing_options = {option.id: option for option in group.options.all()}
            keep_option_ids = set()
            for option_data in options_payload:
                option_id = option_data.pop("id", None)
                if option_id and option_id in existing_options:
                    option = existing_options[option_id]
                    for field, value in option_data.items():
                        setattr(option, field, value)
                    option.save(update_fields=["name", "price_delta", "sort_order"])
                else:
                    option = MenuItemCustomizationOption.objects.create(group=group, **option_data)
                keep_option_ids.add(option.id)

            group.options.exclude(id__in=keep_option_ids).delete()

        item.customization_groups.exclude(id__in=keep_group_ids).delete()

    def create(self, validated_data):
        groups_payload = validated_data.pop("customization_groups_payload", [])
        item = super().create(validated_data)
        self._sync_customization_groups(item, groups_payload)
        return item

    def update(self, instance, validated_data):
        groups_payload = validated_data.pop("customization_groups_payload", None)
        item = super().update(instance, validated_data)
        if groups_payload is not None:
            self._sync_customization_groups(item, groups_payload)
        return item
