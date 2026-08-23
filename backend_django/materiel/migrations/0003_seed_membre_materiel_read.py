"""Révision du 2026-08-18 (décision produit) : un Membre voit désormais
l'inventaire, le stock et le journal des mouvements en lecture seule
(materiel.read) — seule la création/modification reste réservée à
materiel.write (Admin/Superadmin). Cf. rh/migrations/0004_seed_conges_notes_frais_permissions.py
pour le même motif de migration RunPython."""
from django.db import migrations


def seed(apps, schema_editor):
    Role = apps.get_model("authentification", "Role")
    Permission = apps.get_model("authentification", "Permission")
    RolePermission = apps.get_model("authentification", "RolePermission")

    role = Role.objects.filter(code="membre").first()
    perm = Permission.objects.filter(code="materiel.read").first()
    if role and perm:
        RolePermission.objects.get_or_create(role=role, permission=perm)


def unseed(apps, schema_editor):
    Role = apps.get_model("authentification", "Role")
    Permission = apps.get_model("authentification", "Permission")
    RolePermission = apps.get_model("authentification", "RolePermission")

    role = Role.objects.filter(code="membre").first()
    perm = Permission.objects.filter(code="materiel.read").first()
    if role and perm:
        RolePermission.objects.filter(role=role, permission=perm).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("materiel", "0002_seed_materiel_permissions"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
