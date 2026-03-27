from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import RegisterSerializer, UserSerializer


# ================= LOGIN =================
@api_view(["POST"])
def login_user(request):

    email = request.data.get("email")
    password = request.data.get("password")

    user = authenticate(email=email, password=password)

    if user is None:
        return Response({"error": "Invalid email or password"}, status=401)

    refresh = RefreshToken.for_user(user)

    return Response({
        "token": str(refresh.access_token),
        "email": user.email,
        "role": user.role,
        "name": user.full_name
    })


# ================= REGISTER =================
@api_view(["POST"])
def register_user(request):

    serializer = RegisterSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        return Response({
            "message": "User created successfully",
            "email": user.email
        })

    return Response(serializer.errors, status=400)


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
        return Response({"error": "Wrong current password"}, status=400)

    user.set_password(new_password)
    user.save()

    return Response({"message": "Password updated successfully"})