import json
import os
import tempfile
from unittest.mock import MagicMock, patch

from django.core.files.base import ContentFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from connectors.models import DatabaseConnection
from extractions.models import DataRecord, ExtractionBatch
from storage.models import StoredFile
from storage.services import save_to_file


def make_user(username, password='pass12345', role='user'):
    return User.objects.create_user(username=username, password=password, role=role)


def get_token(client, username, password='pass12345'):
    url = reverse('token_obtain_pair')
    resp = client.post(url, {'username': username, 'password': password}, format='json')
    return resp.data['access']


def make_batch(user):
    conn = DatabaseConnection.objects.create(
        created_by=user,
        name=f'conn_{user.username}',
        db_type='postgresql',
        host='localhost',
        port=5432,
        database='db',
        username='u',
        password='p',
    )
    batch = ExtractionBatch.objects.create(
        connection=conn,
        table_name='orders',
        batch_size=10,
        offset=0,
        status='completed',
        created_by=user,
        row_count=2,
        columns=['id', 'amount'],
    )
    DataRecord.objects.create(batch=batch, row_index=0, data={'id': 1, 'amount': 100})
    DataRecord.objects.create(batch=batch, row_index=1, data={'id': 2, 'amount': 200})
    return batch


class SaveToFileServiceTestCase(APITestCase):
    """Unit tests for the save_to_file service function."""

    def setUp(self):
        self.user = make_user('svcuser')
        self.batch = make_batch(self.user)
        self.records_data = [
            {'row_index': 0, 'data': {'id': 1, 'amount': 100}},
            {'row_index': 1, 'data': {'id': 2, 'amount': 200}},
        ]

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_save_json(self):
        sf = save_to_file(self.batch, self.records_data, file_format='json', created_by=self.user)
        self.assertIsNotNone(sf.pk)
        self.assertEqual(sf.file_format, 'json')
        self.assertGreater(sf.file_size, 0)

        # Read back and verify JSON structure
        with sf.file_path.open('rb') as f:
            data = json.loads(f.read())
        self.assertIn('metadata', data)
        self.assertIn('records', data)
        self.assertEqual(len(data['records']), 2)
        self.assertEqual(data['metadata']['table_name'], 'orders')

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_save_csv(self):
        sf = save_to_file(self.batch, self.records_data, file_format='csv', created_by=self.user)
        self.assertEqual(sf.file_format, 'csv')
        self.assertGreater(sf.file_size, 0)

        with sf.file_path.open('rb') as f:
            content = f.read().decode('utf-8')
        self.assertIn('row_index', content)
        self.assertIn('amount', content)

    def test_save_unsupported_format(self):
        with self.assertRaises(ValueError):
            save_to_file(self.batch, self.records_data, file_format='xlsx', created_by=self.user)


class StoredFilePermissionsTestCase(APITestCase):
    """Test file access permissions."""

    def setUp(self):
        self.owner = make_user('fileowner')
        self.other = make_user('fileother')
        self.shared = make_user('fileshared')
        self.admin = make_user('fileadmin', role='admin')
        # Make admin a Django staff/superuser too so IsAdminUser passes
        self.admin.is_staff = True
        self.admin.is_superuser = True
        self.admin.save()

        self.batch = make_batch(self.owner)
        self.stored_file = StoredFile.objects.create(
            batch=self.batch,
            file_format='json',
            file_size=100,
            created_by=self.owner,
        )
        # Assign a dummy file path so URL resolution works
        self.stored_file.file_path.name = 'exports/2024/01/01/dummy.json'
        self.stored_file.save()

        self.stored_file.shared_with.add(self.shared)

        self.owner_token = get_token(self.client, 'fileowner')
        self.other_token = get_token(self.client, 'fileother')
        self.shared_token = get_token(self.client, 'fileshared')
        self.admin_token = get_token(self.client, 'fileadmin')

    def _list(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return self.client.get(reverse('storedfile-list'))

    def _retrieve(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return self.client.get(reverse('storedfile-detail', kwargs={'pk': self.stored_file.pk}))

    def test_owner_can_list(self):
        resp = self._list(self.owner_token)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [f['id'] for f in resp.data['results']]
        self.assertIn(self.stored_file.pk, ids)

    def test_other_cannot_see_file(self):
        resp = self._list(self.other_token)
        ids = [f['id'] for f in resp.data['results']]
        self.assertNotIn(self.stored_file.pk, ids)

    def test_shared_user_can_see_file(self):
        resp = self._list(self.shared_token)
        ids = [f['id'] for f in resp.data['results']]
        self.assertIn(self.stored_file.pk, ids)

    def test_admin_can_see_all(self):
        resp = self._list(self.admin_token)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [f['id'] for f in resp.data['results']]
        self.assertIn(self.stored_file.pk, ids)

    def test_other_cannot_retrieve(self):
        resp = self._retrieve(self.other_token)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_shared_can_retrieve(self):
        resp = self._retrieve(self.shared_token)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_other_cannot_delete(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_token}')
        resp = self.client.delete(reverse('storedfile-detail', kwargs={'pk': self.stored_file.pk}))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_delete(self):
        sf2 = StoredFile.objects.create(
            batch=self.batch,
            file_format='csv',
            file_size=50,
            created_by=self.owner,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.owner_token}')
        resp = self.client.delete(reverse('storedfile-detail', kwargs={'pk': sf2.pk}))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)


class ShareFileTestCase(APITestCase):
    """Test the share action."""

    def setUp(self):
        self.owner = make_user('shareowner')
        self.target = make_user('sharetarget')
        self.batch = make_batch(self.owner)
        self.sf = StoredFile.objects.create(
            batch=self.batch,
            file_format='json',
            file_size=100,
            created_by=self.owner,
        )
        token = get_token(self.client, 'shareowner')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def test_owner_can_share(self):
        url = reverse('storedfile-share', kwargs={'pk': self.sf.pk})
        resp = self.client.post(url, {'shared_with': [self.target.pk]}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.sf.refresh_from_db()
        self.assertIn(self.target, self.sf.shared_with.all())

    def test_share_with_nonexistent_user(self):
        url = reverse('storedfile-share', kwargs={'pk': self.sf.pk})
        resp = self.client.post(url, {'shared_with': [99999]}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
