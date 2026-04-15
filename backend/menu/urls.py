from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import MenuOfferCollectionView, MenuOfferDetailView, MenuViewSet

router = DefaultRouter()
router.register(r'', MenuViewSet, basename='menu')

urlpatterns = [
    path("offers/", MenuOfferCollectionView.as_view()),
    path("offers/<int:offer_id>/", MenuOfferDetailView.as_view()),
] + router.urls
