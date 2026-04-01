from django.contrib import admin
from .models import DataRecord, ExtractionBatch


class DataRecordInline(admin.TabularInline):
    model = DataRecord
    extra = 0
    readonly_fields = ['row_index', 'data', 'is_modified', 'created_at', 'updated_at']
    can_delete = False


@admin.register(ExtractionBatch)
class ExtractionBatchAdmin(admin.ModelAdmin):
    list_display = ['id', 'table_name', 'connection', 'status', 'row_count', 'created_by', 'created_at']
    list_filter = ['status', 'connection__db_type']
    search_fields = ['table_name', 'created_by__username', 'connection__name']
    readonly_fields = ['created_at', 'row_count', 'columns', 'error_message']
    inlines = [DataRecordInline]


@admin.register(DataRecord)
class DataRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'batch', 'row_index', 'is_modified', 'created_at']
    list_filter = ['is_modified']
    search_fields = ['batch__table_name']
    readonly_fields = ['created_at', 'updated_at']
