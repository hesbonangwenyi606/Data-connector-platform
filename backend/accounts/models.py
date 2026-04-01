from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('user', 'User'),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def is_admin(self):
        """Return True if the user has admin role or is a Django superuser."""
        return self.role == 'admin' or self.is_superuser

    def __str__(self):
        return f'{self.username} ({self.role})'
