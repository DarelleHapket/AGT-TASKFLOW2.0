"""Flux transverses du Module 3 — cf. Document_Conception_Module3-4_v1.0.md §3."""
import secrets

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from authentification.models import StatutCompte, User

from .models import Contrat, Employe, FichePaie, Periodicite, Profil, Remuneration, StatutCandidature, TypeContrat


@transaction.atomic
def embaucher(candidat):
    """BF-49 / BNF-17 : une candidature retenue crée compte, profil, employé
    et premier contrat en une seule transaction — jamais de compte créé en
    parallèle d'une candidature retenue, la création découle directement du
    candidat. Réutilise le mécanisme mot-de-passe-temporaire déjà en place
    pour bootstrap_superadmin / migrate_from_sqlite (Module 1)."""
    if candidat.statut != StatutCandidature.RETENUE:
        raise ValueError("Le candidat n'est pas au statut 'retenue'.")

    email_prefix = candidat.contact.split("@")[0] if "@" in candidat.contact else candidat.nom.lower().replace(" ", "")
    username = f"{email_prefix}-{secrets.token_hex(2)}"
    temp_password = secrets.token_urlsafe(9)
    user = User(
        username=username,
        email=candidat.contact if "@" in candidat.contact else "",
        first_name=candidat.nom,
        password=make_password(temp_password),
        is_active=True,
        statut=StatutCompte.ACTIF,
        doit_changer_mdp=True,
    )
    user.save()  # déclenche le signal post_save -> création du Profil (BF-15)

    profil = Profil.objects.get(utilisateur=user)
    profil.poste = candidat.offre.poste
    profil.save(update_fields=["poste"])

    employe = Employe.objects.create(profil=profil, date_embauche=timezone.now().date())

    type_defaut, _ = TypeContrat.objects.get_or_create(
        nom="CDI", defaults={"description": "Contrat à durée indéterminée"}
    )
    contrat = Contrat.objects.create(employe=employe, type_contrat=type_defaut, date_debut=timezone.now().date())
    Remuneration.objects.create(contrat=contrat, montant=0, periodicite=Periodicite.MENSUELLE)
    # Pas de sortie salariale immédiate ici : BF-26/BF-54 (révisé) — la sortie
    # salariale et la fiche de paie ne sont générées que par le cron mensuel
    # (generer_paie_mensuelle), jamais à la création d'une Remuneration.

    return employe, temp_password


def terminer_inscription(inscription):
    """BF-52 : formation terminée -> compétences visées ajoutées au profil,
    automatiquement, jamais en saisie manuelle séparée."""
    from .models import StatutInscriptionFormation
    inscription.statut = StatutInscriptionFormation.TERMINEE
    inscription.save(update_fields=["statut"])
    inscription.employe.profil.competences.add(*inscription.formation.competences_visees.all())


def generer_paie_mensuelle(reference_date=None):
    """BF-26/BF-54 : cron mensuel — pour chaque contrat actif, génère la
    sortie salariale (MouvementFinancier) et la fiche de paie liée, sauf si
    déjà fait ce mois-ci pour CE CONTRAT (contrainte unique
    FichePaie.contrat+periode — volontairement pas sur `remuneration` : une
    augmentation en cours de mois ne doit pas déclencher une deuxième fiche
    pour le même mois). Remplace l'ancien déclenchement à la création de
    Remuneration."""
    from finances.services import generer_mouvement_salarial

    today = reference_date or timezone.now().date()
    periode = today.replace(day=1)
    contrats_actifs = Contrat.objects.filter(Q(date_fin__isnull=True) | Q(date_fin__gte=today))
    fiches = []
    for contrat in contrats_actifs:
        if FichePaie.objects.filter(contrat=contrat, periode=periode).exists():
            continue
        remuneration = contrat.remunerations.order_by("-cree_le").first()
        if not remuneration:
            continue
        with transaction.atomic():
            mouvement = generer_mouvement_salarial(remuneration)
            fiche = FichePaie.objects.create(
                contrat=contrat, remuneration=remuneration, mouvement_financier=mouvement,
                periode=periode, montant=remuneration.montant,
            )
        fiches.append(fiche)
    return fiches
