from django.contrib import admin

from .models import AttributionRole, Permission, PermissionEffective, Role, User

admin.site.register(User)
admin.site.register(Role)
admin.site.register(Permission)
admin.site.register(AttributionRole)
admin.site.register(PermissionEffective)
