from rest_framework import serializers
from .models import ExtractionBatch, DataRecord


class DataRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataRecord
        fields = ['id', 'row_index', 'data', 'is_modified', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ExtractionBatchSerializer(serializers.ModelSerializer):
    """Full read serializer — includes nested records."""
    records = DataRecordSerializer(many=True, read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by_username = serializers.SerializerMethodField()
    connection_name = serializers.SerializerMethodField()

    class Meta:
        model = ExtractionBatch
        fields = [
            'id',
            'connection',
            'connection_name',
            'table_name',
            'batch_size',
            'offset',
            'status',
            'created_by',
            'created_by_username',
            'created_at',
            'row_count',
            'columns',
            'error_message',
            'records',
        ]
        read_only_fields = [
            'id', 'status', 'created_by', 'created_by_username',
            'connection_name', 'created_at', 'row_count', 'columns',
            'error_message', 'records',
        ]

    def get_created_by_username(self, obj):
        return obj.created_by.username if obj.created_by else None

    def get_connection_name(self, obj):
        return obj.connection.name if obj.connection else None


class ExtractionBatchListSerializer(serializers.ModelSerializer):
    """Lightweight list serializer — omits nested records for performance."""
    created_by_username = serializers.SerializerMethodField()
    connection_name = serializers.SerializerMethodField()

    class Meta:
        model = ExtractionBatch
        fields = [
            'id',
            'connection',
            'connection_name',
            'table_name',
            'batch_size',
            'offset',
            'status',
            'created_by',
            'created_by_username',
            'created_at',
            'row_count',
            'columns',
            'error_message',
        ]

    def get_created_by_username(self, obj):
        return obj.created_by.username if obj.created_by else None

    def get_connection_name(self, obj):
        return obj.connection.name if obj.connection else None


class ExtractionBatchCreateSerializer(serializers.Serializer):
    """Input serializer for creating a new extraction batch."""
    connection = serializers.IntegerField()
    table_name = serializers.CharField(max_length=255)
    batch_size = serializers.IntegerField(default=100, min_value=1, max_value=10_000)
    offset = serializers.IntegerField(default=0, min_value=0)


class SubmitRecordSerializer(serializers.Serializer):
    """Single record submitted for update."""
    row_index = serializers.IntegerField(min_value=0)
    data = serializers.DictField()


class SubmitDataSerializer(serializers.Serializer):
    """Payload accepted by the /submit/ action."""
    records = SubmitRecordSerializer(many=True)

    def validate_records(self, value):
        if not value:
            raise serializers.ValidationError('At least one record is required.')
        # Check for duplicate row_index
        indices = [r['row_index'] for r in value]
        if len(indices) != len(set(indices)):
            raise serializers.ValidationError('Duplicate row_index values found.')
        return value
