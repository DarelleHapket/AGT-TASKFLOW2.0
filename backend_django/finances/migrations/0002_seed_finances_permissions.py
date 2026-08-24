"""Étend le catalogue RBAC avec les permissions du Module 4. Aucune n'est
accordée à Membre ou Chef de projet, même par défaut — les finances
concernent exclusivement le dirigeant (Document d'Analyse §8)."""
from django.db import migrations

PERMISSIONS = [
    ("finances.mouvements.gerer", "finances", "Enregistrer un mouvement financier"),
    ("finances.bilan.voir", "finances", "Générer/consulter le bilan"),
    ("finances.previsions.gerer", "finances", "Créer/consulter les prévisions"),
    ("finances.rapports.telecharger", "finances", "Générer un rapport financier PDF/TXT"),
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
        ("finances", "0001_initial"),
        ("authentification", "0002_seed_rbac"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
