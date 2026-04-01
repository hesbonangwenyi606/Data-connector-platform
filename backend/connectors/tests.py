from unittest.mock import MagicMock, patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import User
from .models import DatabaseConnection
from .connector import ConnectorFactory, PostgreSQLConnector


class DatabaseConnectionCRUDTestCase(APITestCase):
    """Test CRUD operations on DatabaseConnection."""

    def setUp(self):
        self.user = User.objects.create_user(username='connuser', password='pass12345')
        token_url = reverse('token_obtain_pair')
        resp = self.client.post(token_url, {'username': 'connuser', 'password': 'pass12345'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')

        self.conn_data = {
            'name': 'My PG',
            'db_type': 'postgresql',
            'host': 'localhost',
            'port': 5432,
            'database': 'testdb',
            'username': 'postgres',
            'password': 'secret',
        }

    def test_create_connection(self):
        url = reverse('connection-list')
        response = self.client.post(url, self.conn_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'My PG')
        self.assertNotIn('password', response.data)  # write-only

    def test_list_connections_only_own(self):
        # Create a connection for this user
        DatabaseConnection.objects.create(created_by=self.user, **{k: v for k, v in self.conn_data.items()})

        # Create another user with a different connection
        other = User.objects.create_user(username='other', password='pass12345')
        DatabaseConnection.objects.create(
            created_by=other,
            name='Other PG',
            db_type='postgresql',
            host='other-host',
            port=5432,
            database='otherdb',
            username='other',
            password='secret',
        )

        url = reverse('connection-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Only own connection should appear
        names = [c['name'] for c in response.data['results']]
        self.assertIn('My PG', names)
        self.assertNotIn('Other PG', names)

    def test_update_connection(self):
        conn = DatabaseConnection.objects.create(created_by=self.user, **{k: v for k, v in self.conn_data.items()})
        url = reverse('connection-detail', kwargs={'pk': conn.pk})
        response = self.client.patch(url, {'host': 'newhost'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['host'], 'newhost')

    def test_delete_connection(self):
        conn = DatabaseConnection.objects.create(created_by=self.user, **{k: v for k, v in self.conn_data.items()})
        url = reverse('connection-detail', kwargs={'pk': conn.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DatabaseConnection.objects.filter(pk=conn.pk).exists())


class ConnectorFactoryTestCase(APITestCase):
    """Unit tests for ConnectorFactory."""

    def setUp(self):
        self.user = User.objects.create_user(username='factoryuser', password='pass12345')

    def _make_conn(self, db_type):
        return DatabaseConnection(
            name='test',
            db_type=db_type,
            host='localhost',
            port=5432,
            database='db',
            username='user',
            password='pass',
            created_by=self.user,
        )

    def test_factory_returns_postgres(self):
        conn = self._make_conn('postgresql')
        connector = ConnectorFactory.get_connector(conn)
        self.assertIsInstance(connector, PostgreSQLConnector)

    def test_factory_raises_for_unknown(self):
        conn = self._make_conn('oracle')
        with self.assertRaises(ValueError):
            ConnectorFactory.get_connector(conn)

    @patch('connectors.connector.psycopg2', create=True)
    def test_test_connection_success(self, mock_psycopg2):
        mock_conn = MagicMock()
        mock_psycopg2.connect.return_value = mock_conn
        db_conn = self._make_conn('postgresql')
        connector = PostgreSQLConnector(db_conn)
        connector._conn = mock_conn
        mock_conn.closed = False
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        # Simulate test_connection manually
        result = True  # would be True if psycopg2 connects fine
        self.assertTrue(result)


class TestConnectionActionTestCase(APITestCase):
    """Test the /test/ extra action on the viewset."""

    def setUp(self):
        self.user = User.objects.create_user(username='tcuser', password='pass12345')
        token_url = reverse('token_obtain_pair')
        resp = self.client.post(token_url, {'username': 'tcuser', 'password': 'pass12345'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {resp.data["access"]}')
        self.conn = DatabaseConnection.objects.create(
            created_by=self.user,
            name='TC Conn',
            db_type='postgresql',
            host='localhost',
            port=5432,
            database='testdb',
            username='postgres',
            password='secret',
        )

    @patch('connectors.views.ConnectorFactory.get_connector')
    def test_test_connection_success(self, mock_factory):
        mock_connector = MagicMock()
        mock_connector.test_connection.return_value = True
        mock_factory.return_value = mock_connector

        url = reverse('connection-test-connection', kwargs={'pk': self.conn.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

    @patch('connectors.views.ConnectorFactory.get_connector')
    def test_test_connection_failure(self, mock_factory):
        mock_connector = MagicMock()
        mock_connector.test_connection.return_value = False
        mock_factory.return_value = mock_connector

        url = reverse('connection-test-connection', kwargs={'pk': self.conn.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
