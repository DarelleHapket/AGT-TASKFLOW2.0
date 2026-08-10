from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from authentification.models import StatutCompte, User
from authentification.services import assign_role
from projets.models import MembreProjet, Projet, Tache

from .models import Besoin, Note, OrdreJournalier


def make_user(username, role="membre"):
    u = User.objects.create(username=username, statut=StatutCompte.ACTIF, is_active=True)
    assign_role(u, role)
    return u


class BesoinTests(TestCase):
    def test_crud_basique(self):
        u = make_user("darelle")
        client = APIClient()
        client.force_authenticate(u)
        r = client.post("/api/besoins", {"titre": "Un PC", "type": "Matériel"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Besoin.objects.count(), 1)


class NoteTests(TestCase):
    def setUp(self):
        self.auteur = make_user("darelle")
        self.autre = make_user("josue")
        self.note = Note.objects.create(titre="N1", contenu="c", auteur=self.auteur)

    def test_lecture_publique(self):
        client = APIClient()
        client.force_authenticate(self.autre)
        r = client.get("/api/notes")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_seul_l_auteur_modifie(self):
        client = APIClient()
        client.force_authenticate(self.autre)
        r = client.put(f"/api/notes/{self.note.pk}", {"titre": "hack", "contenu": "x"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_auteur_peut_modifier(self):
        client = APIClient()
        client.force_authenticate(self.auteur)
        r = client.put(f"/api/notes/{self.note.pk}", {"titre": "maj", "contenu": "x"}, format="json")
        self.assertEqual(r.status_code, 200)


class DailyOrderTests(TestCase):
    def setUp(self):
        self.moi = make_user("darelle")
        self.autre = make_user("josue")
        self.projet = Projet.objects.create(nom="P")
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.moi, role="owner")
        self.tache = Tache.objects.create(id="T1", description="d", projet=self.projet, createur=self.moi)

    def test_je_gere_ma_propre_journee(self):
        client = APIClient()
        client.force_authenticate(self.moi)
        r = client.post("/api/ordre-journalier/ajouter", {
            "task_id": "T1", "date": date.today().isoformat(), "order_index": 0,
        }, format="json")
        self.assertEqual(r.status_code, 201)

    def test_je_ne_gere_pas_la_journee_d_un_autre(self):
        client = APIClient()
        client.force_authenticate(self.moi)
        r = client.post("/api/ordre-journalier/ajouter", {
            "member_id": self.autre.pk, "task_id": "T1", "date": date.today().isoformat(),
        }, format="json")
        self.assertEqual(r.status_code, 403)

    def test_admin_lit_mais_ne_peut_pas_modifier(self):
        admin = make_user("gabriel", "admin")
        OrdreJournalier.objects.create(membre=self.moi, tache=self.tache, date=date.today())
        client = APIClient()
        client.force_authenticate(admin)
        r = client.get("/api/ordre-journalier", {"member_id": self.moi.pk})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)


class PerformanceTests(TestCase):
    def setUp(self):
        self.chef = make_user("chef", "chef_projet")
        self.membre = make_user("membre", "membre")
        self.projet = Projet.objects.create(nom="P")
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.chef, role="owner")
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.membre, role="contributor")
        from django.utils import timezone
        Tache.objects.create(
            id="T1", description="d", projet=self.projet, responsable=self.membre,
            statut=Tache.DONE, duree=2, date_completion=timezone.now(),
        )

    def test_membre_ne_voit_que_ses_propres_stats(self):
        client = APIClient()
        client.force_authenticate(self.membre)
        r = client.get("/api/performance")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["member"], "membre")

    def test_admin_voit_tout(self):
        admin = make_user("gabriel", "admin")
        client = APIClient()
        client.force_authenticate(admin)
        r = client.get("/api/performance")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
