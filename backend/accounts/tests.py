from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import User


class RegisterTestCase(APITestCase):
    """Test user registration endpoint."""

    def test_register_success(self):
        url = reverse('auth-register')
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'strongpass123',
            'password2': 'strongpass123',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['username'], 'testuser')

    def test_register_password_mismatch(self):
        url = reverse('auth-register')
        data = {
            'username': 'testuser2',
            'email': 'test2@example.com',
            'password': 'strongpass123',
            'password2': 'differentpass',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_username(self):
        User.objects.create_user(username='existing', password='pass12345')
        url = reverse('auth-register')
        data = {
            'username': 'existing',
            'email': 'new@example.com',
            'password': 'strongpass123',
            'password2': 'strongpass123',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginTestCase(APITestCase):
    """Test JWT token obtain endpoint."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='loginuser',
            email='login@example.com',
            password='testpass123',
        )

    def test_login_success(self):
        url = reverse('token_obtain_pair')
        response = self.client.post(url, {'username': 'loginuser', 'password': 'testpass123'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_wrong_password(self):
        url = reverse('token_obtain_pair')
        response = self.client.post(url, {'username': 'loginuser', 'password': 'wrongpass'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ProfileTestCase(APITestCase):
    """Test profile endpoint."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='profileuser',
            email='profile@example.com',
            password='testpass123',
        )
        # Obtain token
        token_url = reverse('token_obtain_pair')
        response = self.client.post(token_url, {'username': 'profileuser', 'password': 'testpass123'}, format='json')
        self.access_token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')

    def test_get_profile(self):
        url = reverse('auth-profile')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'profileuser')

    def test_profile_requires_auth(self):
        self.client.credentials()
        url = reverse('auth-profile')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserListTestCase(APITestCase):
    """Test admin-only user list endpoint."""

    def setUp(self):
        self.admin = User.objects.create_superuser(
            username='adminuser',
            email='admin@example.com',
            password='adminpass123',
        )
        self.regular = User.objects.create_user(
            username='regularuser',
            password='userpass123',
        )
        token_url = reverse('token_obtain_pair')
        resp = self.client.post(token_url, {'username': 'adminuser', 'password': 'adminpass123'}, format='json')
        self.admin_token = resp.data['access']

        resp = self.client.post(token_url, {'username': 'regularuser', 'password': 'userpass123'}, format='json')
        self.user_token = resp.data['access']

    def test_admin_can_list_users(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        url = reverse('auth-user-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_regular_user_cannot_list_users(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        url = reverse('auth-user-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
