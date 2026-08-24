from django.test import TestCase
from rest_framework.test import APIClient

from authentification.models import StatutCompte, User
from authentification.services import assign_role, grant_permission

from .acces import get_task_permission_level, has_project_permission, is_task_visible
from .models import Activite, MembreProjet, PermissionMembreProjet, Projet, Tache
from .pert import CycleError, compute_pert


def make_user(username, role="user"):
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

    def test_utilisateur_avec_permission_projets_write_peut_creer_un_projet(self):
        """Non-régression BUG-02 (Flask) : un utilisateur disposant de la
        permission projets.write doit pouvoir créer un projet, quel que soit
        son rôle nommé (catalogue réduit à 2 rôles, 2026-08-19)."""
        chef = make_user("josue", "user")
        grant_permission(chef, "projets.write")
        self.client.force_authenticate(chef)
        r = self.client.post("/api/projets", {"nom": "ERP v2", "description": "d"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(MembreProjet.objects.filter(projet_id=r.data["id"], utilisateur=chef, role="owner").exists())

    def test_membre_simple_ne_peut_pas_creer_un_projet(self):
        membre = make_user("darelle", "user")
        self.client.force_authenticate(membre)
        r = self.client.post("/api/projets", {"nom": "X"}, format="json")
        self.assertEqual(r.status_code, 403)


class TaskVisibilityAndPermissionTests(TestCase):
    def setUp(self):
        self.owner = make_user("owner", "user")
        self.manager = make_user("manager", "user")
        self.contributeur = make_user("contrib", "user")
        self.dehors = make_user("dehors", "user")
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
        autre_contrib = make_user("contrib2", "user")
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


class PermissionProjetFlexibleTests(TestCase):
    """IBAC projet flexible (2026-08-23) : une permission accordée/retirée
    directement à un membre sur CE projet prime toujours sur le paquet par
    défaut de son rôle — même logique que PermissionEffective au niveau
    global, appliquée ici à taches.gerer/activites.gerer/equipe.gerer/
    projet.gerer."""

    def setUp(self):
        self.owner = make_user("owner5", "user")
        self.manager = make_user("manager5", "user")
        self.contributeur = make_user("contrib5", "user")
        self.projet = Projet.objects.create(nom="P5")
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.owner, role=MembreProjet.OWNER)
        self.mp_manager = MembreProjet.objects.create(projet=self.projet, utilisateur=self.manager, role=MembreProjet.MANAGER)
        self.mp_contrib = MembreProjet.objects.create(projet=self.projet, utilisateur=self.contributeur, role=MembreProjet.CONTRIBUTOR)
        self.client = APIClient()

    def test_contributeur_sans_octroi_ne_peut_pas_creer_de_tache(self):
        self.client.force_authenticate(self.contributeur)
        r = self.client.post("/api/taches", {
            "id": "T-FLEX-1", "description": "d", "projet": self.projet.id, "duree": 1,
        }, format="json")
        self.assertEqual(r.status_code, 403)

    def test_contributeur_avec_octroi_direct_peut_creer_une_tache(self):
        PermissionMembreProjet.objects.create(membre_projet=self.mp_contrib, code="taches.gerer", accordee=True)
        self.assertTrue(has_project_permission(self.contributeur, self.projet.id, "taches.gerer"))
        self.client.force_authenticate(self.contributeur)
        r = self.client.post("/api/taches", {
            "id": "T-FLEX-2", "description": "d", "projet": self.projet.id, "duree": 1,
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)

    def test_manager_avec_retrait_direct_perd_la_permission(self):
        """Le retrait direct prime sur le paquet par défaut du rôle."""
        PermissionMembreProjet.objects.create(membre_projet=self.mp_manager, code="taches.gerer", accordee=False)
        self.assertFalse(has_project_permission(self.manager, self.projet.id, "taches.gerer"))
        # activites.gerer, jamais touché, reste accordé par le paquet manager
        self.assertTrue(has_project_permission(self.manager, self.projet.id, "activites.gerer"))

    def test_owner_garde_toutes_les_capacites_par_defaut(self):
        for code in ("taches.gerer", "activites.gerer", "equipe.gerer", "projet.gerer"):
            self.assertTrue(has_project_permission(self.owner, self.projet.id, code))

    def test_endpoint_permissions_detail_distingue_role_et_direct(self):
        PermissionMembreProjet.objects.create(membre_projet=self.mp_manager, code="equipe.gerer", accordee=True)
        self.client.force_authenticate(self.owner)
        r = self.client.get(f"/api/projets/{self.projet.id}/membres/{self.mp_manager.id}/permissions")
        self.assertEqual(r.status_code, 200)
        by_code = {row["code"]: row for row in r.data}
        self.assertEqual(by_code["taches.gerer"]["source"], "role")
        self.assertTrue(by_code["taches.gerer"]["granted"])
        self.assertEqual(by_code["equipe.gerer"]["source"], "direct")
        self.assertTrue(by_code["equipe.gerer"]["granted"])
        self.assertIsNone(by_code["projet.gerer"]["source"])
        self.assertFalse(by_code["projet.gerer"]["granted"])

    def test_set_permission_reserve_a_equipe_gerer(self):
        self.client.force_authenticate(self.contributeur)
        r = self.client.put(
            f"/api/projets/{self.projet.id}/membres/{self.mp_contrib.id}/permissions/taches.gerer",
            {"granted": True}, format="json",
        )
        self.assertEqual(r.status_code, 403)

    def test_owner_peut_accorder_une_permission_via_lendpoint(self):
        self.client.force_authenticate(self.owner)
        r = self.client.put(
            f"/api/projets/{self.projet.id}/membres/{self.mp_contrib.id}/permissions/taches.gerer",
            {"granted": True}, format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(has_project_permission(self.contributeur, self.projet.id, "taches.gerer"))


class ActivityGuardTests(TestCase):
    def setUp(self):
        self.owner = make_user("owner2", "user")
        self.contributeur = make_user("contrib3", "user")
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
        self.owner = make_user("owner3", "user")
        self.manager = make_user("manager3", "user")
        self.responsable = make_user("resp3", "user")
        self.dehors = make_user("dehors3", "user")
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
        self.owner = make_user("owner4", "user")
        self.contrib = make_user("contrib4", "user")
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
        self.chef = make_user("chefnotif", "user")
        self.membre = make_user("membrenotif", "user")
        self.autre_membre = make_user("autremembrenotif", "user")
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


class TaskProgressionNotificationTests(TestCase):
    """Le responsable assigné met à jour sa progression (en_cours/terminé,
    PATCH status_only) : le créateur de la tâche et les owner/manager du
    projet doivent être notifiés (task_progression)."""

    def setUp(self):
        from notifications.models import Notification

        self.Notification = Notification
        self.owner = make_user("ownerprog", "user")
        self.manager = make_user("managerprog", "user")
        self.contributeur = make_user("contribprog", "user")
        self.projet = Projet.objects.create(nom="PProgression")
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.owner, role=MembreProjet.OWNER)
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.manager, role=MembreProjet.MANAGER)
        MembreProjet.objects.create(projet=self.projet, utilisateur=self.contributeur, role=MembreProjet.CONTRIBUTOR)
        self.tache = Tache.objects.create(
            id="T-PROG-1", description="Avancer", projet=self.projet,
            responsable=self.contributeur, createur=self.owner, duree=2,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.contributeur)

    def test_passage_en_cours_notifie_createur_et_manager(self):
        r = self.client.patch(f"/api/taches/{self.tache.id}", {"statut": "in_progress"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(self.Notification.objects.filter(
            destinataire=self.owner, type="task_progression", tache_id=self.tache.id,
        ).exists())
        self.assertTrue(self.Notification.objects.filter(
            destinataire=self.manager, type="task_progression", tache_id=self.tache.id,
        ).exists())

    def test_passage_termine_notifie_createur(self):
        r = self.client.patch(f"/api/taches/{self.tache.id}", {"statut": "done"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(self.Notification.objects.filter(
            destinataire=self.owner, type="task_progression", tache_id=self.tache.id,
        ).exists())

    def test_manager_qui_change_le_statut_directement_notifie_aussi(self):
        """Non-régression : un owner/manager a un accès 'full' (pas
        'status_only'), passe donc par un autre chemin de code — doit quand
        même déclencher la notification de progression."""
        self.client.force_authenticate(self.manager)
        r = self.client.patch(f"/api/taches/{self.tache.id}", {"statut": "in_progress"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(self.Notification.objects.filter(
            destinataire=self.owner, type="task_progression", tache_id=self.tache.id,
        ).exists())

    def test_pas_de_notification_si_le_statut_ne_change_pas(self):
        self.client.patch(f"/api/taches/{self.tache.id}", {"statut": "in_progress"}, format="json")
        self.Notification.objects.filter(tache_id=self.tache.id).delete()
        r = self.client.patch(f"/api/taches/{self.tache.id}", {"statut": "in_progress"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(self.Notification.objects.filter(tache_id=self.tache.id).exists())
