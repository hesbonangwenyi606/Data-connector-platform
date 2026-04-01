from unittest.mock import MagicMock, patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import User
from connectors.models import DatabaseConnection
from .models import DataRecord, ExtractionBatch


def make_user(username, password='pass12345'):
    return User.objects.create_user(username=username, password=password)


def get_token(client, username, password='pass12345'):
    url = reverse('token_obtain_pair')
    resp = client.post(url, {'username': username, 'password': password}, format='json')
    return resp.data['access']


def make_connection(user):
    return DatabaseConnection.objects.create(
        created_by=user,
        name='Test Conn',
        db_type='postgresql',
        host='localhost',
        port=5432,
        database='testdb',
        username='postgres',
        password='secret',
    )


class CreateBatchTestCase(APITestCase):
    """Test extraction batch creation via the API."""

    def setUp(self):
        self.user = make_user('batchuser')
        token = get_token(self.client, 'batchuser')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.conn = make_connection(self.user)

    @patch('extractions.views.ConnectorFactory.get_connector')
    def test_create_batch_success(self, mock_factory):
        mock_connector = MagicMock()
        mock_connector.fetch_data.return_value = {
            'columns': ['id', 'name'],
            'rows': [[1, 'Alice'], [2, 'Bob']],
            'total': 2,
        }
        mock_factory.return_value = mock_connector

        url = reverse('extractionbatch-list')
        payload = {
            'connection': self.conn.pk,
            'table_name': 'users',
            'batch_size': 100,
            'offset': 0,
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'completed')
        self.assertEqual(response.data['row_count'], 2)
        self.assertEqual(response.data['columns'], ['id', 'name'])

        # Verify DataRecords were created
        batch_id = response.data['id']
        self.assertEqual(DataRecord.objects.filter(batch_id=batch_id).count(), 2)

    @patch('extractions.views.ConnectorFactory.get_connector')
    def test_create_batch_connector_failure(self, mock_factory):
        mock_connector = MagicMock()
        mock_connector.fetch_data.side_effect = Exception('DB is down')
        mock_factory.return_value = mock_connector

        url = reverse('extractionbatch-list')
        payload = {
            'connection': self.conn.pk,
            'table_name': 'users',
            'batch_size': 100,
            'offset': 0,
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        # Batch should be marked failed
        batch_id = response.data['batch_id']
        batch = ExtractionBatch.objects.get(pk=batch_id)
        self.assertEqual(batch.status, 'failed')
        self.assertIn('DB is down', batch.error_message)

    def test_create_batch_missing_connection(self):
        url = reverse('extractionbatch-list')
        payload = {
            'connection': 9999,
            'table_name': 'users',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class SubmitDataTestCase(APITestCase):
    """Test the submit action."""

    def setUp(self):
        self.user = make_user('submituser')
        token = get_token(self.client, 'submituser')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.conn = make_connection(self.user)

        # Pre-create a completed batch with records
        self.batch = ExtractionBatch.objects.create(
            connection=self.conn,
            table_name='products',
            batch_size=10,
            offset=0,
            status='completed',
            created_by=self.user,
            row_count=2,
            columns=['id', 'price'],
        )
        DataRecord.objects.create(batch=self.batch, row_index=0, data={'id': 1, 'price': 10.0})
        DataRecord.objects.create(batch=self.batch, row_index=1, data={'id': 2, 'price': 20.0})

    @patch('storage.services.save_to_file')
    def test_submit_records(self, mock_save):
        mock_save.return_value = MagicMock()
        url = reverse('extractionbatch-submit', kwargs={'pk': self.batch.pk})
        payload = {
            'records': [
                {'row_index': 0, 'data': {'id': 1, 'price': 15.0}},
                {'row_index': 1, 'data': {'id': 2, 'price': 25.0}},
            ]
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated_count'], 2)

        # Verify DB was updated
        r0 = DataRecord.objects.get(batch=self.batch, row_index=0)
        self.assertEqual(r0.data['price'], 15.0)
        self.assertTrue(r0.is_modified)

        # Verify save_to_file was called twice (json + csv)
        self.assertEqual(mock_save.call_count, 2)

    def test_submit_invalid_row_index(self):
        url = reverse('extractionbatch-submit', kwargs={'pk': self.batch.pk})
        payload = {
            'records': [
                {'row_index': 999, 'data': {'id': 99}},
            ]
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_submit_empty_records(self):
        url = reverse('extractionbatch-submit', kwargs={'pk': self.batch.pk})
        payload = {'records': []}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ListBatchTestCase(APITestCase):
    """Test list / retrieve for ExtractionBatch."""

    def setUp(self):
        self.user = make_user('listbatch')
        self.other = make_user('otherbatch')
        token = get_token(self.client, 'listbatch')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.conn = make_connection(self.user)
        self.other_conn = make_connection(self.other)
        # Rename to avoid unique_together conflict
        self.other_conn.name = 'Other Conn'
        self.other_conn.save()

        ExtractionBatch.objects.create(
            connection=self.conn, table_name='t1', status='completed',
            created_by=self.user, row_count=1, columns=['a'],
        )
        ExtractionBatch.objects.create(
            connection=self.other_conn, table_name='t2', status='completed',
            created_by=self.other, row_count=1, columns=['b'],
        )

    def test_list_only_own_batches(self):
        url = reverse('extractionbatch-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        table_names = [b['table_name'] for b in response.data['results']]
        self.assertIn('t1', table_names)
        self.assertNotIn('t2', table_names)
