from django.urls import path
from .views import RegisterView, UserProfileView, UserListView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('profile/', UserProfileView.as_view(), name='auth-profile'),
    path('users/', UserListView.as_view(), name='auth-user-list'),
]
