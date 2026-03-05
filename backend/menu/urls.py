from django.urls import path
from .views import MenuListCreateView, MenuDetailView

urlpatterns = [
    path('', MenuListCreateView.as_view()),
    path('<int:pk>/', MenuDetailView.as_view()),
]
