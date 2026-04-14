from rest_framework import serializers
from .models import DatabaseConnection


class DatabaseConnectionSerializer(serializers.ModelSerializer):
    """Full serializer for DatabaseConnection.

    - password is write-only so it is never returned in responses.
    - created_by is set automatically from the request user.
    """
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by_username = serializers.SerializerMethodField(read_only=True)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'}, allow_blank=True, default='')

    class Meta:
        model = DatabaseConnection
        fields = [
            'id',
            'name',
            'db_type',
            'host',
            'port',
            'database',
            'username',
            'password',
            'created_by',
            'created_by_username',
            'created_at',
            'updated_at',
            'is_active',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_username', 'created_at', 'updated_at']

    def get_created_by_username(self, obj):
        return obj.created_by.username if obj.created_by else None
