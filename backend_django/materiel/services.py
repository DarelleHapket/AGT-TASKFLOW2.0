"""Règles métier des mouvements de matériel (BF-12, BNF-04, BNF-05)."""
from django.core.exceptions import ValidationError

from .models import SensMouvementMateriel


def verifier_coherence_projet(materiel, projet):
    """BNF-05 : un matériel ne peut pas être affecté à un projet auquel il
    n'appartient pas — si le matériel est déjà rattaché à un projet, tout
    mouvement avec projet doit cibler ce même projet."""
    if materiel.projet_id and projet and projet.id != materiel.projet_id:
        raise ValidationError(
            f"Ce matériel appartient au projet « {materiel.projet.nom} », "
            "il ne peut pas être affecté à un autre projet."
        )


def appliquer_mouvement(mouvement):
    """Met à jour le stock total du matériel (achat = entrée, rebut =
    sortie définitive). Affectation/retour ne changent pas le total possédé,
    seulement où il se trouve (tracé dans le journal, pas dans un solde
    séparé — cohérent avec la portée BF-11/BF-13 de ce module)."""
    materiel = mouvement.materiel
    if mouvement.type_mouvement == SensMouvementMateriel.ACHAT:
        materiel.quantite += mouvement.quantite
        materiel.save(update_fields=["quantite"])
    elif mouvement.type_mouvement == SensMouvementMateriel.REBUT:
        if mouvement.quantite > materiel.quantite:
            raise ValidationError("Quantité mise au rebut supérieure au stock disponible.")
        materiel.quantite -= mouvement.quantite
        materiel.save(update_fields=["quantite"])


def calculer_stock(queryset):
    """BF-11 : quantités par type et par projet, à la volée (pas de solde
    persisté séparément — même principe que calculer_bilan côté finances)."""
    par_type = {}
    par_projet = {}
    for m in queryset.select_related("type", "projet"):
        par_type[m.type.nom] = par_type.get(m.type.nom, 0) + m.quantite
        cle_projet = m.projet.nom if m.projet else "Sans projet"
        par_projet[cle_projet] = par_projet.get(cle_projet, 0) + m.quantite
    return {
        "total": sum(par_type.values()),
        "par_type": [{"type": k, "quantite": v} for k, v in par_type.items()],
        "par_projet": [{"projet": k, "quantite": v} for k, v in par_projet.items()],
    }
