from django.test import TestCase
from rest_framework.test import APIClient

from authentification.models import StatutCompte, User
from authentification.services import assign_role, grant_permission
from notifications.models import Notification
from projets.models import Projet

from .models import AlerteMateriel, Materiel, MouvementMateriel, TypeMateriel
from .services import calculer_stock


def make_user(username, role="user"):
    u = User.objects.create(username=username, statut=StatutCompte.ACTIF, is_active=True)
    assign_role(u, role)
    return u


def make_materiel_admin(username):
    """Équivalent, en permissions directes, de l'ancien rôle "admin" pour ce
    module (catalogue réduit à 2 rôles, 2026-08-19)."""
    u = make_user(username, "user")
    grant_permission(u, "materiel.read")
    grant_permission(u, "materiel.write")
    return u


class PermissionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = make_materiel_admin("adminmat")
        self.membre = make_user("membremat", "user")

    def test_membre_voit_mais_ne_gere_pas_le_materiel(self):
        """Révision du 2026-08-18 : un Membre voit désormais l'inventaire et
        les mouvements en lecture seule (materiel.read) — la gestion reste
        réservée à materiel.write (Admin/Superadmin)."""
        self.client.force_authenticate(self.membre)
        r = self.client.get("/api/materiel/inventaire")
        self.assertEqual(r.status_code, 200)
        r = self.client.get("/api/materiel/mouvements")
        self.assertEqual(r.status_code, 200)
        r = self.client.post("/api/materiel/types", {"nom": "Ordinateur"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_admin_peut_gerer_le_materiel(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/materiel/types", {"nom": "Ordinateur"}, format="json")
        self.assertEqual(r.status_code, 201)


class StockMouvementTests(TestCase):
    """BF-12 : achat/hors service/consommation mettent à jour le stock
    (BF-11) ; affectation/retour tracent seulement l'emplacement, sans
    changer le total possédé."""

    def setUp(self):
        self.client = APIClient()
        self.admin = make_materiel_admin("adminstock")
        self.autre = make_user("autreutilisateur", "user")
        self.client.force_authenticate(self.admin)
        self.type = TypeMateriel.objects.create(nom="Ordinateur")
        self.materiel = Materiel.objects.create(nom="Laptop Dell", type=self.type, date_achat="2026-01-01", quantite=0)

    def test_mouvement_notifie_tous_les_actifs_sauf_lauteur(self):
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "achat", "quantite": 10,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(Notification.objects.filter(destinataire=self.autre, type="mouvement_materiel").exists())
        self.assertFalse(Notification.objects.filter(destinataire=self.admin, type="mouvement_materiel").exists())

    def test_achat_augmente_le_stock(self):
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "achat", "quantite": 10,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.quantite, 10)

    def test_hors_service_diminue_le_stock(self):
        self.materiel.quantite = 5
        self.materiel.save()
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "hors_service", "quantite": 2,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.quantite, 3)

    def test_consommation_diminue_le_stock(self):
        self.materiel.quantite = 5
        self.materiel.save()
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "consommation", "quantite": 2,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.quantite, 3)

    def test_hors_service_superieur_au_stock_refuse(self):
        self.materiel.quantite = 1
        self.materiel.save()
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "hors_service", "quantite": 5,
        }, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(MouvementMateriel.objects.exists())  # rollback, pas de mouvement orphelin

    def test_rupture_de_stock_cree_une_alerte_notifiee_aux_gestionnaires(self):
        """BF-08/BF-11 : la rupture de stock crée une alerte automatique et
        notifie Superadmin + materiel.write, pas tous les actifs. L'auteur du
        mouvement (self.admin) ne peut pas apparaître comme destinataire —
        notify() s'auto-exclut toujours (règle RBAC.md) — donc on vérifie
        avec un second gestionnaire, distinct de l'auteur."""
        autre_gestionnaire = make_materiel_admin("gestionnaire2")
        self.materiel.quantite = 2
        self.materiel.save()
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "hors_service", "quantite": 2,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(AlerteMateriel.objects.filter(materiel=self.materiel, type_alerte="rupture_stock", statut="ouverte").exists())
        self.assertTrue(Notification.objects.filter(destinataire=autre_gestionnaire, type="alerte_materiel").exists())
        self.assertFalse(Notification.objects.filter(destinataire=self.autre, type="alerte_materiel").exists())

    def test_rupture_de_stock_anti_doublon(self):
        """BF-09 : pas de deuxième alerte ouverte si une rupture est déjà
        signalée pour ce matériel."""
        self.materiel.quantite = 0
        self.materiel.save()
        for _ in range(2):
            self.client.post("/api/materiel/mouvements", {
                "materiel": self.materiel.id, "type_mouvement": "achat", "quantite": 1,
            }, format="json")
            self.client.post("/api/materiel/mouvements", {
                "materiel": self.materiel.id, "type_mouvement": "hors_service", "quantite": 1,
            }, format="json")
        self.assertEqual(AlerteMateriel.objects.filter(materiel=self.materiel, type_alerte="rupture_stock").count(), 1)

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
        self.admin = make_materiel_admin("adminproj")
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


class DisponibiliteAffectationTests(TestCase):
    """BNF-02 : un matériel déjà affecté ne peut pas être réaffecté ailleurs
    sans un mouvement retour préalable."""

    def setUp(self):
        self.client = APIClient()
        self.admin = make_materiel_admin("adminaffect")
        self.client.force_authenticate(self.admin)
        self.type = TypeMateriel.objects.create(nom="Ordinateur")
        self.employe_a = self._make_employe("empA")
        self.employe_b = self._make_employe("empB")
        self.materiel = Materiel.objects.create(nom="Laptop", type=self.type, date_achat="2026-01-01", quantite=5)

    def _make_employe(self, username):
        from rh.models import Employe, Profil
        u = make_user(username, "user")
        profil = Profil.objects.get(utilisateur=u)  # auto-créé par le signal à l'activation (rh/signals.py)
        return Employe.objects.create(profil=profil, date_embauche="2026-01-01")

    def test_reaffectation_sans_retour_refusee(self):
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "affectation", "quantite": 1, "employe": self.employe_a.id,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "affectation", "quantite": 1, "employe": self.employe_b.id,
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_reaffectation_apres_retour_acceptee(self):
        self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "affectation", "quantite": 1, "employe": self.employe_a.id,
        }, format="json")
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "retour", "quantite": 1, "employe": self.employe_a.id,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        r = self.client.post("/api/materiel/mouvements", {
            "materiel": self.materiel.id, "type_mouvement": "affectation", "quantite": 1, "employe": self.employe_b.id,
        }, format="json")
        self.assertEqual(r.status_code, 201)


class SuppressionProtegeeTests(TestCase):
    """BF-02/BF-04 : suppression d'un type/matériel référencé -> message
    propre (409), pas un 500 ProtectedError non intercepté."""

    def setUp(self):
        self.client = APIClient()
        self.admin = make_materiel_admin("adminsuppr")
        self.client.force_authenticate(self.admin)
        self.type = TypeMateriel.objects.create(nom="Imprimante")
        self.materiel = Materiel.objects.create(nom="Imprimante A", type=self.type, date_achat="2026-01-01", quantite=1)
        MouvementMateriel.objects.create(materiel=self.materiel, type_mouvement="achat", quantite=1)

    def test_suppression_type_utilise_refusee_proprement(self):
        r = self.client.delete(f"/api/materiel/types/{self.type.id}")
        self.assertEqual(r.status_code, 409)

    def test_suppression_materiel_avec_mouvements_refusee_proprement(self):
        r = self.client.delete(f"/api/materiel/inventaire/{self.materiel.id}")
        self.assertEqual(r.status_code, 409)

    def test_modification_materiel_toujours_possible_meme_avec_mouvements(self):
        """Distinction à ne pas confondre avec la suppression (ci-dessus) :
        corriger le nom d'un matériel ne touche à aucun mouvement, donc reste
        possible à tout moment — même après le premier mouvement enregistré."""
        r = self.client.patch(f"/api/materiel/inventaire/{self.materiel.id}", {"nom": "Imprimante corrigée"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.materiel.refresh_from_db()
        self.assertEqual(self.materiel.nom, "Imprimante corrigée")

    def test_modification_type_materiel_toujours_possible_meme_si_utilise(self):
        r = self.client.patch(f"/api/materiel/types/{self.type.id}", {"nom": "Imprimante laser"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)


class AlerteManuelleTests(TestCase):
    """BF-09/BF-10 : alerte manuelle (anomalie/rappel), anti-doublon, et
    traitement."""

    def setUp(self):
        self.client = APIClient()
        self.admin = make_materiel_admin("adminalerte")
        self.client.force_authenticate(self.admin)
        self.type = TypeMateriel.objects.create(nom="Serveur")
        self.materiel = Materiel.objects.create(nom="Serveur Y", type=self.type, date_achat="2026-01-01", quantite=1)

    def test_creer_alerte_anomalie(self):
        r = self.client.post("/api/materiel/alertes", {
            "materiel": self.materiel.id, "type_alerte": "anomalie", "message": "Bruit anormal au démarrage",
        }, format="json")
        self.assertEqual(r.status_code, 201)

    def test_anti_doublon_meme_type_ouvert(self):
        self.client.post("/api/materiel/alertes", {
            "materiel": self.materiel.id, "type_alerte": "anomalie", "message": "Premier signalement",
        }, format="json")
        r = self.client.post("/api/materiel/alertes", {
            "materiel": self.materiel.id, "type_alerte": "anomalie", "message": "Deuxième signalement",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_traiter_alerte(self):
        r = self.client.post("/api/materiel/alertes", {
            "materiel": self.materiel.id, "type_alerte": "rappel", "message": "Contrôle annuel",
        }, format="json")
        alerte_id = r.data["id"]
        r = self.client.post(f"/api/materiel/alertes/{alerte_id}/traiter")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["statut"], "traitee")

    def test_alerte_non_modifiable_ni_supprimable(self):
        r = self.client.post("/api/materiel/alertes", {
            "materiel": self.materiel.id, "type_alerte": "rappel", "message": "Contrôle",
        }, format="json")
        alerte_id = r.data["id"]
        r = self.client.patch(f"/api/materiel/alertes/{alerte_id}", {"message": "x"}, format="json")
        self.assertEqual(r.status_code, 405)
        r = self.client.delete(f"/api/materiel/alertes/{alerte_id}")
        self.assertEqual(r.status_code, 405)


class StockAgregeTests(TestCase):
    def test_calculer_stock_agrege_par_type_et_projet(self):
        t1 = TypeMateriel.objects.create(nom="Licence")
        projet = Projet.objects.create(nom="Projet Stock")
        Materiel.objects.create(nom="Licence A", type=t1, date_achat="2026-01-01", quantite=4, projet=projet)
        Materiel.objects.create(nom="Licence B", type=t1, date_achat="2026-01-01", quantite=6)
        stats = calculer_stock(Materiel.objects.all())
        self.assertEqual(stats["total"], 10)
        self.assertEqual({d["type"]: d["quantite"] for d in stats["par_type"]}, {"Licence": 10})
