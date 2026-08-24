"""Seed RBAC — reprend exactement le catalogue rôles/permissions déjà en
place côté AGT TaskFlow (backend/database.py, listes PERMISSIONS/ROLES/
ROLE_PERMS + _ext_permissions), pour ne perdre aucune permission existante
lors de la fusion vers Django (cf. plan de migration, Phase A)."""
from django.db import migrations

ROLES = [
    ("superadmin", "Acces total a la plateforme"),
    ("admin", "Consultation (lecture seule)"),
    ("chef_projet", "Gestion de ses projets"),
    ("membre", "Execution de ses taches"),
]

PERMISSIONS = [
    ("membres.read", "membres", "Voir la liste des membres"),
    ("membres.write", "membres", "Modifier un membre"),
    ("membres.validate", "membres", "Valider/rejeter une demande de compte"),
    ("membres.suspend", "membres", "Suspendre/reactiver un compte"),
    ("membres.delete", "membres", "Supprimer un compte"),
    ("roles.manage", "rbac", "Gerer les roles"),
    ("permissions.manage", "rbac", "Gerer les permissions directes"),
    ("projets.read", "projets", "Voir les projets"),
    ("projets.write", "projets", "Creer/modifier un projet"),
    ("dashboard.read", "dashboard", "Consulter le tableau de bord"),
    ("database.export", "admin", "Exporter la base de donnees"),
    ("database.import", "admin", "Importer une base de donnees"),
    ("members.manage", "rbac", "Gerer les membres et leurs statuts"),
    ("operations.manage", "ops", "Gerer activites, besoins, performances"),
]

ROLE_PERMS = {
    "superadmin": [p[0] for p in PERMISSIONS],
    "admin": [
        "membres.read", "membres.write", "membres.validate", "membres.suspend",
        "membres.delete", "projets.read", "dashboard.read", "members.manage",
    ],  # BUG-01 : Admin valide/gère les comptes, pas seulement Superadmin.
    "chef_projet": ["membres.read", "projets.read", "projets.write", "dashboard.read", "operations.manage"],
    "membre": ["dashboard.read"],
}


def seed(apps, schema_editor):
    Role = apps.get_model("authentification", "Role")
    Permission = apps.get_model("authentification", "Permission")
    RolePermission = apps.get_model("authentification", "RolePermission")

    role_objs = {code: Role.objects.get_or_create(code=code, defaults={"description": desc})[0]
                 for code, desc in ROLES}
    perm_objs = {code: Permission.objects.get_or_create(
        code=code, defaults={"module": module, "description": desc})[0]
        for code, module, desc in PERMISSIONS}

    for role_code, perm_codes in ROLE_PERMS.items():
        for perm_code in perm_codes:
            RolePermission.objects.get_or_create(
                role=role_objs[role_code], permission=perm_objs[perm_code]
            )


def unseed(apps, schema_editor):
    Role = apps.get_model("authentification", "Role")
    Permission = apps.get_model("authentification", "Permission")
    Role.objects.filter(code__in=[c for c, _ in ROLES]).delete()
    Permission.objects.filter(code__in=[c for c, _, _ in PERMISSIONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("authentification", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
