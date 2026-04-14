from django.db import models


class DatabaseConnection(models.Model):
    DB_TYPES = [
        ('postgresql', 'PostgreSQL'),
        ('mysql', 'MySQL'),
        ('mongodb', 'MongoDB'),
        ('clickhouse', 'ClickHouse'),
    ]

    name = models.CharField(max_length=255)
    db_type = models.CharField(max_length=20, choices=DB_TYPES)
    host = models.CharField(max_length=255)
    port = models.IntegerField()
    database = models.CharField(max_length=255)
    username = models.CharField(max_length=255)
    # NOTE: Store encrypted in production (e.g. using django-cryptography or Vault)
    password = models.CharField(max_length=255, blank=True, default='')
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='connections',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ['name', 'created_by']
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.db_type}) — {self.created_by.username}'
