from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from authentification.models import StatutCompte, User
from authentification.services import assign_role
from projets.models import Projet
from rh.models import Contrat, Employe, Periodicite, Profil, Remuneration, TypeContrat

from .models import MouvementFinancier, NiveauFinancier, SensMouvement, TypeMouvementFinancier
from .services import calculer_bilan, comparer_prevision, generer_mouvement_salarial


def make_user(username, role="membre"):
    u = User.objects.create(username=username, statut=StatutCompte.ACTIF, is_active=True)
    assign_role(u, role)
    return u


def make_employe(username):
    u = make_user(username)
    profil = Profil.objects.get(utilisateur=u)
    employe = Employe.objects.create(profil=profil, date_embauche="2026-01-01")
    type_contrat = TypeContrat.objects.create(nom=f"CDI-{username}")
    contrat = Contrat.objects.create(employe=employe, type_contrat=type_contrat, date_debut="2026-01-01")
    return employe, contrat


class MembreNaAccesAuxFinancesTests(TestCase):
    def test_membre_ne_voit_pas_les_mouvements(self):
        membre = make_user("membrefinances")
        client = APIClient()
        client.force_authenticate(membre)
        r = client.get("/api/finances/mouvements")
        self.assertEqual(r.status_code, 403)

    def test_chef_de_projet_ne_voit_pas_les_finances(self):
        """Être promu chef de projet ne donne jamais de droit de regard
        financier, même sur le budget de son propre projet."""
        chef = make_user("chefsansfinances", "chef_projet")
        client = APIClient()
        client.force_authenticate(chef)
        r = client.get("/api/finances/mouvements")
        self.assertEqual(r.status_code, 403)


class MouvementImmuableTests(TestCase):
    """BNF-10 : aucun mouvement d'argent ne peut être supprimé ou modifié
    après son enregistrement."""

    def setUp(self):
        self.admin = make_user("adminfin", "admin")
        self.type_mouvement = TypeMouvementFinancier.objects.create(nom="Vente", sens=SensMouvement.ENTREE)
        self.mouvement = MouvementFinancier.objects.create(
            type_mouvement=self.type_mouvement, montant=Decimal("1000"), niveau=NiveauFinancier.ENTREPRISE
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_modification_refusee(self):
        r = self.client.put(f"/api/finances/mouvements/{self.mouvement.id}", {
            "type_mouvement": self.type_mouvement.id, "montant": "2000", "niveau": "entreprise",
        }, format="json")
        self.assertEqual(r.status_code, 405)
        self.mouvement.refresh_from_db()
        self.assertEqual(self.mouvement.montant, Decimal("1000"))

    def test_suppression_refusee(self):
        r = self.client.delete(f"/api/finances/mouvements/{self.mouvement.id}")
        self.assertEqual(r.status_code, 405)
        self.assertTrue(MouvementFinancier.objects.filter(pk=self.mouvement.id).exists())

    def test_creation_autorisee(self):
        r = self.client.post("/api/finances/mouvements", {
            "type_mouvement": self.type_mouvement.id, "montant": "500", "niveau": "entreprise",
        }, format="json")
        self.assertEqual(r.status_code, 201)


class NiveauCoherenceTests(TestCase):
    """Document d'Analyse §11 : niveau <-> FK renseignée, mutuellement
    exclusif — vérifié côté serializer (validate()) avant même la contrainte
    base de données."""

    def setUp(self):
        self.admin = make_user("adminniveau", "admin")
        self.type_mouvement = TypeMouvementFinancier.objects.create(nom="Achat", sens=SensMouvement.SORTIE)
        self.projet = Projet.objects.create(nom="Projet Finances")
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_niveau_projet_sans_projet_refuse(self):
        r = self.client.post("/api/finances/mouvements", {
            "type_mouvement": self.type_mouvement.id, "montant": "100", "niveau": "projet",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_niveau_entreprise_avec_projet_refuse(self):
        r = self.client.post("/api/finances/mouvements", {
            "type_mouvement": self.type_mouvement.id, "montant": "100", "niveau": "entreprise",
            "projet": self.projet.id,
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_niveau_projet_avec_projet_accepte(self):
        r = self.client.post("/api/finances/mouvements", {
            "type_mouvement": self.type_mouvement.id, "montant": "100", "niveau": "projet",
            "projet": self.projet.id,
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)


class GenerationAutomatiqueSalarialeTests(TestCase):
    """BF-26 / BNF-12 : le lien salaire -> finances est automatique, jamais
    ressaisi côté Finances."""

    def test_generer_mouvement_salarial_cree_une_sortie_niveau_employe(self):
        employe, contrat = make_employe("salarie1")
        remuneration = Remuneration.objects.create(contrat=contrat, montant=Decimal("400000"), periodicite=Periodicite.MENSUELLE)
        mouvement = generer_mouvement_salarial(remuneration)
        self.assertEqual(mouvement.niveau, NiveauFinancier.EMPLOYE)
        self.assertEqual(mouvement.employe, employe)
        self.assertEqual(mouvement.montant, Decimal("400000"))
        self.assertEqual(mouvement.remuneration, remuneration)
        self.assertEqual(mouvement.type_mouvement.sens, SensMouvement.SORTIE)


class BilanTests(TestCase):
    def setUp(self):
        self.entree = TypeMouvementFinancier.objects.create(nom="Vente", sens=SensMouvement.ENTREE)
        self.sortie = TypeMouvementFinancier.objects.create(nom="Achat", sens=SensMouvement.SORTIE)
        MouvementFinancier.objects.create(type_mouvement=self.entree, montant=Decimal("1000"), niveau=NiveauFinancier.ENTREPRISE)
        MouvementFinancier.objects.create(type_mouvement=self.sortie, montant=Decimal("300"), niveau=NiveauFinancier.ENTREPRISE)

    def test_bilan_calcule_le_solde(self):
        from datetime import date, timedelta
        hier = (date.today() - timedelta(days=1)).isoformat()
        demain = (date.today() + timedelta(days=1)).isoformat()
        result = calculer_bilan(hier, demain)
        self.assertEqual(result["entrees"], Decimal("1000"))
        self.assertEqual(result["sorties"], Decimal("300"))
        self.assertEqual(result["solde"], Decimal("700"))

    def test_endpoint_bilan_reserve_a_finances_bilan_voir(self):
        membre = make_user("membrebilan")
        client = APIClient()
        client.force_authenticate(membre)
        r = client.get("/api/finances/bilan?date_from=2026-01-01&date_to=2026-12-31")
        self.assertEqual(r.status_code, 403)
