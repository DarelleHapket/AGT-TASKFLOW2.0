from django.test import TestCase
from rest_framework.test import APIClient

from authentification.models import StatutCompte, User
from authentification.services import assign_role, grant_permission

from .models import Branch, Edge, Node, PertStatut, PertTask, SousTache, Tache


def make_user(username, role="membre"):
    u = User.objects.create(username=username, statut=StatutCompte.ACTIF, is_active=True)
    assign_role(u, role)
    return u


def make_tronc():
    """Gabarit de test à 3 nœuds (start -> work -> valid bloquant), sur un
    slug distinct de 'tronc' pour ne pas entrer en conflit avec le gabarit
    réel seedé par la migration 0003_seed_tronc (7 nœuds, production)."""
    b = Branch.objects.create(slug="test-tronc", nom="Tronc de test")
    n1 = Node.objects.create(branch=b, num=1, kind="start", titre="À faire")
    n2 = Node.objects.create(branch=b, num=2, kind="work", titre="En cours")
    n3 = Node.objects.create(branch=b, num=3, kind="valid", titre="En validation", blocking=True)
    Edge.objects.create(branch=b, from_num=1, to_num=2)
    Edge.objects.create(branch=b, from_num=2, to_num=3)
    return b, n1, n2, n3


class StatutDeriveTests(TestCase):
    def test_statut_derive_du_noeud(self):
        branch, start, work, valid = make_tronc()
        gabriel = make_user("gabriel", "superadmin")
        t = Tache.objects.create(titre="T", branch=branch, assignee=gabriel, created_by=gabriel, current_node=work)
        self.assertEqual(t.statut, "en_cours")

    def test_statut_agrege_sous_taches_bloque_prime(self):
        branch, start, work, valid = make_tronc()
        gabriel = make_user("gabriel", "superadmin")
        t = Tache.objects.create(titre="T", branch=branch, assignee=gabriel, created_by=gabriel, current_node=start)
        SousTache.objects.create(tache=t, titre="s1", statut="fait")
        SousTache.objects.create(tache=t, titre="s2", statut="bloque")
        self.assertEqual(t.statut, "bloque")


class TacheVisibilityTests(TestCase):
    def setUp(self):
        self.branch, self.start, self.work, self.valid = make_tronc()
        self.lead = make_user("gabriel", "superadmin")
        self.darelle = make_user("darelle", "membre")
        self.josue = make_user("josue", "membre")
        self.tache_darelle = Tache.objects.create(
            titre="T-darelle", branch=self.branch, assignee=self.darelle,
            created_by=self.lead, validateur=self.lead, current_node=self.start,
        )

    def test_membre_ne_voit_que_ses_taches(self):
        client = APIClient()
        client.force_authenticate(self.josue)
        r = client.get("/api/pilotage/taches")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 0)

    def test_membre_voit_sa_propre_tache(self):
        client = APIClient()
        client.force_authenticate(self.darelle)
        r = client.get("/api/pilotage/taches")
        self.assertEqual(len(r.data), 1)

    def test_lead_voit_tout(self):
        client = APIClient()
        client.force_authenticate(self.lead)
        r = client.get("/api/pilotage/taches")
        self.assertEqual(len(r.data), 1)


class AvancerTests(TestCase):
    def setUp(self):
        self.branch, self.start, self.work, self.valid = make_tronc()
        self.lead = make_user("gabriel", "superadmin")
        self.darelle = make_user("darelle", "membre")
        self.tache = Tache.objects.create(
            titre="T", branch=self.branch, assignee=self.darelle,
            created_by=self.lead, validateur=self.lead, current_node=self.start,
        )

    def test_assigne_avance_sur_noeud_non_bloquant(self):
        client = APIClient()
        client.force_authenticate(self.darelle)
        r = client.post(f"/api/pilotage/taches/{self.tache.pk}/avancer", {"to_num": 2}, format="json")
        self.assertEqual(r.status_code, 200)
        self.tache.refresh_from_db()
        self.assertEqual(self.tache.current_node.num, 2)

    def test_assigne_seul_ne_peut_pas_sortir_d_un_noeud_bloquant(self):
        """Le nœud bloquant se franchit DEPUIS lui (le validateur approuve et
        fait avancer) — l'assigné seul ne peut pas quitter 'En validation'."""
        final = Node.objects.create(branch=self.branch, num=4, kind="final", titre="Clôturé")
        Edge.objects.create(branch=self.branch, from_num=3, to_num=4)
        self.tache.current_node = self.valid
        self.tache.save()
        client = APIClient()
        client.force_authenticate(self.darelle)
        r = client.post(f"/api/pilotage/taches/{self.tache.pk}/avancer", {"to_num": 4}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_validateur_franchit_le_noeud_bloquant(self):
        self.tache.current_node = self.work
        self.tache.save()
        client = APIClient()
        client.force_authenticate(self.lead)
        r = client.post(f"/api/pilotage/taches/{self.tache.pk}/avancer", {"to_num": 3}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_franchir_le_noeud_final_cloture_la_tache(self):
        final = Node.objects.create(branch=self.branch, num=4, kind="final", titre="Clôturé")
        Edge.objects.create(branch=self.branch, from_num=3, to_num=4)
        self.tache.current_node = self.valid
        self.tache.save()
        client = APIClient()
        client.force_authenticate(self.lead)
        r = client.post(f"/api/pilotage/taches/{self.tache.pk}/avancer", {"to_num": 4}, format="json")
        self.assertEqual(r.status_code, 200)
        self.tache.refresh_from_db()
        self.assertTrue(self.tache.clos)


class SousTacheTests(TestCase):
    def setUp(self):
        self.branch, self.start, _, _ = make_tronc()
        self.lead = make_user("gabriel", "superadmin")
        self.darelle = make_user("darelle", "membre")
        self.josue = make_user("josue", "membre")
        self.tache = Tache.objects.create(
            titre="T", branch=self.branch, assignee=self.darelle, created_by=self.lead, current_node=self.start,
        )

    def test_seul_l_assigne_cree_une_sous_tache(self):
        client = APIClient()
        client.force_authenticate(self.josue)
        r = client.post("/api/pilotage/sous-taches", {"tache": self.tache.pk, "titre": "s1"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_l_assigne_cree_sa_sous_tache(self):
        client = APIClient()
        client.force_authenticate(self.darelle)
        r = client.post("/api/pilotage/sous-taches", {"tache": self.tache.pk, "titre": "s1"}, format="json")
        self.assertEqual(r.status_code, 201)


class PertPilotageTests(TestCase):
    def setUp(self):
        self.statut = PertStatut.objects.create(cle="concevoir", label="à concevoir")
        self.lead = make_user("gabriel", "superadmin")
        self.membre = make_user("darelle", "membre")

    def test_membre_lit_mais_ne_peut_pas_editer(self):
        t = PertTask.objects.create(num=1, name="Tache 1", statut=self.statut)
        client = APIClient()
        client.force_authenticate(self.membre)
        r = client.get("/api/pilotage/pert/tasks")
        self.assertEqual(r.status_code, 200)
        r2 = client.patch(f"/api/pilotage/pert/tasks/{t.pk}", {"dur": 5}, format="json")
        self.assertEqual(r2.status_code, 403)

    def test_predecesseur_inconnu_refuse(self):
        client = APIClient()
        client.force_authenticate(self.lead)
        r = client.post("/api/pilotage/pert/tasks", {
            "num": 1, "name": "T1", "preds": [999], "dur": 1, "statut": self.statut.pk,
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_membre_peut_obtenir_une_permission_directe_ibac(self):
        """La permission pilotage.pert.editer peut être accordée directement à
        un membre sans passer par le rôle superadmin/admin (IBAC)."""
        grant_permission(self.membre, "pilotage.pert.editer")
        client = APIClient()
        client.force_authenticate(self.membre)
        r = client.post("/api/pilotage/pert/tasks", {
            "num": 1, "name": "T1", "preds": [], "dur": 1, "statut": self.statut.pk,
        }, format="json")
        self.assertEqual(r.status_code, 201)
