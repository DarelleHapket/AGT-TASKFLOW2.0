"""Besoins, Notes, Ordre journalier — regroupés sous le même app que la
permission AGT existante 'operations.manage' ("Gerer activites, besoins,
performances"). Port de backend/routes/needs.py, notes.py, daily_order.py."""
from django.conf import settings
from django.db import models

NEED_TYPES = ["Matériel", "Logiciel", "Humain", "Autre"]
NEED_STATUSES = ["initié", "demandé", "couvert"]


class Besoin(models.Model):
    titre = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=20, default="Autre")
    statut = models.CharField(max_length=20, default="initié")
    projet = models.ForeignKey("projets.Projet", null=True, blank=True, on_delete=models.SET_NULL, related_name="besoins")
    activite = models.ForeignKey("projets.Activite", null=True, blank=True, on_delete=models.SET_NULL, related_name="besoins")
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]


class Note(models.Model):
    titre = models.CharField(max_length=200)
    contenu = models.TextField(blank=True)
    projet = models.ForeignKey("projets.Projet", null=True, blank=True, on_delete=models.SET_NULL, related_name="notes")
    activite = models.ForeignKey("projets.Activite", null=True, blank=True, on_delete=models.SET_NULL, related_name="notes")
    tache = models.ForeignKey("projets.Tache", null=True, blank=True, on_delete=models.SET_NULL, related_name="notes")
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    cree_le = models.DateTimeField(auto_now_add=True)
    mis_a_jour_le = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-mis_a_jour_le"]


class OrdreJournalier(models.Model):
    """'Ma journée' — ordonnancement personnel des tâches, port de daily_task_order."""
    membre = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ordres_journaliers")
    tache = models.ForeignKey("projets.Tache", on_delete=models.CASCADE, related_name="ordres_journaliers")
    date = models.DateField()
    ordre = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=255, blank=True)
    heure_debut = models.CharField(max_length=10, null=True, blank=True)
    duree_min = models.PositiveIntegerField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("membre", "tache", "date")
        ordering = ["ordre"]
