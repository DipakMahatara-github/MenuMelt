from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import UserSerializer
from restaurants.models import Restaurant


# ================= LOGIN =================
@api_view(["POST"])
@permission_classes([AllowAny])
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
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "email": user.email,
        "role": user.role,
        "name": user.full_name,
        "restaurant": user.restaurant.name if user.restaurant else None
    })


# ================= REGISTER =================
@api_view(["POST"])
@permission_classes([AllowAny])
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
            "access": str(refresh.access_token),
            "refresh": str(refresh),
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
    user = User.objects.select_related("restaurant").get(pk=request.user.pk)
    serializer = UserSerializer(user)
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


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def restaurant_team(request):
    """
    Restaurant admins only: list or create waiter / cashier / kitchen users for this restaurant.
    """
    if getattr(request.user, "role", None) != "restaurant_admin":
        return Response(
            {"error": "Only restaurant admins can manage waiter, cashier, and kitchen accounts."},
            status=status.HTTP_403_FORBIDDEN,
        )
    restaurant = request.user.restaurant
    if not restaurant:
        return Response({"error": "No restaurant assigned"}, status=400)

    if request.method == "GET":
        team = (
            User.objects.filter(restaurant_id=restaurant.id, role__in=["waiter", "cashier", "kitchen"])
            .order_by("role", "email")
        )
        return Response(UserSerializer(team, many=True).data)

    raw_email = (request.data.get("email") or "").strip()
    email = User.objects.normalize_email(raw_email)
    full_name = (request.data.get("full_name") or "").strip()
    password = request.data.get("password") or ""
    role = (request.data.get("role") or "").strip()

    if not all([email, full_name, password, role]):
        return Response(
            {"error": "email, full_name, password, and role are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if role not in ("waiter", "cashier", "kitchen"):
        return Response(
            {"error": "role must be waiter, cashier, or kitchen."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if User.objects.filter(email__iexact=email).exists():
        return Response({"error": "This email is already registered."}, status=400)

    user = User(
        email=email,
        full_name=full_name[:255],
        role=role,
        restaurant=restaurant,
    )
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        return Response({"error": "; ".join(exc.messages)}, status=400)

    user.set_password(password)
    user.save()
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
