"""Congés et notes de frais (espace salarié) — ajoutés hors cahier des
charges initial, à la demande explicite du donneur d'ordre le 2026-08-10
(CDC à mettre à jour a posteriori). Mêmes règles RBAC que le reste du
Module 3 : seuls Admin et Superadmin gèrent/valident, Membre et Chef de
projet n'obtiennent aucune de ces permissions (cf. 0002_seed_rh_permissions)
— ils posent leurs propres demandes sans permission particulière (BNF-09,
même logique que mon_salaire)."""
from django.db import migrations

PERMISSIONS = [
    ("rh.conges.gerer", "rh", "Valider/refuser les demandes de congé de n'importe quel employé"),
    ("rh.notes_frais.gerer", "rh", "Valider/refuser les notes de frais de n'importe quel employé"),
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
        ("rh", "0003_conge_notefrais"),
        ("authentification", "0002_seed_rbac"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
