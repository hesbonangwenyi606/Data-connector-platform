from rest_framework.permissions import BasePermission


class IsOwnerOrAdmin(BasePermission):
    """Allow access only to the object owner or an admin user."""

    def has_object_permission(self, request, view, obj):
        return request.user.is_admin() or obj.created_by == request.user


class CanAccessFile(BasePermission):
    """Allow access to the owner, any user the file is shared with, or an admin."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        return (
            user.is_admin()
            or obj.created_by == user
            or obj.shared_with.filter(pk=user.pk).exists()
        )
