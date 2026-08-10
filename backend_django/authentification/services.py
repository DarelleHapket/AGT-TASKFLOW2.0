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
    """Retire un rôle et les permissions que CE rôle avait copiées (source='role'),
    sauf si un autre rôle encore actif chez l'utilisateur les accorde aussi, ou
    si elles ont été accordées/retirées directement (source='direct', IBAC,
    toujours prioritaire — BF-05). Révision du 2026-08-10 à la demande du
    donneur d'ordre : l'ancien comportement laissait les permissions de rôle
    orphelines après un changement de rôle (ex: Admin -> Membre gardait
    membres.write)."""
    role = Role.objects.filter(code=role_code).first()
    if not role:
        return
    AttributionRole.objects.filter(user=user, role=role).delete()

    remaining_role_codes = user.attributionrole_set.values_list("role__code", flat=True)
    remaining_perm_ids = set(
        Permission.objects.filter(roles__code__in=remaining_role_codes).values_list("id", flat=True)
    )
    for perm in role.permissions.all():
        if perm.id in remaining_perm_ids:
            continue  # encore accordée via un autre rôle actif de l'utilisateur
        PermissionEffective.objects.filter(
            user=user, permission=perm, source=PermissionEffective.SOURCE_ROLE
        ).delete()


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
