from rest_framework import generics
from rest_framework.parsers import MultiPartParser, FormParser
from .models import MenuItem
from .serializers import MenuItemSerializer


# GET + POST
class MenuListCreateView(generics.ListCreateAPIView):
    queryset = MenuItem.objects.all()
    serializer_class = MenuItemSerializer
    parser_classes = [MultiPartParser, FormParser]


# GET single + PUT + DELETE
class MenuDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MenuItem.objects.all()
    serializer_class = MenuItemSerializer
    parser_classes = [MultiPartParser, FormParser]
