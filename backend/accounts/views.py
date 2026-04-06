from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import UserSerializer
from restaurants.models import Restaurant


# ================= LOGIN =================
@api_view(["POST"])
def login_user(request):

    email = request.data.get("email")
    password = request.data.get("password")

    user = authenticate(email=email, password=password)

    if user is None:
        return Response(
            {"error": "Invalid email or password"},
            status=status.HTTP_401_UNAUTHORIZED
        )

    refresh = RefreshToken.for_user(user)

    return Response({
        "token": str(refresh.access_token),
        "email": user.email,
        "role": user.role,
        "name": user.full_name,
        "restaurant": user.restaurant.name if user.restaurant else None
    })


# ================= REGISTER =================
@api_view(["POST"])
def register_user(request):

    full_name = request.data.get("full_name")
    email = request.data.get("email")
    password = request.data.get("password")
    restaurant_name = request.data.get("restaurantName")

    # 🔒 Validation
    if not all([full_name, email, password, restaurant_name]):
        return Response(
            {"error": "All fields are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if User.objects.filter(email=email).exists():
        return Response(
            {"error": "Email already exists"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # ✅ 1. Create User (restaurant admin)
        user = User.objects.create_user(
            email=email,
            full_name=full_name,
            password=password,
            role="restaurant_admin"
        )

        # ✅ 2. Create Restaurant
        restaurant = Restaurant.objects.create(
            name=restaurant_name,
            owner=user,
            address="Default Address"
        )

        # ✅ 3. Link User → Restaurant
        user.restaurant = restaurant
        user.save()

        # ✅ 4. Generate JWT (auto login)
        refresh = RefreshToken.for_user(user)

        return Response({
            "message": "Restaurant registered successfully",
            "token": str(refresh.access_token),
            "role": user.role,
            "name": user.full_name,
            "restaurant": restaurant.name
        })

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ================= GET PROFILE =================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_profile(request):

    serializer = UserSerializer(request.user)
    return Response(serializer.data)


# ================= CHANGE PASSWORD =================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):

    user = request.user

    current_password = request.data.get("current_password")
    new_password = request.data.get("new_password")

    if not user.check_password(current_password):
        return Response(
            {"error": "Wrong current password"},
            status=status.HTTP_400_BAD_REQUEST
        )

    user.set_password(new_password)
    user.save()

    return Response({"message": "Password updated successfully"})