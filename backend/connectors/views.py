import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .connector import ConnectorFactory
from .models import DatabaseConnection
from .serializers import DatabaseConnectionSerializer

logger = logging.getLogger(__name__)


class DatabaseConnectionViewSet(viewsets.ModelViewSet):
    """
    CRUD + extra actions for database connections.

    Regular users see only their own connections.
    Admin users see all connections.
    """
    serializer_class = DatabaseConnectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin():
            return DatabaseConnection.objects.all()
        return DatabaseConnection.objects.filter(created_by=user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    # ------------------------------------------------------------------
    # Extra actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='test')
    def test_connection(self, request, pk=None):
        """
        POST /api/connectors/{id}/test/
        Test whether the stored credentials can open a live connection.
        """
        db_conn = self.get_object()
        connector = None
        try:
            connector = ConnectorFactory.get_connector(db_conn)
            ok = connector.test_connection()
            if ok:
                return Response({'success': True, 'message': 'Connection successful.'})
            return Response(
                {'success': False, 'message': 'Connection failed. Check credentials and host.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            logger.error('test_connection error for connection %s: %s', pk, exc)
            return Response(
                {'success': False, 'message': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        finally:
            if connector:
                try:
                    connector.disconnect()
                except Exception:
                    pass

    @action(detail=True, methods=['get'], url_path='tables')
    def tables(self, request, pk=None):
        """
        GET /api/connectors/{id}/tables/
        Return a list of available tables (or collections for MongoDB).
        """
        db_conn = self.get_object()
        connector = None
        try:
            connector = ConnectorFactory.get_connector(db_conn)
            table_list = connector.get_tables()
            return Response({'tables': table_list})
        except Exception as exc:
            logger.error('get_tables error for connection %s: %s', pk, exc)
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            if connector:
                try:
                    connector.disconnect()
                except Exception:
                    pass

    @action(detail=True, methods=['get'], url_path='fetch')
    def fetch(self, request, pk=None):
        """
        GET /api/connectors/{id}/fetch/?table=<name>&batch_size=100&offset=0
        Fetch a batch of data from the specified table.
        """
        db_conn = self.get_object()
        table = request.query_params.get('table')
        if not table:
            return Response({'error': 'Query parameter "table" is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch_size = int(request.query_params.get('batch_size', 100))
            offset = int(request.query_params.get('offset', 0))
        except ValueError:
            return Response({'error': 'batch_size and offset must be integers.'}, status=status.HTTP_400_BAD_REQUEST)

        connector = None
        try:
            connector = ConnectorFactory.get_connector(db_conn)
            data = connector.fetch_data(table=table, batch_size=batch_size, offset=offset)
            return Response(data)
        except Exception as exc:
            logger.error('fetch_data error for connection %s table %s: %s', pk, table, exc)
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            if connector:
                try:
                    connector.disconnect()
                except Exception:
                    pass
