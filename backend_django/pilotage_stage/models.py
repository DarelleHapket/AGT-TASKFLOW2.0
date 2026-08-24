"""Pilotage du stage — port tel quel de team-tool/backend/{tree,pert} (D-08 à
D-16 dans team-tool). Décision actée avec l'utilisateur : ce périmètre est
distinct du métier ERP (cf. Document de Conception) et vit dans son propre
namespace /api/pilotage/... — c'est l'outil que l'équipe utilise pour piloter
son propre travail de stage (branches = étapes de dev, pas des projets AG
Technologies), pas un doublon de l'app `projets`.

Utilise le même User (authentification.User) que le reste de l'ERP : un seul
système RBAC+IBAC pour toute la plateforme, mais avec ses propres permissions
('pilotage.taches.*', 'pilotage.pert.*') — la fusion réelle porte sur les
comptes, pas sur la gestion des droits spécifique à cet outil.
"""
from django.conf import settings
from django.db import models

KINDS = ["start", "work", "valid", "auto", "final"]
STATUTS = ["a_faire", "en_cours", "en_validation", "bloque", "fait"]
BLOCS = ["prep", "critique", "rituel"]
NOEUD_VERS_STATUT = {"start": "a_faire", "work": "en_cours", "auto": "en_cours",
                      "valid": "en_validation", "final": "fait"}


class PertStatut(models.Model):
    cle = models.SlugField(max_length=30, unique=True)
    label = models.CharField(max_length=60)
    couleur = models.CharField(max_length=20, default="#6b7280")
    ordre = models.IntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]

    def __str__(self):
        return self.label


class PertTask(models.Model):
    """Plan macro multi-personnes — tableau de statuts éditable, PAS un calcul
    CPM (le vrai moteur PERT/CPM du métier ERP vit dans projets/pert.py)."""
    num = models.IntegerField(unique=True)
    name = models.CharField(max_length=250)
    preds = models.JSONField(default=list, blank=True)
    dur = models.IntegerField(default=1)
    statut = models.ForeignKey(PertStatut, on_delete=models.PROTECT, related_name="taches_pert")

    class Meta:
        ordering = ["num"]


class Branch(models.Model):
    slug = models.CharField(max_length=10, primary_key=True)
    nom = models.CharField(max_length=80)

    def __str__(self):
        return self.nom


class Node(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="nodes")
    num = models.IntegerField()
    kind = models.CharField(max_length=10, choices=[(k, k) for k in KINDS])
    titre = models.CharField(max_length=120)
    x = models.IntegerField(default=0)
    y = models.IntegerField(default=0)
    blocking = models.BooleanField(default=False)
    detail = models.TextField(blank=True, default="")

    class Meta:
        unique_together = ("branch", "num")
        ordering = ["branch", "num"]


class Edge(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="edges")
    from_num = models.IntegerField()
    to_num = models.IntegerField()
    label = models.CharField(max_length=80, blank=True, default="")


class Tache(models.Model):
    """1 responsable + 1 branche. Statut DÉRIVÉ : jamais saisi, calculé depuis
    les sous-tâches (Bloqué prime) ou le nœud courant."""
    titre = models.CharField(max_length=250)
    description = models.TextField(blank=True, default="")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="taches")
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="taches_pilotage_assignees")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="taches_pilotage_creees")
    validateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                    related_name="taches_pilotage_a_valider", null=True, blank=True)
    pert_task = models.ForeignKey(PertTask, on_delete=models.SET_NULL, null=True, blank=True, related_name="taches")
    current_node = models.ForeignKey(Node, on_delete=models.PROTECT, related_name="+")
    jour = models.CharField(max_length=40, blank=True, default="")
    bloc = models.CharField(max_length=12, choices=[(b, b) for b in BLOCS], blank=True, default="")
    benef = models.CharField(max_length=60, blank=True, default="")
    note = models.TextField(blank=True, default="")
    ordre = models.IntegerField(default=0)
    clos = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["jour", "ordre", "-created_at"]

    @property
    def statut(self):
        sous = list(self.sous_taches.all())
        if sous:
            etats = {s.statut for s in sous}
            if etats == {"fait"}:
                return "fait"
            if "bloque" in etats:
                return "bloque"
            if etats == {"a_faire"}:
                return "a_faire"
            return "en_cours"
        if self.clos:
            return "fait"
        return NOEUD_VERS_STATUT.get(self.current_node.kind, "en_cours")


class SousTache(models.Model):
    tache = models.ForeignKey(Tache, on_delete=models.CASCADE, related_name="sous_taches")
    titre = models.CharField(max_length=250)
    statut = models.CharField(max_length=15, choices=[(s, s) for s in ["a_faire", "en_cours", "bloque", "fait"]], default="a_faire")
    ordre = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["ordre", "id"]


class Transition(models.Model):
    tache = models.ForeignKey(Tache, on_delete=models.CASCADE, related_name="transitions")
    from_node = models.ForeignKey(Node, on_delete=models.PROTECT, related_name="+")
    to_node = models.ForeignKey(Node, on_delete=models.PROTECT, related_name="+")
    par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    commentaire = models.CharField(max_length=250, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class Sollicitation(models.Model):
    tache = models.ForeignKey(Tache, on_delete=models.CASCADE, related_name="sollicitations")
    de = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    vers = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    message = models.CharField(max_length=250)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
