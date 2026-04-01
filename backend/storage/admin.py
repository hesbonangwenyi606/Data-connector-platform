from django.contrib import admin
from .models import StoredFile


@admin.register(StoredFile)
class StoredFileAdmin(admin.ModelAdmin):
    list_display = ['id', 'batch', 'file_format', 'file_size', 'created_by', 'created_at']
    list_filter = ['file_format']
    search_fields = ['batch__table_name', 'created_by__username']
    readonly_fields = ['created_at', 'file_size', 'file_path']
    filter_horizontal = ['shared_with']
