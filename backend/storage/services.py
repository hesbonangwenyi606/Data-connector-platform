"""
Service layer for persisting extraction data to files on disk.

Each call to ``save_to_file`` creates one ``StoredFile`` record in the
database and writes the actual file to ``MEDIA_ROOT/exports/<Y>/<m>/<d>/``.
"""

import csv
import json
import logging
import os
from datetime import datetime

from django.conf import settings
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)


def _build_metadata(batch) -> dict:
    """Build a metadata dict describing the origin of the data."""
    return {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'connection_name': batch.connection.name,
        'db_type': batch.connection.db_type,
        'table_name': batch.table_name,
        'batch_size': batch.batch_size,
        'offset': batch.offset,
        'row_count': batch.row_count,
    }


def save_to_file(batch, records_data: list, file_format: str = 'json', created_by=None):
    """
    Persist *records_data* to a file and create a ``StoredFile`` DB record.

    Parameters
    ----------
    batch : extractions.models.ExtractionBatch
    records_data : list[dict]
        Each element has keys ``row_index`` and ``data``.
    file_format : str
        Either ``'json'`` or ``'csv'``.
    created_by : accounts.models.User
        Owner of the resulting StoredFile record.

    Returns
    -------
    storage.models.StoredFile
    """
    # Import here to avoid circular imports at module load time
    from storage.models import StoredFile

    if file_format not in ('json', 'csv'):
        raise ValueError(f'Unsupported file format: {file_format}')

    metadata = _build_metadata(batch)
    timestamp_str = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    filename = f'batch_{batch.pk}_{batch.table_name}_{timestamp_str}.{file_format}'

    if file_format == 'json':
        content_bytes = _build_json(metadata, records_data)
    else:
        content_bytes = _build_csv(metadata, batch, records_data)

    # Use Django's FileField / storage backend to write the file
    stored_file = StoredFile(
        batch=batch,
        file_format=file_format,
        file_size=len(content_bytes),
        created_by=created_by or batch.created_by,
    )
    stored_file.file_path.save(filename, ContentFile(content_bytes), save=False)
    stored_file.file_size = len(content_bytes)
    stored_file.save()

    logger.info(
        'Saved %s file for batch %s → %s (%d bytes)',
        file_format.upper(),
        batch.pk,
        stored_file.file_path.name,
        len(content_bytes),
    )
    return stored_file


def _build_json(metadata: dict, records_data: list) -> bytes:
    """Serialize records to JSON with metadata wrapper."""
    payload = {
        'metadata': metadata,
        'records': records_data,
    }
    return json.dumps(payload, indent=2, default=str).encode('utf-8')


def _build_csv(metadata: dict, batch, records_data: list) -> bytes:
    """Serialize records to CSV. First rows contain metadata comments."""
    import io

    buf = io.StringIO()

    # Write metadata as comment lines
    for key, value in metadata.items():
        buf.write(f'# {key}: {value}\n')

    # Determine columns from batch or from records themselves
    columns = batch.columns or []
    if not columns and records_data:
        # Derive columns from the first record's data keys
        first_data = records_data[0].get('data', {})
        columns = list(first_data.keys())

    writer = csv.DictWriter(
        buf,
        fieldnames=['row_index'] + columns,
        extrasaction='ignore',
        lineterminator='\n',
    )
    writer.writeheader()

    for item in records_data:
        row = {'row_index': item.get('row_index', '')}
        row.update(item.get('data', {}))
        writer.writerow(row)

    return buf.getvalue().encode('utf-8')
