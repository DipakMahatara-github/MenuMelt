from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # Menu API
    path('api/menu/', include('menu.urls')),

    # Authentication API
    path('api/auth/', include('accounts.urls')),  

    path('api/orders/', include('orders.urls')),

    path('api/tables/', include('tables.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )