from django.db import models


class ExtractionBatch(models.Model):
    STATUS = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    connection = models.ForeignKey(
        'connectors.DatabaseConnection',
        on_delete=models.CASCADE,
        related_name='batches',
    )
    table_name = models.CharField(max_length=255)
    batch_size = models.IntegerField(default=100)
    offset = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS, default='pending')
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='batches',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    row_count = models.IntegerField(default=0)
    columns = models.JSONField(default=list)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Batch {self.pk} — {self.table_name} ({self.status})'


class DataRecord(models.Model):
    batch = models.ForeignKey(
        ExtractionBatch,
        on_delete=models.CASCADE,
        related_name='records',
    )
    row_index = models.IntegerField()
    data = models.JSONField()
    is_modified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['row_index']
        unique_together = ['batch', 'row_index']

    def __str__(self):
        return f'Record {self.row_index} of Batch {self.batch_id}'
