"""Module 4 — Finances. Port du diagramme de classes corrigé, cf.
documents/Document_Analyse_Module3-4_v1.1.md (§11) et
documents/Document_Conception_Module3-4_v1.0.md (§7). `Bilan` n'est pas un
modèle : non persisté, calculé à la volée (services.py::calculer_bilan)."""
from django.conf import settings
from django.db import models


class SensMouvement(models.TextChoices):
    ENTREE = "entree", "Entrée"
    SORTIE = "sortie", "Sortie"


class TypeMouvementFinancier(models.Model):
    nom = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    sens = models.CharField(max_length=10, choices=SensMouvement.choices)

    def __str__(self):
        return self.nom


class NiveauFinancier(models.TextChoices):
    ENTREPRISE = "entreprise", "Entreprise"
    PROJET = "projet", "Projet"
    EMPLOYE = "employe", "Employé"


class MouvementFinancier(models.Model):
    """BNF-10 : non modifiable, non supprimable après création — voir
    MouvementFinancierViewSet (update/destroy -> 405)."""
    type_mouvement = models.ForeignKey(TypeMouvementFinancier, on_delete=models.PROTECT, related_name="mouvements")
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    date_mouvement = models.DateTimeField(auto_now_add=True)
    niveau = models.CharField(max_length=20, choices=NiveauFinancier.choices)
    projet = models.ForeignKey("projets.Projet", null=True, blank=True, on_delete=models.SET_NULL, related_name="mouvements_financiers")
    employe = models.ForeignKey("rh.Employe", null=True, blank=True, on_delete=models.SET_NULL, related_name="mouvements_financiers")
    remuneration = models.ForeignKey("rh.Remuneration", null=True, blank=True, on_delete=models.SET_NULL, related_name="mouvements_generes")

    class Meta:
        ordering = ["-date_mouvement"]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(niveau="entreprise", projet__isnull=True, employe__isnull=True)
                    | models.Q(niveau="projet", projet__isnull=False, employe__isnull=True)
                    | models.Q(niveau="employe", employe__isnull=False)
                ),
                name="mouvement_niveau_coherent",
            )
        ]


class Prevision(models.Model):
    periode_debut = models.DateField()
    periode_fin = models.DateField()
    montant_prevu = models.DecimalField(max_digits=12, decimal_places=2)
    niveau = models.CharField(max_length=20, choices=NiveauFinancier.choices)
    projet = models.ForeignKey("projets.Projet", null=True, blank=True, on_delete=models.SET_NULL, related_name="previsions")
    employe = models.ForeignKey("rh.Employe", null=True, blank=True, on_delete=models.SET_NULL, related_name="previsions")

    class Meta:
        ordering = ["-periode_debut"]


class FormatRapport(models.TextChoices):
    PDF = "pdf", "PDF"
    TXT = "txt", "TXT"


class RapportFinancier(models.Model):
    """Journal de génération (qui/quand/quel format), pas le contenu du
    fichier — le PDF/TXT est produit côté client, comme le module rapports
    existant (BF-29 : « en réutilisant le système déjà présent dans TaskFlow »)."""
    genere_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rapports_financiers")
    format = models.CharField(max_length=5, choices=FormatRapport.choices)
    periode_debut = models.DateField()
    periode_fin = models.DateField()
    genere_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-genere_le"]
