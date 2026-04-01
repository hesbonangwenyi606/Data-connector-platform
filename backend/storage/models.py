from django.db import models


class StoredFile(models.Model):
    FORMAT_CHOICES = [
        ('json', 'JSON'),
        ('csv', 'CSV'),
    ]

    batch = models.ForeignKey(
        'extractions.ExtractionBatch',
        on_delete=models.CASCADE,
        related_name='stored_files',
    )
    file_format = models.CharField(max_length=5, choices=FORMAT_CHOICES)
    file_path = models.FileField(upload_to='exports/%Y/%m/%d/')
    file_size = models.BigIntegerField(default=0)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='stored_files',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # Sharing
    shared_with = models.ManyToManyField(
        'accounts.User',
        related_name='shared_files',
        blank=True,
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.file_format.upper()} export — Batch {self.batch_id} ({self.created_at:%Y-%m-%d})'
