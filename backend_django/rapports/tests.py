from django.test import TestCase
from rest_framework.test import APIClient

from authentification.models import StatutCompte, User
from authentification.services import assign_role
from projets.models import MembreProjet, Projet, Tache


def make_user(username, role="membre"):
    u = User.objects.create(username=username, statut=StatutCompte.ACTIF, is_active=True)
    assign_role(u, role)
    return u


class RapportSuperadminTests(TestCase):
    """Non-régression du bug 'export PDF superadmin' (Flask) : le superadmin
    doit avoir un accès complet aux deux endpoints de rapport, comme l'admin."""

    def setUp(self):
        self.superadmin = make_user("gabriel", "superadmin")
        self.autre = make_user("darelle", "membre")
        self.projet = Projet.objects.create(nom="P")
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.autre, role="owner")
        Tache.objects.create(id="T1", description="d", projet=self.projet, responsable=self.autre)

    def test_superadmin_voit_tous_les_membres_dans_rapport_data(self):
        client = APIClient()
        client.force_authenticate(self.superadmin)
        r = client.get("/api/rapports/data")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["members"]), 2)

    def test_superadmin_accede_au_rapport_par_projet(self):
        client = APIClient()
        client.force_authenticate(self.superadmin)
        r = client.get("/api/rapports/projet", {"project_id": self.projet.pk})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["project"]["name"], "P")

    def test_membre_simple_refuse_sur_rapport_par_projet(self):
        client = APIClient()
        client.force_authenticate(self.autre)
        r = client.get("/api/rapports/projet", {"project_id": self.projet.pk})
        self.assertEqual(r.status_code, 403)
