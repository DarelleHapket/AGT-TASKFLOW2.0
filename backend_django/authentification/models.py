"""Modèle RBAC + IBAC — cf. documents/Document_Analyse_Module1_RBAC-IBAC_v1.1.md.

Port de team-tool/backend/accounts/models.py, fusionné avec le catalogue de
permissions et le cycle de vie de compte déjà en place côté AGT TaskFlow
(backend/database.py + backend/utils/rbac.py), pour ne perdre aucune
permission existante et conserver le comportement BF-05 (permissions copiées
à l'attribution du rôle, puis modifiables indépendamment).

Contrairement au Flask actuel, il n'existe ici qu'un seul système de rôles
(pas de colonne legacy à synchroniser en parallèle) — c'est justement ce qui
a causé BUG-02 côté Flask (member_roles et members.role pouvaient diverger).
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class StatutCompte(models.TextChoices):
    EN_ATTENTE = "EN_ATTENTE", "En attente"
    ACTIF = "ACTIF", "Actif"
    SUSPENDU = "SUSPENDU", "Suspendu"
    SUPPRIME = "SUPPRIME", "Supprimé"


class Permission(models.Model):
    """Rangée par module (BF-07). Créées par le code (BF-02), jamais à la main."""
    code = models.CharField(max_length=100, unique=True)     # ex: membres.validate
    module = models.CharField(max_length=50)                 # ex: membres
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["module", "code"]

    def __str__(self):
        return self.code


class Role(models.Model):
    code = models.CharField(max_length=50, unique=True)      # superadmin/admin/chef_projet/membre
    description = models.CharField(max_length=255, blank=True)
    permissions = models.ManyToManyField(
        Permission, blank=True, related_name="roles", through="RolePermission"
    )

    def __str__(self):
        return self.code


class RolePermission(models.Model):
    """Permissions par défaut d'un rôle (role_permissions)."""
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("role", "permission")


class User(AbstractUser):
    """Superadmin = is_superuser OU rôle 'superadmin' (bypass toute vérification).
    doit_changer_mdp force le changement du mot de passe initial (repris de team-tool,
    utile pour le cutover : les comptes migrés depuis SQLite doivent tous changer
    de mot de passe car l'ancien hash SHA-256 non salé n'est pas compatible).
    Par défaut False : un compte auto-enregistré choisit déjà son mot de passe à
    l'inscription, pas besoin de le forcer à en reprendre un autre. Mis à True
    explicitement uniquement là où c'est justifié : bootstrap_superadmin (mot de
    passe par défaut connu) et migrate_from_sqlite (mot de passe temporaire généré)."""
    statut = models.CharField(max_length=20, choices=StatutCompte.choices, default=StatutCompte.EN_ATTENTE)
    doit_changer_mdp = models.BooleanField(default=False)
    # Traçabilité de la suppression (soft delete) — port de backend/routes/members.py
    # (A-08 : deleted_at posé au moment du DELETE, jamais effacé), pour l'historique
    # "Comptes supprimés" de TeamView.
    deleted_at = models.DateTimeField(null=True, blank=True)
    # Couleur d'avatar / légende Gantt-PERT — port de backend/routes/members.py
    # (COLORS, assignée cycliquement au nombre de membres existants à la création).
    color = models.CharField(max_length=7, default="#6366f1")

    def display_name(self):
        """Nom affiché à l'écran (partout : listes de membres, notifications,
        rapports...). `username` reste l'identifiant technique de connexion —
        pour un compte auto-enregistré il inclut un suffixe aléatoire
        (RegisterSerializer.create) et ne doit jamais apparaître à l'écran."""
        return self.first_name or self.username

    def is_superadmin(self):
        return self.is_superuser or self.attributionrole_set.filter(role__code="superadmin").exists()

    def roles_codes(self):
        return list(self.attributionrole_set.values_list("role__code", flat=True))

    def permissions_effectives(self):
        return Permission.objects.filter(
            permissioneffective__user=self, permissioneffective__accordee=True
        ).distinct()

    def peut(self, code):
        """RBAC + IBAC : vrai si la permission est effective, quelle que soit sa source."""
        if self.is_superadmin():
            return True
        return self.permissions_effectives().filter(code=code).exists()


class AttributionRole(models.Model):
    """Relation Utilisateur <-> Role (many-to-many, BF-04 : plusieurs rôles possibles),
    avec traçabilité (BNF-03)."""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    assigne_par = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    assigne_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "role")


class PermissionEffective(models.Model):
    """Relation directe Utilisateur <-> Permission (matérialise l'IBAC).

    Une ligne par (user, permission) — 'source' distingue une permission copiée
    depuis un rôle ('role', BF-05) d'une permission accordée/retirée directement
    ('direct', IBAC). Le retrait direct (accordee=False) prime toujours, même si
    l'utilisateur porte encore un rôle qui l'accorderait par défaut.
    """
    SOURCE_ROLE = "role"
    SOURCE_DIRECT = "direct"
    SOURCE_CHOICES = [(SOURCE_ROLE, "role"), (SOURCE_DIRECT, "direct")]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default=SOURCE_ROLE)
    accordee = models.BooleanField(default=True)
    mis_a_jour_le = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "permission")
