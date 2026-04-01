from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StoredFileViewSet

router = DefaultRouter()
router.register(r'', StoredFileViewSet, basename='storedfile')

urlpatterns = [
    path('', include(router.urls)),
]
