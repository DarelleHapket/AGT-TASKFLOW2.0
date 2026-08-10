"""Module 3 — Profils & Ressources Humaines. Port du diagramme de classes
corrigé, cf. documents/Document_Analyse_Module3-4_v1.1.md (§6) et
documents/Document_Conception_Module3-4_v1.0.md (§2)."""
from django.conf import settings
from django.db import models


class Competence(models.Model):
    nom = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Poste(models.Model):
    nom = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Responsabilite(models.Model):
    """BF-17 : un poste est lié à des responsabilités, une responsabilité
    demande certaines compétences."""
    poste = models.ForeignKey(Poste, on_delete=models.CASCADE, related_name="responsabilites")
    nom = models.CharField(max_length=150)
    competences_requises = models.ManyToManyField(Competence, blank=True, related_name="responsabilites")

    def __str__(self):
        return self.nom


class Equipe(models.Model):
    """BF-18 — structurelle et transversale, indépendante de
    projets.MembreProjet (qui reste scopée à un seul projet)."""
    nom = models.CharField(max_length=100)
    membres = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="equipes")

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Profil(models.Model):
    """BF-15 : chaque membre a un profil. Créé automatiquement à l'activation
    d'un compte (signal rh/signals.py), jamais à la main."""
    utilisateur = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profil")
    poste = models.ForeignKey(Poste, null=True, blank=True, on_delete=models.SET_NULL, related_name="profils")
    competences = models.ManyToManyField(Competence, blank=True, related_name="profils")

    def __str__(self):
        return f"Profil de {self.utilisateur}"


class Employe(models.Model):
    """BF-19 : rattaché à un profil qui existe déjà — association (pas
    d'héritage), Document d'Analyse §6.1. Tout Profil n'a pas forcément
    d'Employe (candidat pas encore embauché, compte en attente)."""
    profil = models.OneToOneField(Profil, on_delete=models.CASCADE, related_name="employe")
    date_embauche = models.DateField()

    def __str__(self):
        return f"Employé {self.profil.utilisateur}"


class TypeContrat(models.Model):
    nom = models.CharField(max_length=50, unique=True)
    description = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.nom


class Contrat(models.Model):
    employe = models.ForeignKey(Employe, on_delete=models.CASCADE, related_name="contrats")
    type_contrat = models.ForeignKey(TypeContrat, on_delete=models.PROTECT, related_name="contrats")
    date_debut = models.DateField()
    date_fin = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-date_debut"]


class Periodicite(models.TextChoices):
    MENSUELLE = "mensuelle", "Mensuelle"
    HEBDOMADAIRE = "hebdomadaire", "Hebdomadaire"
    JOURNALIERE = "journaliere", "Journalière"


class Remuneration(models.Model):
    """BF-21 / BNF-07 : historique protégé — jamais modifiée ni supprimée
    après création (RemunerationViewSet.update/destroy -> 405). Un nouveau
    contrat crée une nouvelle rémunération, l'ancienne n'est jamais effacée."""
    contrat = models.ForeignKey(Contrat, on_delete=models.CASCADE, related_name="remunerations")
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    periodicite = models.CharField(max_length=20, choices=Periodicite.choices)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]


class StatutDisponibilite(models.TextChoices):
    DISPONIBLE = "disponible", "Disponible"
    INDISPONIBLE = "indisponible", "Indisponible"


class Disponibilite(models.Model):
    employe = models.ForeignKey(Employe, on_delete=models.CASCADE, related_name="disponibilites")
    statut = models.CharField(max_length=20, choices=StatutDisponibilite.choices)
    periode_debut = models.DateField()
    periode_fin = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-periode_debut"]


class OffreEmploi(models.Model):
    poste = models.ForeignKey(Poste, on_delete=models.CASCADE, related_name="offres")
    description = models.TextField(blank=True)
    statut = models.CharField(max_length=20, default="ouverte")

    class Meta:
        ordering = ["-id"]


class StatutCandidature(models.TextChoices):
    RECUE = "recue", "Reçue"
    ENTRETIEN = "entretien", "Entretien"
    RETENUE = "retenue", "Retenue"
    REFUSEE = "refusee", "Refusée"


class Candidat(models.Model):
    offre = models.ForeignKey(OffreEmploi, on_delete=models.CASCADE, related_name="candidats")
    nom = models.CharField(max_length=150)
    contact = models.CharField(max_length=150)
    cv = models.FileField(upload_to="candidatures/", blank=True, null=True)
    statut = models.CharField(max_length=20, choices=StatutCandidature.choices, default=StatutCandidature.RECUE)

    class Meta:
        ordering = ["-id"]


class Formation(models.Model):
    nom = models.CharField(max_length=150)
    description = models.CharField(max_length=255, blank=True)
    competences_visees = models.ManyToManyField(Competence, blank=True, related_name="formations")

    def __str__(self):
        return self.nom


class StatutInscriptionFormation(models.TextChoices):
    PREVUE = "prevue", "Prévue"
    EN_COURS = "en_cours", "En cours"
    TERMINEE = "terminee", "Terminée"


class InscriptionFormation(models.Model):
    """BF-52 : une formation terminée ajoute automatiquement les compétences
    visées au profil (rh/services.py::terminer_inscription)."""
    employe = models.ForeignKey(Employe, on_delete=models.CASCADE, related_name="inscriptions_formation")
    formation = models.ForeignKey(Formation, on_delete=models.CASCADE, related_name="inscriptions")
    statut = models.CharField(max_length=20, choices=StatutInscriptionFormation.choices,
                               default=StatutInscriptionFormation.PREVUE)

    class Meta:
        unique_together = ("employe", "formation")


class StatutSignalement(models.TextChoices):
    OUVERT = "ouvert", "Ouvert"
    TRAITE = "traite", "Traité"


class Signalement(models.Model):
    """BNF-18 : visible uniquement par Admin et Superadmin — appliqué au
    niveau du queryset (SignalementViewSet.get_queryset), pas d'un champ
    visibilite en base."""
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="signalements")
    description = models.TextField()
    statut = models.CharField(max_length=20, choices=StatutSignalement.choices, default=StatutSignalement.OUVERT)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]
