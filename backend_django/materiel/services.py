"""Règles métier des mouvements de matériel (BF-12, BNF-02, BNF-04, BNF-05)
et des alertes (BF-08 à BF-11)."""
from django.core.exceptions import ValidationError
from django.db.models import Q

from .models import AlerteMateriel, SensMouvementMateriel, StatutAlerte, TypeAlerte

SORTIES_DEFINITIVES = (SensMouvementMateriel.HORS_SERVICE, SensMouvementMateriel.CONSOMMATION)


def verifier_coherence_projet(materiel, projet):
    """BNF-05 : un matériel ne peut pas être affecté à un projet auquel il
    n'appartient pas — si le matériel est déjà rattaché à un projet, tout
    mouvement avec projet doit cibler ce même projet."""
    if materiel.projet_id and projet and projet.id != materiel.projet_id:
        raise ValidationError(
            f"Ce matériel appartient au projet « {materiel.projet.nom} », "
            "il ne peut pas être affecté à un autre projet."
        )


def verifier_disponibilite_affectation(materiel, projet, employe):
    """BNF-02 : un matériel déjà affecté (à un projet ou un employé) ne peut
    pas être réaffecté ailleurs tant qu'un mouvement "retour" n'a pas été
    enregistré — la cohérence statique (verifier_coherence_projet) ne suffit
    pas, il faut l'état dynamique déduit du dernier mouvement affectation/
    retour du journal."""
    dernier = (
        materiel.mouvements
        .filter(type_mouvement__in=[SensMouvementMateriel.AFFECTATION, SensMouvementMateriel.RETOUR])
        .order_by("-date_mouvement", "-id")
        .first()
    )
    if not dernier or dernier.type_mouvement != SensMouvementMateriel.AFFECTATION:
        return
    meme_cible = (
        (projet and dernier.projet_id == projet.id)
        or (employe and dernier.employe_id == employe.id)
    )
    if meme_cible:
        return
    cible_actuelle = dernier.projet.nom if dernier.projet_id else (
        dernier.employe.profil.utilisateur.display_name() if dernier.employe_id else "une cible inconnue"
    )
    raise ValidationError(
        f"Ce matériel est déjà affecté à « {cible_actuelle} », un retour doit être "
        "enregistré avant toute nouvelle affectation."
    )


def appliquer_mouvement(mouvement):
    """Met à jour le stock total du matériel (achat = entrée, hors service/
    consommation = sortie définitive). Affectation/retour ne changent pas le
    total possédé, seulement où il se trouve (tracé dans le journal, pas dans
    un solde séparé — cohérent avec la portée BF-11/BF-13 de ce module)."""
    materiel = mouvement.materiel
    if mouvement.type_mouvement == SensMouvementMateriel.ACHAT:
        materiel.quantite += mouvement.quantite
        materiel.save(update_fields=["quantite"])
    elif mouvement.type_mouvement in SORTIES_DEFINITIVES:
        if mouvement.quantite > materiel.quantite:
            raise ValidationError("Quantité supérieure au stock disponible.")
        materiel.quantite -= mouvement.quantite
        materiel.save(update_fields=["quantite"])


def verifier_alerte_rupture(materiel):
    """BF-08 : rupture de stock (quantite tombe à 0) déclenche une alerte
    automatique — anti-doublon (BF-09) : pas de nouvelle alerte si une
    RUPTURE_STOCK est déjà ouverte pour ce matériel. Retourne l'alerte
    nouvellement créée (à notifier), ou None si rien n'a changé."""
    if materiel.quantite != 0:
        return None
    alerte, cree = AlerteMateriel.objects.get_or_create(
        materiel=materiel, type_alerte=TypeAlerte.RUPTURE_STOCK, statut=StatutAlerte.OUVERTE,
        defaults={"message": f"Rupture de stock : {materiel.nom}"},
    )
    return alerte if cree else None


def notifier_gestionnaires_materiel(alerte, expediteur=None):
    """BF-11 : notification ciblée Superadmin + détenteurs de materiel.write
    (pas un broadcast à tous les actifs, contrairement à la notification de
    mouvement existante)."""
    from authentification.models import User
    from notifications.services import notify

    destinataires = User.objects.filter(
        Q(is_superuser=True)
        | Q(attributionrole__role__code="superadmin")
        | Q(permissioneffective__permission__code="materiel.write", permissioneffective__accordee=True)
    ).distinct()
    label = dict(TypeAlerte.choices).get(alerte.type_alerte, alerte.type_alerte)
    for user in destinataires:
        notify(
            user, "alerte_materiel",
            f"{label} : {alerte.materiel.nom}",
            alerte.message,
            expediteur=expediteur,
        )


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
