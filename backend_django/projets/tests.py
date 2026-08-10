from django.test import TestCase
from rest_framework.test import APIClient

from authentification.models import StatutCompte, User
from authentification.services import assign_role

from .acces import get_task_permission_level, is_task_visible
from .models import Activite, MembreProjet, Projet, Tache
from .pert import CycleError, compute_pert


def make_user(username, role="membre"):
    u = User.objects.create(username=username, statut=StatutCompte.ACTIF, is_active=True)
    assign_role(u, role)
    return u


class PertEngineTests(TestCase):
    def test_chaine_lineaire_chemin_critique(self):
        tasks = [
            {"id": "A", "duration": 2, "dependencies": []},
            {"id": "B", "duration": 3, "dependencies": ["A"]},
            {"id": "C", "duration": 1, "dependencies": ["B"]},
        ]
        result = compute_pert(tasks)
        self.assertEqual(result["A"]["es"], 0)
        self.assertEqual(result["A"]["ef"], 2)
        self.assertEqual(result["C"]["ef"], 6)
        self.assertTrue(result["A"]["critical"])
        self.assertTrue(result["B"]["critical"])
        self.assertTrue(result["C"]["critical"])

    def test_marge_sur_branche_non_critique(self):
        tasks = [
            {"id": "A", "duration": 5, "dependencies": []},
            {"id": "B", "duration": 1, "dependencies": []},
            {"id": "C", "duration": 1, "dependencies": ["A", "B"]},
        ]
        result = compute_pert(tasks)
        self.assertFalse(result["B"]["critical"])
        self.assertGreater(result["B"]["slack"], 0)
        self.assertTrue(result["A"]["critical"])

    def test_cycle_detecte(self):
        tasks = [
            {"id": "A", "duration": 1, "dependencies": ["B"]},
            {"id": "B", "duration": 1, "dependencies": ["A"]},
        ]
        with self.assertRaises(CycleError):
            compute_pert(tasks)


class ProjectCreationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_chef_projet_peut_creer_un_projet(self):
        """Non-régression BUG-02 (Flask) : un utilisateur avec le rôle chef_projet
        doit pouvoir créer un projet."""
        chef = make_user("josue", "chef_projet")
        self.client.force_authenticate(chef)
        r = self.client.post("/api/projets", {"nom": "ERP v2", "description": "d"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(MembreProjet.objects.filter(projet_id=r.data["id"], utilisateur=chef, role="owner").exists())

    def test_membre_simple_ne_peut_pas_creer_un_projet(self):
        membre = make_user("darelle", "membre")
        self.client.force_authenticate(membre)
        r = self.client.post("/api/projets", {"nom": "X"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_admin_ne_peut_pas_creer_un_projet(self):
        admin = make_user("gabriel", "admin")
        self.client.force_authenticate(admin)
        r = self.client.post("/api/projets", {"nom": "X"}, format="json")
        self.assertEqual(r.status_code, 403)


class TaskVisibilityAndPermissionTests(TestCase):
    def setUp(self):
        self.owner = make_user("owner", "chef_projet")
        self.manager = make_user("manager", "membre")
        self.contributeur = make_user("contrib", "membre")
        self.dehors = make_user("dehors", "membre")
        self.projet = Projet.objects.create(nom="P1")
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.owner, role=MembreProjet.OWNER)
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.manager, role=MembreProjet.MANAGER)
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.contributeur, role=MembreProjet.CONTRIBUTOR)
        self.tache = Tache.objects.create(
            id="T1", description="faire un truc", projet=self.projet,
            responsable=self.contributeur, createur=self.owner,
        )

    def test_visible_par_tout_membre_du_projet(self):
        self.assertTrue(is_task_visible(self.tache, self.manager))
        self.assertTrue(is_task_visible(self.tache, self.contributeur))

    def test_invisible_hors_projet_pour_tache_sans_projet(self):
        perso = Tache.objects.create(id="T2", description="perso", createur=self.owner)
        self.assertTrue(is_task_visible(perso, self.owner))
        self.assertFalse(is_task_visible(perso, self.dehors))

    def test_permission_full_owner_et_manager(self):
        self.assertEqual(get_task_permission_level(self.owner, self.tache), "full")
        self.assertEqual(get_task_permission_level(self.manager, self.tache), "full")

    def test_permission_status_only_contributeur_responsable(self):
        self.assertEqual(get_task_permission_level(self.contributeur, self.tache), "status_only")

    def test_permission_read_only_contributeur_non_responsable(self):
        autre_contrib = make_user("contrib2", "membre")
        MembreProjet.objects.create(projet=self.projet, utilisateur=autre_contrib, role=MembreProjet.CONTRIBUTOR)
        self.assertEqual(get_task_permission_level(autre_contrib, self.tache), "read_only")

    def test_status_only_ne_peut_modifier_que_le_statut(self):
        client = APIClient()
        client.force_authenticate(self.contributeur)
        r = client.patch(f"/api/taches/{self.tache.id}", {"description": "triche"}, format="json")
        self.assertEqual(r.status_code, 403)
        r2 = client.patch(f"/api/taches/{self.tache.id}", {"statut": "done"}, format="json")
        self.assertEqual(r2.status_code, 200)

    def test_liste_taches_contient_les_champs_pert(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        r = client.get("/api/taches")
        self.assertEqual(r.status_code, 200)
        self.assertIn("tasks", r.data)
        self.assertIn("es", r.data["tasks"][0])
        self.assertIn("critical", r.data["tasks"][0])


class ActivityGuardTests(TestCase):
    def setUp(self):
        self.owner = make_user("owner2", "chef_projet")
        self.contributeur = make_user("contrib3", "membre")
        self.projet = Projet.objects.create(nom="P2")
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.owner, role=MembreProjet.OWNER)
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.contributeur, role=MembreProjet.CONTRIBUTOR)

    def test_contributeur_ne_peut_pas_creer_activite(self):
        client = APIClient()
        client.force_authenticate(self.contributeur)
        r = client.post("/api/activites", {"nom": "A1", "projet": self.projet.pk}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_owner_peut_creer_activite(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        r = client.post("/api/activites", {"nom": "A1", "projet": self.projet.pk}, format="json")
        self.assertEqual(r.status_code, 201)


class DifficultyTests(TestCase):
    def setUp(self):
        self.owner = make_user("owner3", "chef_projet")
        self.manager = make_user("manager3", "membre")
        self.responsable = make_user("resp3", "membre")
        self.dehors = make_user("dehors3", "membre")
        self.projet = Projet.objects.create(nom="P3")
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.owner, role=MembreProjet.OWNER)
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.manager, role=MembreProjet.MANAGER)
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.responsable, role=MembreProjet.CONTRIBUTOR)
        self.tache = Tache.objects.create(
            id="T3", description="tâche", projet=self.projet, responsable=self.responsable, createur=self.owner,
        )

    def test_responsable_peut_signaler_et_owner_manager_sont_notifies(self):
        client = APIClient()
        client.force_authenticate(self.responsable)
        r = client.post("/api/difficultes/creer", {"task_id": "T3", "content": "bloqué"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.owner.notifications.count(), 1)
        self.assertEqual(self.manager.notifications.count(), 1)
        self.assertEqual(self.responsable.notifications.count(), 0, "pas d'auto-notification")

    def test_membre_hors_projet_ne_peut_pas_signaler(self):
        client = APIClient()
        client.force_authenticate(self.dehors)
        r = client.post("/api/difficultes/creer", {"task_id": "T3", "content": "x"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_membre_hors_projet_ne_voit_pas_les_difficultes(self):
        client = APIClient()
        client.force_authenticate(self.dehors)
        r = client.get("/api/difficultes", {"task_id": "T3"})
        self.assertEqual(r.status_code, 403)


class MembreProjetDetailTests(TestCase):
    def setUp(self):
        self.owner = make_user("owner4", "chef_projet")
        self.contrib = make_user("contrib4", "membre")
        self.projet = Projet.objects.create(nom="P4")
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.owner, role=MembreProjet.OWNER)
        self.mp = MembreProjet.objects.create(projet=self.projet, utilisateur=self.contrib, role=MembreProjet.CONTRIBUTOR)

    def test_owner_change_le_role_dun_membre(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        r = client.put(f"/api/projets/{self.projet.id}/membres/{self.mp.id}", {"role": "manager"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.mp.refresh_from_db()
        self.assertEqual(self.mp.role, "manager")

    def test_non_owner_ne_peut_pas_changer_le_role(self):
        client = APIClient()
        client.force_authenticate(self.contrib)
        r = client.put(f"/api/projets/{self.projet.id}/membres/{self.mp.id}", {"role": "manager"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_owner_retire_un_membre(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        r = client.delete(f"/api/projets/{self.projet.id}/membres/{self.mp.id}")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(MembreProjet.objects.filter(pk=self.mp.id).exists())


class TaskAssignmentNotificationTests(TestCase):
    """Non-régression : le responsable désigné d'une tâche doit être notifié
    (task_assigned), à la création comme au changement de responsable — port
    de backend/routes/tasks.py (create_task/update_task), oublié lors de la
    première migration vers Django."""

    def setUp(self):
        from notifications.models import Notification

        self.Notification = Notification
        self.chef = make_user("chefnotif", "chef_projet")
        self.membre = make_user("membrenotif", "membre")
        self.autre_membre = make_user("autremembrenotif", "membre")
        self.projet = Projet.objects.create(nom="PNotif")
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.chef, role=MembreProjet.OWNER)
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.membre, role=MembreProjet.CONTRIBUTOR)
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.autre_membre, role=MembreProjet.CONTRIBUTOR)
        self.client = APIClient()
        self.client.force_authenticate(self.chef)

    def test_notification_a_la_creation(self):
        r = self.client.post("/api/taches", {
            "id": "T-NOTIF-1", "description": "Tâche test", "projet": self.projet.id,
            "responsable": self.membre.id, "duree": 2,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(self.Notification.objects.filter(
            destinataire=self.membre, type="task_assigned", tache_id="T-NOTIF-1",
        ).exists())

    def test_pas_de_notification_si_le_createur_se_lassigne_lui_meme(self):
        r = self.client.post("/api/taches", {
            "id": "T-NOTIF-2", "description": "Tâche test", "projet": self.projet.id,
            "responsable": self.chef.id, "duree": 2,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertFalse(self.Notification.objects.filter(tache_id="T-NOTIF-2").exists())

    def test_notification_au_changement_de_responsable(self):
        Tache.objects.create(id="T-NOTIF-3", description="Tâche test", projet=self.projet,
                              responsable=self.membre, createur=self.chef, duree=2)
        r = self.client.put(f"/api/taches/T-NOTIF-3", {
            "id": "T-NOTIF-3", "description": "Tâche test", "projet": self.projet.id,
            "responsable": self.autre_membre.id, "duree": 2,
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(self.Notification.objects.filter(
            destinataire=self.autre_membre, type="task_assigned", tache_id="T-NOTIF-3",
        ).exists())
