"""Tests RBAC + IBAC, cycle de vie du compte, et non-régression des bugs
BUG-01/BUG-02 déjà corrigés côté Flask (cf. RBAC.md et rapports de session)."""
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Permission, PermissionEffective, Role, StatutCompte, User
from .services import assign_role, grant_permission, revoke_permission, revoke_role


class UpdateMeTests(TestCase):
    """PATCH /auth/me — tout membre peut modifier son propre nom affiché
    après inscription, sans permission RBAC particulière."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create(username="modif", email="modif@agt.test",
                                         first_name="Ancien", statut=StatutCompte.ACTIF, is_active=True)

    def test_modifier_son_propre_nom(self):
        self.client.force_authenticate(self.user)
        r = self.client.patch("/api/auth/me", {"first_name": "Nouveau"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Nouveau")

    def test_nom_vide_refuse(self):
        self.client.force_authenticate(self.user)
        r = self.client.patch("/api/auth/me", {"first_name": "   "}, format="json")
        self.assertEqual(r.status_code, 400)


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
        assign_role(self.admin, "user")
        grant_permission(self.admin, "membres.validate")
        self.membre = User.objects.create(username="darelle", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(self.membre, "user")

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
        self.assertIn("user", demandeur.roles_codes())

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
        legacy Flask où members.role et member_roles pouvaient diverger).
        Rôle "chef_projet" (2026-08-19, catalogue réduit à 2 rôles) remplacé
        par un rôle personnalisé équivalent portant la même permission."""
        role_projet = Role.objects.create(code="gestion_projet")
        role_projet.permissions.add(Permission.objects.get(code="projets.write"))
        chef = User.objects.create(username="josue", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(chef, "gestion_projet")
        self.assertTrue(chef.peut("projets.write"))
        revoke_role(chef, "gestion_projet")
        self.assertNotIn("gestion_projet", chef.roles_codes())
        assign_role(chef, "gestion_projet")
        self.assertIn("gestion_projet", chef.roles_codes())
        self.assertTrue(chef.peut("projets.write"))


class RoleAdminUniqueTests(TestCase):
    """Décision produit du 2026-08-24 : le rôle "admin" (personnalisé, créé
    via /rbac) est unique, un seul titulaire à la fois — comme "superadmin",
    mais uniquement pour ce rôle précis, pas les autres rôles personnalisés."""

    def setUp(self):
        self.client = APIClient()
        self.superadmin = User.objects.create(username="rootadmin", is_superuser=True)
        self.client.force_authenticate(self.superadmin)
        Role.objects.create(code="admin")
        self.premier = User.objects.create(username="premieradmin", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(self.premier, "user")
        assign_role(self.premier, "admin")
        self.second = User.objects.create(username="secondadmin", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(self.second, "user")

    def test_attribution_admin_a_un_deuxieme_titulaire_refusee(self):
        r = self.client.post(f"/api/rbac/membres/{self.second.id}/roles", {"role": "admin"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.second.refresh_from_db()
        self.assertNotIn("admin", self.second.roles_codes())

    def test_reattribution_au_meme_titulaire_ne_pose_pas_probleme(self):
        """Idempotence : réattribuer "admin" à celui qui l'a déjà ne doit pas
        être bloqué par la contrainte d'unicité."""
        r = self.client.post(f"/api/rbac/membres/{self.premier.id}/roles", {"role": "admin"}, format="json")
        self.assertEqual(r.status_code, 201)

    def test_apres_retrait_admin_redevient_attribuable(self):
        revoke_role(self.premier, "admin")
        r = self.client.post(f"/api/rbac/membres/{self.second.id}/roles", {"role": "admin"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.second.refresh_from_db()
        self.assertIn("admin", self.second.roles_codes())

    def test_autres_roles_personnalises_restent_cumulables(self):
        Role.objects.create(code="comptable")
        r1 = self.client.post(f"/api/rbac/membres/{self.premier.id}/roles", {"role": "comptable"}, format="json")
        r2 = self.client.post(f"/api/rbac/membres/{self.second.id}/roles", {"role": "comptable"}, format="json")
        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r2.status_code, 201)


class DeletedMembersHistoryTests(TestCase):
    """Historique des comptes supprimés (A-08, Flask) — port de GET /members/deleted,
    manquant lors de la première migration (TeamView.jsx en avait besoin pour sa
    section "Comptes supprimés")."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create(username="admin2", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(self.admin, "user")
        grant_permission(self.admin, "membres.read")
        grant_permission(self.admin, "membres.write")
        self.membre = User.objects.create(username="cible2", statut=StatutCompte.ACTIF, is_active=True)
        assign_role(self.membre, "user")

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
