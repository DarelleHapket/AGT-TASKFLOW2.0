"""Flux transverses du Module 4 — cf. Document_Conception_Module3-4_v1.0.md §8, §10."""
from django.db.models import Sum

from .models import MouvementFinancier, NiveauFinancier, SensMouvement, TypeMouvementFinancier


def generer_mouvement_salarial(remuneration):
    """BF-26 : les salaires sont automatiquement enregistrés comme sorties
    d'argent — appelé depuis rh/services.py::embaucher() et depuis tout
    renouvellement de contrat, jamais depuis une action Admin directe côté
    finances (cf. Document d'Analyse §5.2, cas d'utilisation système)."""
    type_sortie, _ = TypeMouvementFinancier.objects.get_or_create(
        nom="Salaire", defaults={"sens": SensMouvement.SORTIE}
    )
    return MouvementFinancier.objects.create(
        type_mouvement=type_sortie, montant=remuneration.montant,
        niveau=NiveauFinancier.EMPLOYE, employe=remuneration.contrat.employe,
        remuneration=remuneration,
    )


def calculer_bilan(date_from, date_to, niveau=None, projet_id=None, employe_id=None):
    """BF-27 : le bilan est un calcul à la volée, jamais stocké comme entité
    propre (Document d'Analyse §11)."""
    qs = MouvementFinancier.objects.filter(date_mouvement__date__range=(date_from, date_to))
    if niveau:
        qs = qs.filter(niveau=niveau)
    if projet_id:
        qs = qs.filter(projet_id=projet_id)
    if employe_id:
        qs = qs.filter(employe_id=employe_id)
    entrees = qs.filter(type_mouvement__sens=SensMouvement.ENTREE).aggregate(s=Sum("montant"))["s"] or 0
    sorties = qs.filter(type_mouvement__sens=SensMouvement.SORTIE).aggregate(s=Sum("montant"))["s"] or 0
    return {"entrees": entrees, "sorties": sorties, "solde": entrees - sorties}


def comparer_prevision(prevision):
    """BF-28 : compare le montant prévu à la somme des mouvements réellement
    enregistrés sur la même période et le même niveau (indépendamment du
    sens : une prévision peut porter sur une recette ou une dépense)."""
    qs = MouvementFinancier.objects.filter(
        date_mouvement__date__range=(prevision.periode_debut, prevision.periode_fin),
        niveau=prevision.niveau,
    )
    if prevision.projet_id:
        qs = qs.filter(projet_id=prevision.projet_id)
    if prevision.employe_id:
        qs = qs.filter(employe_id=prevision.employe_id)
    reel = qs.aggregate(s=Sum("montant"))["s"] or 0
    return {"prevu": prevision.montant_prevu, "reel": reel, "ecart": reel - prevision.montant_prevu}
