"""Tests RBAC + IBAC, cycle de vie du compte, et non-régression des bugs
BUG-01/BUG-02 déjà corrigés côté Flask (cf. RBAC.md et rapports de session)."""
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Permission, PermissionEffective, Role, StatutCompte, User
from .services import assign_role, grant_permission, revoke_permission, revoke_role


class RbacModelTests(TestCase):
    def setUp(self):
        self.voir = Permission.objects.create(code="fruit.voir", module="fruit")
        self.jeter = Permission.objects.create(code="fruit.jeter", module="fruit")
        self.r_user = Role.objects.create(code="testeur")
        self.r_user.permissions.add(self.voir)
        self.g = User.objects.create(username="g", statut=StatutCompte.ACTIF, is_active=True)

    def test_role_et_permission_directe_independants(self):
        """BF-05 : une permission accordée directement survit au retrait du rôle."""
        assign_role(self.g, "testeur")
        self.assertTrue(self.g.peut("fruit.voir"))
        grant_permission(self.g, "fruit.jeter")
        revoke_role(self.g, "testeur")
        self.assertTrue(self.g.peut("fruit.voir"), "la permission copiée depuis le rôle reste (BF-05)")
        self.assertTrue(self.g.peut("fruit.jeter"))

    def test_retrait_direct_prime(self):
        """IBAC : un retrait direct l'emporte même si le rôle accorderait la permission."""
        assign_role(self.g, "testeur")
        self.assertTrue(self.g.peut("fruit.voir"))
        revoke_permission(self.g, "fruit.voir")
        self.assertFalse(self.g.peut("fruit.voir"))

    def test_superadmin_bypass(self):
        chef = User.objects.create(username="chef", is_superuser=True)
        self.assertTrue(chef.peut("nimporte.quoi"))

    def test_multi_roles(self):
        """BF-04 : un utilisateur peut porter plusieurs rôles simultanément."""
        r2 = Role.objects.create(code="autre")
        r2.permissions.add(self.jeter)
        assign_role(self.g, "testeur")
        assign_role(self.g, "autre")
        self.assertEqual(set(self.g.roles_codes()), {"testeur", "autre"})
        self.assertTrue(self.g.peut("fruit.voir"))
        self.assertTrue(self.g.peut("fruit.jeter"))


class MembresApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create(username="admin", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(self.admin, "admin")
        self.membre = User.objects.create(username="darelle", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(self.membre, "membre")

    def test_membre_ne_gere_pas_membres(self):
        self.client.force_authenticate(self.membre)
        r = self.client.post("/api/membres", {"username": "x"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_bug01_admin_valide_une_demande_pas_seulement_superadmin(self):
        """Non-régression BUG-01 : un Admin (pas Superadmin) doit pouvoir valider."""
        demandeur = User.objects.create(username="nouveau", statut=StatutCompte.EN_ATTENTE, is_active=False)
        self.client.force_authenticate(self.admin)
        r = self.client.put(f"/api/membres/{demandeur.pk}/validate", {"action": "approve"}, format="json")
        self.assertEqual(r.status_code, 200)
        demandeur.refresh_from_db()
        self.assertEqual(demandeur.statut, StatutCompte.ACTIF)
        self.assertTrue(demandeur.is_active)
        self.assertIn("membre", demandeur.roles_codes())

    def test_membre_ne_valide_pas_de_demande(self):
        demandeur = User.objects.create(username="nouveau2", statut=StatutCompte.EN_ATTENTE, is_active=False)
        self.client.force_authenticate(self.membre)
        r = self.client.put(f"/api/membres/{demandeur.pk}/validate", {"action": "approve"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_login_compte_en_attente_refuse(self):
        User.objects.create_user(username="attente", email="attente@x.com", password="x",
                                  statut=StatutCompte.EN_ATTENTE, is_active=False)
        r = self.client.post("/api/auth/login", {"email": "attente@x.com", "password": "x"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_login_compte_suspendu_refuse(self):
        User.objects.create_user(username="susp", email="susp@x.com", password="x",
                                  statut=StatutCompte.SUSPENDU, is_active=False)
        r = self.client.post("/api/auth/login", {"email": "susp@x.com", "password": "x"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_login_ok(self):
        User.objects.create_user(username="ok", email="ok@x.com", password="secret123",
                                  statut=StatutCompte.ACTIF, is_active=True)
        r = self.client.post("/api/auth/login", {"email": "ok@x.com", "password": "secret123"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access_token", r.data)

    def test_bug02_revoke_role_puis_reattribution_coherente(self):
        """Non-régression BUG-02 : après retrait d'un rôle puis réattribution,
        le rôle et les permissions doivent rester cohérents (contrairement au
        legacy Flask où members.role et member_roles pouvaient diverger)."""
        chef = User.objects.create(username="josue", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(chef, "chef_projet")
        self.assertTrue(chef.peut("projets.write"))
        revoke_role(chef, "chef_projet")
        self.assertNotIn("chef_projet", chef.roles_codes())
        assign_role(chef, "chef_projet")
        self.assertIn("chef_projet", chef.roles_codes())
        self.assertTrue(chef.peut("projets.write"))


class SuperadminAdminExclusivityTests(TestCase):
    """Superadmin a déjà un accès total (bypass RBAC) ; Admin n'accorde qu'un
    accès en lecture seule. Les deux combinés affichent un badge ADMIN
    trompeur sur un compte qui n'est pas limité — cette combinaison doit être
    refusée par l'API (pas seulement cachée côté UI)."""

    def setUp(self):
        self.client = APIClient()
        self.superadmin_actor = User.objects.create(username="root2", is_superuser=True)
        self.target = User.objects.create(username="cible3", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(self.target, "superadmin")

    def test_assigner_admin_a_un_superadmin_refuse(self):
        self.client.force_authenticate(self.superadmin_actor)
        r = self.client.post(f"/api/rbac/membres/{self.target.pk}/roles", {"role": "admin"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertNotIn("admin", self.target.roles_codes())

    def test_assigner_admin_a_un_membre_normal_fonctionne(self):
        membre = User.objects.create(username="cible4", statut=StatutCompte.ACTIF, is_active=True)
        self.client.force_authenticate(self.superadmin_actor)
        r = self.client.post(f"/api/rbac/membres/{membre.pk}/roles", {"role": "admin"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertIn("admin", membre.roles_codes())


class DeletedMembersHistoryTests(TestCase):
    """Historique des comptes supprimés (A-08, Flask) — port de GET /members/deleted,
    manquant lors de la première migration (TeamView.jsx en avait besoin pour sa
    section "Comptes supprimés")."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create(username="admin2", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(self.admin, "admin")
        self.membre = User.objects.create(username="cible2", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(self.membre, "membre")

    def test_destroy_pose_deleted_at(self):
        self.client.force_authenticate(self.admin)
        r = self.client.delete(f"/api/membres/{self.membre.pk}")
        self.assertEqual(r.status_code, 200)
        self.membre.refresh_from_db()
        self.assertEqual(self.membre.statut, StatutCompte.SUPPRIME)
        self.assertIsNotNone(self.membre.deleted_at)

    def test_liste_les_comptes_supprimes(self):
        self.client.force_authenticate(self.admin)
        self.client.delete(f"/api/membres/{self.membre.pk}")
        r = self.client.get("/api/membres/deleted")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["id"], self.membre.pk)
        self.assertIsNotNone(r.data[0]["deleted_at"])

    def test_membre_ne_voit_pas_lhistorique(self):
        self.client.force_authenticate(self.membre)
        r = self.client.get("/api/membres/deleted")
        self.assertEqual(r.status_code, 403)

    def test_comptes_supprimes_absents_de_la_liste_normale(self):
        self.client.force_authenticate(self.admin)
        self.client.delete(f"/api/membres/{self.membre.pk}")
        r = self.client.get("/api/membres")
        self.assertNotIn(self.membre.pk, [m["id"] for m in r.data])


class MemberPermissionsDetailTests(TestCase):
    """GET /rbac/membres/<id>/permissions : distingue les permissions accordées
    via un rôle de celles accordées directement (IBAC) — cf. RBACView.tsx qui
    en a besoin pour afficher clairement les deux, plutôt qu'une simple liste
    fusionnée où l'origine n'était pas visible."""

    def setUp(self):
        self.client = APIClient()
        self.superadmin = User.objects.create(username="root", is_superuser=True)
        self.p_role = Permission.objects.create(code="fruit.voir", module="fruit")
        self.p_direct = Permission.objects.create(code="fruit.jeter", module="fruit")
        self.p_aucune = Permission.objects.create(code="fruit.manger", module="fruit")
        role = Role.objects.create(code="testeur2")
        role.permissions.add(self.p_role)
        self.membre = User.objects.create(username="cible", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(self.membre, "testeur2")
        grant_permission(self.membre, "fruit.jeter")

    def test_distingue_role_et_direct(self):
        self.client.force_authenticate(self.superadmin)
        r = self.client.get(f"/api/rbac/membres/{self.membre.id}/permissions")
        self.assertEqual(r.status_code, 200)
        by_code = {row["code"]: row for row in r.data}
        self.assertEqual(by_code["fruit.voir"]["source"], "role")
        self.assertTrue(by_code["fruit.voir"]["granted"])
        self.assertEqual(by_code["fruit.jeter"]["source"], "direct")
        self.assertTrue(by_code["fruit.jeter"]["granted"])
        self.assertFalse(by_code["fruit.manger"]["granted"])
        self.assertIsNone(by_code["fruit.manger"]["source"])

    def test_retrait_direct_visible_comme_non_accordee(self):
        revoke_permission(self.membre, "fruit.voir")
        self.client.force_authenticate(self.superadmin)
        r = self.client.get(f"/api/rbac/membres/{self.membre.id}/permissions")
        by_code = {row["code"]: row for row in r.data}
        self.assertFalse(by_code["fruit.voir"]["granted"])
        self.assertEqual(by_code["fruit.voir"]["source"], "direct")

    def test_reserve_au_superadmin(self):
        self.client.force_authenticate(self.membre)
        r = self.client.get(f"/api/rbac/membres/{self.membre.id}/permissions")
        self.assertEqual(r.status_code, 403)


class BootstrapSuperadminTests(TestCase):
    """BF-01 : un superadmin unique est créé automatiquement au démarrage."""

    def test_cree_un_superadmin_si_aucun_n_existe(self):
        call_command("bootstrap_superadmin")
        self.assertEqual(User.objects.filter(attributionrole__role__code="superadmin").count(), 1)

    def test_idempotent_si_deja_present(self):
        call_command("bootstrap_superadmin")
        call_command("bootstrap_superadmin")
        self.assertEqual(User.objects.filter(attributionrole__role__code="superadmin").count(), 1)
