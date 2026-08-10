"""Seed des permissions du module pilotage_stage (port de team-tool
accounts/management/commands/seed_all.py — permissions taches:soi/tous,
gerer/valider taches, voir/editer pert). superadmin/admin les ont toutes par
défaut (accès complet à la plateforme) ; membre a la vue personnelle."""
from django.db import migrations

PERMISSIONS = [
    ("pilotage.taches.voir_soi", "pilotage", "Voir ses propres tâches de pilotage"),
    ("pilotage.taches.voir_tous", "pilotage", "Voir toutes les tâches de pilotage"),
    ("pilotage.taches.gerer", "pilotage", "Créer/modifier/supprimer des tâches de pilotage"),
    ("pilotage.taches.valider", "pilotage", "Valider les nœuds bloquants (rôle lead)"),
    ("pilotage.pert.voir", "pilotage", "Voir le plan PERT de pilotage"),
    ("pilotage.pert.editer", "pilotage", "Éditer le plan PERT de pilotage"),
]

ROLE_PERMS = {
    "superadmin": [p[0] for p in PERMISSIONS],
    "admin": [p[0] for p in PERMISSIONS],
    "membre": ["pilotage.taches.voir_soi", "pilotage.pert.voir"],
}


def seed(apps, schema_editor):
    Role = apps.get_model("authentification", "Role")
    Permission = apps.get_model("authentification", "Permission")
    RolePermission = apps.get_model("authentification", "RolePermission")

    perm_objs = {code: Permission.objects.get_or_create(
        code=code, defaults={"module": module, "description": desc})[0]
        for code, module, desc in PERMISSIONS}

    for role_code, perm_codes in ROLE_PERMS.items():
        role = Role.objects.filter(code=role_code).first()
        if not role:
            continue
        for perm_code in perm_codes:
            RolePermission.objects.get_or_create(role=role, permission=perm_objs[perm_code])


def unseed(apps, schema_editor):
    Permission = apps.get_model("authentification", "Permission")
    Permission.objects.filter(code__in=[c for c, _, _ in PERMISSIONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("pilotage_stage", "0001_initial"),
        ("authentification", "0002_seed_rbac"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
