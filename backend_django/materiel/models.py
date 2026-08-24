"""Module 2 — Gestion du matériel (CDC §4.3, BF-09 à BF-14). Éléments gérés :
type de matériel, matériel, mouvement de matériel (journal).

Convention alignée sur finances/rh : mouvements immuables et datés
automatiquement (BNF-04), matériel lui-même reste éditable (CRUD standard,
seul le journal des mouvements ne l'est pas)."""
from django.conf import settings
from django.db import models


class TypeMateriel(models.Model):
    """BF-09 : type de matériel (ex : ordinateur, licence, serveur), table
    dédiée avec CRUD complet."""
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Materiel(models.Model):
    """BF-10 : nom, description, type, quantité, date d'achat, projet
    associé. `quantite` est le stock total actuellement possédé, tenu à
    jour par les mouvements achat (+) et hors service/consommation (-) —
    cf. services.py."""
    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    type = models.ForeignKey(TypeMateriel, on_delete=models.PROTECT, related_name="materiels")
    quantite = models.PositiveIntegerField(default=0)
    date_achat = models.DateField()
    projet = models.ForeignKey(
        "projets.Projet", null=True, blank=True, on_delete=models.SET_NULL, related_name="materiels",
    )

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class SensMouvementMateriel(models.TextChoices):
    ACHAT = "achat", "Achat"
    AFFECTATION = "affectation", "Affectation"
    RETOUR = "retour", "Retour"
    HORS_SERVICE = "hors_service", "Hors service"
    CONSOMMATION = "consommation", "Consommation"


class MouvementMateriel(models.Model):
    """BF-12/BF-13 : journal daté, jamais modifiable (BNF-04) — une
    correction se fait par un nouveau mouvement inverse, jamais une édition
    (même principe que MouvementFinancier)."""
    materiel = models.ForeignKey(Materiel, on_delete=models.PROTECT, related_name="mouvements")
    type_mouvement = models.CharField(max_length=15, choices=SensMouvementMateriel.choices)
    quantite = models.PositiveIntegerField()
    date_mouvement = models.DateTimeField(auto_now_add=True)
    # Affectation à un projet OU un employé (BF-12) — jamais les deux.
    projet = models.ForeignKey(
        "projets.Projet", null=True, blank=True, on_delete=models.SET_NULL, related_name="mouvements_materiel",
    )
    employe = models.ForeignKey(
        "rh.Employe", null=True, blank=True, on_delete=models.SET_NULL, related_name="mouvements_materiel",
    )
    commentaire = models.CharField(max_length=250, blank=True, default="")
    enregistre_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        ordering = ["-date_mouvement"]


class TypeAlerte(models.TextChoices):
    RUPTURE_STOCK = "rupture_stock", "Rupture de stock"
    ANOMALIE = "anomalie", "Anomalie"
    RAPPEL = "rappel", "Rappel"


class StatutAlerte(models.TextChoices):
    OUVERTE = "ouverte", "Ouverte"
    TRAITEE = "traitee", "Traitée"


class AlerteMateriel(models.Model):
    """BF-08 à BF-11 : alerte automatique (rupture de stock) ou manuelle
    (anomalie/rappel), traitée par un gestionnaire matériel. Notification
    ciblée (Superadmin + détenteurs de materiel.write), pas un broadcast —
    cf. notifier_gestionnaires_materiel dans services.py."""
    materiel = models.ForeignKey(Materiel, on_delete=models.CASCADE, related_name="alertes")
    type_alerte = models.CharField(max_length=20, choices=TypeAlerte.choices)
    message = models.CharField(max_length=250, blank=True, default="")
    statut = models.CharField(max_length=10, choices=StatutAlerte.choices, default=StatutAlerte.OUVERTE)
    cree_le = models.DateTimeField(auto_now_add=True)
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    traitee_le = models.DateTimeField(null=True, blank=True)
    traitee_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        ordering = ["-cree_le"]
