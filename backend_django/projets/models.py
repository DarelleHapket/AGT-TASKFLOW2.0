"""Domaine métier Projets/Activités/Tâches — port de backend/database.py (AGT
TaskFlow, tables projects/activities/tasks/task_dependencies/project_members).

Amélioration par rapport au Flask : `Tache.responsable` devient une vraie FK
vers l'utilisateur au lieu d'un nom en texte comparé insensible à la casse
(`_name_match` dans utils/permissions.py) — supprime une fragilité déjà
identifiée pendant l'inventaire, sans changer le comportement métier.
"""
from django.conf import settings
from django.db import models


class Projet(models.Model):
    nom = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nom


class MembreProjet(models.Model):
    """Rôle par projet (project_members) — indépendant du rôle global (RBAC+IBAC)."""
    OWNER = "owner"
    MANAGER = "manager"
    CONTRIBUTOR = "contributor"
    ROLE_CHOICES = [(OWNER, "Propriétaire"), (MANAGER, "Manager"), (CONTRIBUTOR, "Contributeur")]

    projet = models.ForeignKey(Projet, on_delete=models.CASCADE, related_name="membres")
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projets_membre")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    rejoint_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("projet", "utilisateur")


class PermissionProjetCode(models.TextChoices):
    TACHES_GERER = "taches.gerer", "Gérer les tâches"
    ACTIVITES_GERER = "activites.gerer", "Gérer les activités"
    EQUIPE_GERER = "equipe.gerer", "Gérer l'équipe"
    PROJET_GERER = "projet.gerer", "Modifier/supprimer le projet"


class PermissionMembreProjet(models.Model):
    """Permission directe accordée/retirée à un membre sur CE projet précis
    (IBAC scopé projet), indépendamment de son rôle (owner/manager/
    contributor) — même pattern que authentification.PermissionEffective au
    niveau global : le rôle porte un paquet de permissions par défaut (non
    stocké, cf. acces.py::ROLE_PERMISSIONS_PAR_DEFAUT), une ligne ici
    accorde/retire une permission précise en plus ou en moins de ce paquet,
    et prime toujours sur ce que le rôle donnerait par défaut."""
    membre_projet = models.ForeignKey(MembreProjet, on_delete=models.CASCADE, related_name="permissions_directes")
    code = models.CharField(max_length=30, choices=PermissionProjetCode.choices)
    accordee = models.BooleanField(default=True)
    mis_a_jour_le = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("membre_projet", "code")


class Activite(models.Model):
    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    projet = models.ForeignKey(Projet, on_delete=models.CASCADE, related_name="activites")
    createur = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        unique_together = ("nom", "projet")

    def __str__(self):
        return self.nom


class Tache(models.Model):
    """id texte libre conservé (PK), comme côté Flask — les identifiants existants
    (générés côté client) doivent rester valides après migration des données."""
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    DONE = "done"
    STATUT_CHOICES = [
        (TODO, "À faire"), (IN_PROGRESS, "En cours"), (BLOCKED, "Bloqué"), (DONE, "Terminé"),
    ]
    # Valeurs alignées sur l'appli Flask d'origine (backend/database.py,
    # priority TEXT DEFAULT 'normale') pour rester fidèle à la logique/UI
    # existante (FilterBar.jsx : Critique/Haute/Normale).
    PRIORITE_CHOICES = [("critique", "Critique"), ("haute", "Haute"), ("normale", "Normale")]

    id = models.CharField(max_length=50, primary_key=True)
    description = models.TextField()
    projet = models.ForeignKey(Projet, null=True, blank=True, on_delete=models.SET_NULL, related_name="taches")
    activite = models.ForeignKey(Activite, null=True, blank=True, on_delete=models.SET_NULL, related_name="taches")
    responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="taches_assignees"
    )
    createur = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="taches_creees"
    )
    duree = models.PositiveIntegerField(default=1)  # coupons (1 coupon = 3h, convention frontend)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default=TODO)
    priorite = models.CharField(max_length=10, choices=PRIORITE_CHOICES, default="normale")
    date_creation = models.DateTimeField(auto_now_add=True)
    date_completion = models.DateTimeField(null=True, blank=True)
    date_debut = models.DateField(null=True, blank=True)
    date_fin = models.DateField(null=True, blank=True)
    date_echeance = models.DateField(null=True, blank=True)
    est_archivee = models.BooleanField(default=False)
    archivee_le = models.DateTimeField(null=True, blank=True)
    dependances = models.ManyToManyField("self", symmetrical=False, blank=True, related_name="dependants")

    def __str__(self):
        return f"[{self.id}] {self.description[:40]}"


class Difficulte(models.Model):
    """Difficulté signalée sur une tâche — port de task_difficulties (Flask)."""
    tache = models.ForeignKey(Tache, on_delete=models.CASCADE, related_name="difficultes")
    membre = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    contenu = models.TextField()
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]
