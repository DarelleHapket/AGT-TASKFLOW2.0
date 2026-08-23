"""Réduction du catalogue RBAC à 2 rôles (superadmin + user), décidée le
2026-08-19 : les rôles ne sont que des attributs BD modifiables, l'app doit
être guidée par les permissions et non par des noms de rôle codés en dur
(cf. audit projets/acces.py, operations/views.py, rapports/views.py — tous
corrigés dans ce même changement). "admin" et "chef_projet" disparaissent
comme rôles nommés ; "membre" devient "user" (rôle de base générique)."""
from django.db import migrations


def migrer(apps, schema_editor):
    Role = apps.get_model("authentification", "Role")
    AttributionRole = apps.get_model("authentification", "AttributionRole")
    PermissionEffective = apps.get_model("authentification", "PermissionEffective")

    # 1. Convertir en octroi direct (IBAC) les permissions actuellement
    #    tenues via les rôles admin/chef_projet, AVANT de les supprimer —
    #    aucun utilisateur existant ne perd d'accès le jour de la bascule.
    for role_code in ("admin", "chef_projet"):
        role = Role.objects.filter(code=role_code).first()
        if not role:
            continue
        for attribution in AttributionRole.objects.filter(role=role):
            for perm in role.permissions.all():
                PermissionEffective.objects.update_or_create(
                    user=attribution.user, permission=perm,
                    defaults={"accordee": True, "source": "direct"},
                )

    # 2. Renommer "membre" -> "user" (rôle de base par défaut).
    Role.objects.filter(code="membre").update(code="user", description="Utilisateur standard")

    # 3. Supprimer les rôles admin/chef_projet (cascade : AttributionRole et
    #    RolePermission associés disparaissent ; les PermissionEffective
    #    converties à l'étape 1 restent, elles ne référencent pas le rôle).
    Role.objects.filter(code__in=["admin", "chef_projet"]).delete()


def annuler(apps, schema_editor):
    Role = apps.get_model("authentification", "Role")
    Role.objects.filter(code="user").update(code="membre", description="Execution de ses taches")
    # admin/chef_projet non restaurés automatiquement (destructif par
    # nature) — à re-seeder manuellement si un rollback complet est requis.


class Migration(migrations.Migration):

    dependencies = [
        ("authentification", "0005_user_deleted_at"),
        # Doit s'appliquer APRÈS ce seed (qui cherche le rôle par son ancien
        # code "membre") — sinon, sur une base fraîche (ex: DB de test),
        # l'ordre entre apps sans dépendance explicite n'est pas garanti et
        # le seed peut s'exécuter après le renommage "membre" -> "user",
        # le rendant silencieusement no-op (role introuvable).
        ("materiel", "0003_seed_membre_materiel_read"),
        ("pilotage_stage", "0002_seed_permissions"),
    ]

    operations = [
        migrations.RunPython(migrer, annuler),
    ]
