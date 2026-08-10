"""Logique RBAC + IBAC — port de backend/utils/rbac.py (AGT) et
team-tool/backend/accounts/services.py (fabriques de permissions DRF).
"""
from rest_framework.permissions import BasePermission

from .models import AttributionRole, PermissionEffective, Permission, Role

PRINCIPAL_ROLES = {"superadmin", "admin", "chef_projet", "membre"}


def assign_role(user, role_code, assigned_by=None):
    """Attribue un rôle : copie ses permissions par défaut (source='role').
    BF-05 : les permissions déjà accordées directement (source='direct') ne
    sont jamais écrasées par une attribution de rôle."""
    role = Role.objects.get(code=role_code)
    AttributionRole.objects.get_or_create(user=user, role=role, defaults={"assigne_par": assigned_by})
    for perm in role.permissions.all():
        obj, created = PermissionEffective.objects.get_or_create(
            user=user, permission=perm, defaults={"accordee": True, "source": PermissionEffective.SOURCE_ROLE}
        )
        if not created and obj.source == PermissionEffective.SOURCE_ROLE and not obj.accordee:
            obj.accordee = True
            obj.save(update_fields=["accordee", "mis_a_jour_le"])


def revoke_role(user, role_code):
    """Retire un rôle. Les permissions déjà copiées restent (découplées, BF-05) —
    seul un retrait direct explicite les enlève."""
    role = Role.objects.filter(code=role_code).first()
    if role:
        AttributionRole.objects.filter(user=user, role=role).delete()


def grant_permission(user, perm_code):
    """Accorde une permission directe (IBAC), indépendamment des rôles."""
    perm = Permission.objects.get(code=perm_code)
    PermissionEffective.objects.update_or_create(
        user=user, permission=perm, defaults={"accordee": True, "source": PermissionEffective.SOURCE_DIRECT}
    )


def revoke_permission(user, perm_code):
    """Retire une permission (même héritée d'un rôle) sans toucher au(x) rôle(s)."""
    perm = Permission.objects.get(code=perm_code)
    PermissionEffective.objects.update_or_create(
        user=user, permission=perm, defaults={"accordee": False, "source": PermissionEffective.SOURCE_DIRECT}
    )


def HasPerm(code):
    """Fabrique de permission DRF branchée sur le modèle RBAC+IBAC maison."""
    class _P(BasePermission):
        message = f"Permission requise : {code}"

        def has_permission(self, request, view):
            return request.user.is_authenticated and request.user.peut(code)
    return _P


class IsSuperadmin(BasePermission):
    message = "Réservé au superadmin."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superadmin()
