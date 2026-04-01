from rest_framework import serializers
from accounts.models import User
from .models import StoredFile


class StoredFileSerializer(serializers.ModelSerializer):
    """Full read serializer for StoredFile."""
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by_username = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    shared_with = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = StoredFile
        fields = [
            'id',
            'batch',
            'file_format',
            'file_path',
            'file_url',
            'file_size',
            'created_by',
            'created_by_username',
            'created_at',
            'shared_with',
        ]
        read_only_fields = fields

    def get_created_by_username(self, obj):
        return obj.created_by.username if obj.created_by else None

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file_path and request:
            return request.build_absolute_uri(obj.file_path.url)
        return None


class ShareFileSerializer(serializers.Serializer):
    """Payload for the share action — accepts a username string."""
    username = serializers.CharField(max_length=150)

    def validate_username(self, value):
        try:
            user = User.objects.get(username=value)
        except User.DoesNotExist:
            raise serializers.ValidationError(f'User "{value}" not found.')
        return user  # return the User instance directly
