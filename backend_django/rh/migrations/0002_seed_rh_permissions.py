"""Étend le catalogue RBAC (authentification) avec les permissions du Module 3.
Superadmin les obtient automatiquement (bypass total, cf. User.is_superadmin).
Admin les obtient toutes explicitement. Membre et Chef de projet n'en
obtiennent aucune — cf. Document_Conception_Module3-4_v1.0.md §4."""
from django.db import migrations

PERMISSIONS = [
    ("rh.read", "rh", "Consulter le référentiel RH (compétences, postes, équipes)"),
    ("rh.write", "rh", "Gérer le référentiel RH"),
    ("rh.employes.gerer", "rh", "Créer employés, contrats, rémunérations"),
    ("rh.disponibilite.gerer", "rh", "Modifier la disponibilité de n'importe quel employé"),
    ("rh.recrutement.gerer", "rh", "Gérer offres, candidats, décisions"),
    ("rh.formations.gerer", "rh", "Gérer catalogue et inscriptions aux formations"),
    ("rh.signalements.traiter", "rh", "Consulter/traiter les signalements"),
]

ADMIN_PERMS = [code for code, _, _ in PERMISSIONS]


def seed(apps, schema_editor):
    Role = apps.get_model("authentification", "Role")
    Permission = apps.get_model("authentification", "Permission")
    RolePermission = apps.get_model("authentification", "RolePermission")

    perm_objs = {code: Permission.objects.get_or_create(
        code=code, defaults={"module": module, "description": desc})[0]
        for code, module, desc in PERMISSIONS}

    admin_role = Role.objects.filter(code="admin").first()
    if admin_role:
        for code in ADMIN_PERMS:
            RolePermission.objects.get_or_create(role=admin_role, permission=perm_objs[code])

    superadmin_role = Role.objects.filter(code="superadmin").first()
    if superadmin_role:
        for code in ADMIN_PERMS:
            RolePermission.objects.get_or_create(role=superadmin_role, permission=perm_objs[code])


def unseed(apps, schema_editor):
    Permission = apps.get_model("authentification", "Permission")
    Permission.objects.filter(code__in=[c for c, _, _ in PERMISSIONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("rh", "0001_initial"),
        ("authentification", "0002_seed_rbac"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
