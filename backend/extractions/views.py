import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from connectors.connector import ConnectorFactory
from connectors.models import DatabaseConnection
from .models import DataRecord, ExtractionBatch
from .serializers import (
    DataRecordSerializer,
    ExtractionBatchCreateSerializer,
    ExtractionBatchListSerializer,
    ExtractionBatchSerializer,
    SubmitDataSerializer,
)

logger = logging.getLogger(__name__)


class ExtractionBatchViewSet(viewsets.ModelViewSet):
    """
    Manage extraction batches.

    list/retrieve  — own batches (or all for admin)
    create         — pull a slice from a remote DB and persist locally
    submit         — accept modified records → update DB + write files
    records        — list DataRecords belonging to a batch
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ExtractionBatch.objects.select_related('connection', 'created_by')
        if user.is_admin():
            return qs
        return qs.filter(created_by=user)

    def get_serializer_class(self):
        if self.action == 'list':
            return ExtractionBatchListSerializer
        if self.action in ('retrieve', 'records'):
            return ExtractionBatchSerializer
        return ExtractionBatchSerializer

    # ------------------------------------------------------------------
    # create — fetch from remote DB and persist
    # ------------------------------------------------------------------

    def create(self, request, *args, **kwargs):
        input_ser = ExtractionBatchCreateSerializer(data=request.data)
        input_ser.is_valid(raise_exception=True)
        data = input_ser.validated_data

        # Validate connection ownership
        try:
            if request.user.is_admin():
                db_conn = DatabaseConnection.objects.get(pk=data['connection'])
            else:
                db_conn = DatabaseConnection.objects.get(pk=data['connection'], created_by=request.user)
        except DatabaseConnection.DoesNotExist:
            return Response({'error': 'Connection not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        # Create batch record in "processing" state
        batch = ExtractionBatch.objects.create(
            connection=db_conn,
            table_name=data['table_name'],
            batch_size=data['batch_size'],
            offset=data['offset'],
            status='processing',
            created_by=request.user,
        )

        connector = None
        try:
            connector = ConnectorFactory.get_connector(db_conn)
            fetched = connector.fetch_data(
                table=data['table_name'],
                batch_size=data['batch_size'],
                offset=data['offset'],
            )

            columns = fetched['columns']
            rows = fetched['rows']

            # Persist records
            records_to_create = []
            for idx, row in enumerate(rows):
                row_data = dict(zip(columns, row)) if columns else {}
                records_to_create.append(
                    DataRecord(
                        batch=batch,
                        row_index=data['offset'] + idx,
                        data=row_data,
                    )
                )
            DataRecord.objects.bulk_create(records_to_create)

            # Update batch metadata
            batch.columns = columns
            batch.row_count = len(rows)
            batch.status = 'completed'
            batch.save(update_fields=['columns', 'row_count', 'status'])

        except Exception as exc:
            logger.error('ExtractionBatch %s failed: %s', batch.pk, exc)
            batch.status = 'failed'
            batch.error_message = str(exc)
            batch.save(update_fields=['status', 'error_message'])
            return Response(
                {'error': str(exc), 'batch_id': batch.pk},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        finally:
            if connector:
                try:
                    connector.disconnect()
                except Exception:
                    pass

        out_ser = ExtractionBatchSerializer(batch, context={'request': request})
        return Response(out_ser.data, status=status.HTTP_201_CREATED)

    # ------------------------------------------------------------------
    # submit — receive modified records, update DB, trigger file storage
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='submit')
    def submit(self, request, pk=None):
        """
        POST /api/extractions/{id}/submit/
        Body: {"records": [{"row_index": 0, "data": {...}}, ...]}

        Updates DataRecord rows in the database, marks them as modified,
        then triggers dual storage (DB already updated + file on disk).
        """
        batch = self.get_object()

        if batch.status not in ('completed', 'failed'):
            return Response(
                {'error': f'Cannot submit records for a batch in "{batch.status}" state.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        input_ser = SubmitDataSerializer(data=request.data)
        input_ser.is_valid(raise_exception=True)
        submitted_records = input_ser.validated_data['records']

        # Build a lookup of existing records by row_index
        existing = {r.row_index: r for r in batch.records.all()}

        updated = []
        errors = []
        for item in submitted_records:
            idx = item['row_index']
            record = existing.get(idx)
            if record is None:
                errors.append(f'row_index {idx} does not exist in this batch.')
                continue
            record.data = item['data']
            record.is_modified = True
            updated.append(record)

        if errors:
            return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        # Bulk-update the modified records
        DataRecord.objects.bulk_update(updated, fields=['data', 'is_modified', 'updated_at'])

        # ---- Dual storage: write to file as well ----------------------
        try:
            from storage.services import save_to_file
            all_records_data = [
                {'row_index': r.row_index, 'data': r.data}
                for r in batch.records.all().order_by('row_index')
            ]
            # Save both JSON and CSV
            save_to_file(batch=batch, records_data=all_records_data, file_format='json', created_by=request.user)
            save_to_file(batch=batch, records_data=all_records_data, file_format='csv', created_by=request.user)
        except Exception as exc:
            logger.error('File storage failed for batch %s: %s', batch.pk, exc)
            # File storage failure should not roll back the DB changes
            return Response(
                {
                    'message': 'Records saved to database but file storage failed.',
                    'file_error': str(exc),
                    'updated_count': len(updated),
                },
                status=status.HTTP_207_MULTI_STATUS,
            )

        return Response(
            {
                'message': 'Records updated and files generated successfully.',
                'updated_count': len(updated),
            },
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # records — list DataRecords for a batch
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='records')
    def records(self, request, pk=None):
        """
        GET /api/extractions/{id}/records/
        Returns the DataRecords belonging to this batch.
        """
        batch = self.get_object()
        queryset = batch.records.all().order_by('row_index')

        page = self.paginate_queryset(queryset)
        if page is not None:
            ser = DataRecordSerializer(page, many=True)
            return self.get_paginated_response(ser.data)

        ser = DataRecordSerializer(queryset, many=True)
        return Response(ser.data)
