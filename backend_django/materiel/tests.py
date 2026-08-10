from django.test import TestCase
from rest_framework.test import APIClient

from authentification.models import StatutCompte, User
from authentification.services import assign_role
from projets.models import Projet

from .models import Materiel, MouvementMateriel, TypeMateriel
from .services import calculer_stock


def make_user(username, role="membre"):
    u = User.objects.create(username=username, statut=StatutCompte.ACTIF, is_active=True)
    assign_role(u, role)
    return u


class PermissionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = make_user("adminmat", "admin")
        self.membre = make_user("membremat", "membre")

    def test_membre_na_pas_acces_au_materiel(self):
        """Module 2 classé « Ressources de l'entreprise », piloté par Admin
        — même périmètre que RH/Finances (BF-02 : materiel.read/write)."""
        self.client.force_authenticate(self.membre)
        r = self.client.get("/api/materiel/inventaire")
        self.assertEqual(r.status_code, 403)
        r = self.client.post("/api/materiel/types", {"nom": "Ordinateur"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_admin_peut_gerer_le_materiel(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/materiel/types", {"nom": "Ordinateur"}, format="json")
        self.assertEqual(r.status_code, 201)


class StockMouvementTests(TestCase):
    """BF-12 : achat/rebut mettent à jour le stock (BF-11) ; affectation/
    retour tracent seulement l'emplacement, sans changer le total possédé."""

    def setUp(self):
        self.client = APIClient()
        self.admin = make_user("adminstock", "admin")
        self.client.force_authenticate(self.admin)
        self.type = TypeMateriel.objects.create(nom="Ordinateur")
        self.materiel = Materiel.objects.create(nom="Laptop Dell", type=self.type, date_achat="2026-01-01", quantite=0)

    def test_achat_augmente_le_stock(self):
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "achat", "quantite": 10,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.quantite, 10)

    def test_rebut_diminue_le_stock(self):
        self.materiel.quantite = 5
        self.materiel.save()
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "rebut", "quantite": 2,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.quantite, 3)

    def test_rebut_superieur_au_stock_refuse(self):
        self.materiel.quantite = 1
        self.materiel.save()
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "rebut", "quantite": 5,
        }, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(MouvementMateriel.objects.exists())  # rollback, pas de mouvement orphelin

    def test_affectation_et_retour_ne_changent_pas_le_stock_total(self):
        self.materiel.quantite = 10
        self.materiel.save()
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "affectation", "quantite": 3,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.quantite, 10)

    def test_mouvement_non_modifiable_ni_supprimable(self):
        mouvement = MouvementMateriel.objects.create(materiel=self.materiel, type_mouvement="achat", quantite=1)
        r = self.client.patch(f"/api/materiel/mouvements/{mouvement.id}", {"quantite": 99}, format="json")
        self.assertEqual(r.status_code, 405)
        r = self.client.delete(f"/api/materiel/mouvements/{mouvement.id}")
        self.assertEqual(r.status_code, 405)


class CoherenceProjetTests(TestCase):
    """BNF-05 : un matériel rattaché à un projet ne peut pas être affecté
    à un autre projet."""

    def setUp(self):
        self.client = APIClient()
        self.admin = make_user("adminproj", "admin")
        self.client.force_authenticate(self.admin)
        self.type = TypeMateriel.objects.create(nom="Serveur")
        self.projet_a = Projet.objects.create(nom="Projet A")
        self.projet_b = Projet.objects.create(nom="Projet B")
        self.materiel = Materiel.objects.create(
            nom="Serveur X", type=self.type, date_achat="2026-01-01", quantite=5, projet=self.projet_a,
        )

    def test_affectation_a_un_autre_projet_refusee(self):
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "affectation", "quantite": 1, "projet": self.projet_b.id,
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_affectation_au_meme_projet_acceptee(self):
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "affectation", "quantite": 1, "projet": self.projet_a.id,
        }, format="json")
        self.assertEqual(r.status_code, 201)


class StockAgregeTests(TestCase):
    def test_calculer_stock_agrege_par_type_et_projet(self):
        t1 = TypeMateriel.objects.create(nom="Licence")
        projet = Projet.objects.create(nom="Projet Stock")
        Materiel.objects.create(nom="Licence A", type=t1, date_achat="2026-01-01", quantite=4, projet=projet)
        Materiel.objects.create(nom="Licence B", type=t1, date_achat="2026-01-01", quantite=6)
        stats = calculer_stock(Materiel.objects.all())
        self.assertEqual(stats["total"], 10)
        self.assertEqual({d["type"]: d["quantite"] for d in stats["par_type"]}, {"Licence": 10})
