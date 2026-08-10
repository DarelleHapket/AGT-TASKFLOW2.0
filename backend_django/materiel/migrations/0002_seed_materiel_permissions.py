"""Étend le catalogue RBAC avec les permissions du Module 2 (materiel.read,
materiel.write — exemple donné littéralement par le CDC lui-même, §3/BF-02).
Accordées à Admin/Superadmin par défaut, comme RH/Finances : le CDC classe
le matériel dans « Ressources de l'entreprise », pilotées par Admin
(Superadmin hérite de tout via bypass, cf. User.is_superadmin)."""
from django.db import migrations

PERMISSIONS = [
    ("materiel.read", "materiel", "Consulter les types de matériel, l'inventaire, le stock et les mouvements"),
    ("materiel.write", "materiel", "Gérer les types de matériel, l'inventaire et enregistrer des mouvements"),
]


def seed(apps, schema_editor):
    Role = apps.get_model("authentification", "Role")
    Permission = apps.get_model("authentification", "Permission")
    RolePermission = apps.get_model("authentification", "RolePermission")

    perm_objs = {code: Permission.objects.get_or_create(
        code=code, defaults={"module": module, "description": desc})[0]
        for code, module, desc in PERMISSIONS}

    for role_code in ("admin", "superadmin"):
        role = Role.objects.filter(code=role_code).first()
        if role:
            for code in perm_objs:
                RolePermission.objects.get_or_create(role=role, permission=perm_objs[code])


def unseed(apps, schema_editor):
    Permission = apps.get_model("authentification", "Permission")
    Permission.objects.filter(code__in=[c for c, _, _ in PERMISSIONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("materiel", "0001_initial"),
        ("authentification", "0002_seed_rbac"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
