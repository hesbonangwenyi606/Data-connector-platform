from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExtractionBatchViewSet

router = DefaultRouter()
router.register(r'', ExtractionBatchViewSet, basename='extractionbatch')

urlpatterns = [
    path('', include(router.urls)),
]
