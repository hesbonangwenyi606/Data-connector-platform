from django.contrib import admin
from .models import DatabaseConnection


@admin.register(DatabaseConnection)
class DatabaseConnectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'db_type', 'host', 'port', 'database', 'created_by', 'is_active', 'created_at']
    list_filter = ['db_type', 'is_active']
    search_fields = ['name', 'host', 'database', 'created_by__username']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
