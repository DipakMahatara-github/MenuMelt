from rest_framework.routers import DefaultRouter

from .views import MenuCategoryViewSet

router = DefaultRouter()
router.register(r"", MenuCategoryViewSet, basename="category")

urlpatterns = router.urls
