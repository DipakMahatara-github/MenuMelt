from rest_framework import serializers
from .models import User
from restaurants.models import Restaurant


class RegisterSerializer(serializers.ModelSerializer):

    restaurant_name = serializers.CharField(write_only=True)
    address = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "password", "full_name", "restaurant_name", "address"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        restaurant_name = validated_data.pop("restaurant_name")
        address = validated_data.pop("address")

        user = User.objects.create_user(
            role="restaurant_admin",
            **validated_data
        )

        restaurant = Restaurant.objects.create(
            name=restaurant_name,
            address=address,
            owner=user
        )

        user.restaurant = restaurant
        user.save()

        return user


class UserSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "restaurant", "restaurant_name"]

    def get_restaurant_name(self, obj):
        if obj.restaurant_id and obj.restaurant:
            return obj.restaurant.name
        return None