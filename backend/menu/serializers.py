from urllib.parse import urlparse

from rest_framework import serializers

from .models import MenuCategory, MenuItem


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


class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    available = serializers.BooleanField(source="is_available", required=False, default=True)
    display_name = serializers.SerializerMethodField(read_only=True)

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
            "image",
            "category",
            "category_name",
            "available",
            "created_at",
        ]
        read_only_fields = ["id", "restaurant", "category_name", "display_name", "created_at"]

    def get_display_name(self, obj):
        v = (obj.variant_label or "").strip()
        return f"{obj.name} · {v}" if v else obj.name

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
