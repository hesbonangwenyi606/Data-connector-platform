import logging
import mimetypes

from django.http import FileResponse, Http404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from .models import StoredFile
from .permissions import CanAccessFile, IsOwnerOrAdmin
from .serializers import ShareFileSerializer, StoredFileSerializer

logger = logging.getLogger(__name__)


class StoredFileViewSet(viewsets.ModelViewSet):
    """
    Manage stored export files.

    list     — admin sees all; user sees own + shared
    retrieve — same permission check (CanAccessFile)
    destroy  — owner or admin only (IsOwnerOrAdmin)
    download — return raw file bytes
    share    — owner or admin can share with other users
    """
    serializer_class = StoredFileSerializer
    permission_classes = [IsAuthenticated]
    # Disable create/update via the default ModelViewSet routes;
    # files are created automatically by the extractions submit action.
    http_method_names = ['get', 'delete', 'head', 'options', 'post']

    def get_queryset(self):
        user = self.request.user
        if user.is_admin():
            return StoredFile.objects.all()
        from django.db.models import Q
        return StoredFile.objects.filter(
            Q(created_by=user) | Q(shared_with=user)
        ).distinct()

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsOwnerOrAdmin()]
        if self.action in ('retrieve', 'download'):
            return [IsAuthenticated(), CanAccessFile()]
        if self.action == 'share':
            return [IsAuthenticated(), IsOwnerOrAdmin()]
        return [IsAuthenticated()]

    # Disable PUT/PATCH — files are immutable once created
    def update(self, request, *args, **kwargs):
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    # ------------------------------------------------------------------
    # download
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        """
        GET /api/storage/{id}/download/
        Stream the file to the client.
        """
        stored_file = self.get_object()

        try:
            file_handle = stored_file.file_path.open('rb')
        except (FileNotFoundError, OSError) as exc:
            logger.error('File not found for StoredFile %s: %s', pk, exc)
            raise Http404('File not found on disk.')

        mime_type, _ = mimetypes.guess_type(stored_file.file_path.name)
        mime_type = mime_type or 'application/octet-stream'

        filename = stored_file.file_path.name.split('/')[-1]
        response = FileResponse(file_handle, content_type=mime_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Content-Length'] = stored_file.file_size
        return response

    # ------------------------------------------------------------------
    # share
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='share')
    def share(self, request, pk=None):
        """
        POST /api/storage/{id}/share/
        Body: {"username": "<username>"}

        Adds the specified user to the shared_with M2M relation.
        """
        stored_file = self.get_object()
        ser = ShareFileSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        # validated_data['username'] is the User instance after validate_username
        target_user = ser.validated_data['username']
        stored_file.shared_with.add(target_user)

        return Response(
            {
                'message': f'File shared with "{target_user.username}" successfully.',
                'shared_with': list(stored_file.shared_with.values_list('id', flat=True)),
            },
            status=status.HTTP_200_OK,
        )
