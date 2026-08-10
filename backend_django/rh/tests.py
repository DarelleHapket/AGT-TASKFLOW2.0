from django.test import TestCase
from rest_framework.test import APIClient

from authentification.models import StatutCompte, User
from authentification.services import assign_role
from finances.models import MouvementFinancier

from .models import (
    Candidat, Competence, Contrat, Employe, Formation, InscriptionFormation, OffreEmploi,
    Periodicite, Poste, Profil, Remuneration, StatutCandidature, StatutInscriptionFormation,
    TypeContrat,
)
from .services import embaucher, terminer_inscription


def make_user(username, role="membre"):
    u = User.objects.create(username=username, statut=StatutCompte.ACTIF, is_active=True)
    assign_role(u, role)
    return u


class ProfilSignalTests(TestCase):
    def test_profil_cree_automatiquement_a_lactivation(self):
        """BF-15 : chaque membre a un profil, créé sans action manuelle."""
        u = make_user("nouveau_membre")
        self.assertTrue(Profil.objects.filter(utilisateur=u).exists())

    def test_pas_de_profil_pour_un_compte_en_attente(self):
        u = User.objects.create(username="en_attente", statut=StatutCompte.EN_ATTENTE, is_active=False)
        self.assertFalse(Profil.objects.filter(utilisateur=u).exists())


class ReferentielPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = make_user("adminrh", "admin")
        self.membre = make_user("membrerh", "membre")

    def test_membre_peut_lire_mais_pas_ecrire_les_competences(self):
        """Le catalogue de compétences est un annuaire (lecture ouverte à
        tout authentifié) — seule l'écriture reste réservée à Admin."""
        self.client.force_authenticate(self.membre)
        r = self.client.get("/api/rh/competences")
        self.assertEqual(r.status_code, 200)
        r = self.client.post("/api/rh/competences", {"nom": "Django"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_membre_na_pas_acces_en_ecriture_aux_postes(self):
        """Postes/équipes/types de contrat restent des données gérées par
        Admin — seule la lecture des compétences a été ouverte."""
        self.client.force_authenticate(self.membre)
        r = self.client.post("/api/rh/postes", {"nom": "Développeur"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_admin_peut_ecrire_le_referentiel(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/rh/competences", {"nom": "Django"}, format="json")
        self.assertEqual(r.status_code, 201)


class EditerProfilTests(TestCase):
    """PATCH /rh/profils/<pk> — assigner un poste/des compétences à un
    membre, jusqu'ici possible seulement à la création via signal (jamais
    modifiable après coup, trou constaté à l'usage)."""

    def setUp(self):
        self.client = APIClient()
        self.admin = make_user("adminprofil", "admin")
        self.membre = make_user("membreprofil", "membre")
        self.profil = Profil.objects.get(utilisateur=self.membre)
        self.poste = Poste.objects.create(nom="Développeur")
        self.competence = Competence.objects.create(nom="Django")

    def test_admin_peut_assigner_poste_et_competences(self):
        self.client.force_authenticate(self.admin)
        r = self.client.patch(
            f"/api/rh/profils/{self.profil.id}",
            {"poste": self.poste.id, "competences": [self.competence.id]},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.profil.refresh_from_db()
        self.assertEqual(self.profil.poste_id, self.poste.id)
        self.assertEqual(list(self.profil.competences.values_list("id", flat=True)), [self.competence.id])

    def test_membre_ne_peut_pas_modifier_un_profil(self):
        self.client.force_authenticate(self.membre)
        r = self.client.patch(
            f"/api/rh/profils/{self.profil.id}", {"poste": self.poste.id}, format="json",
        )
        self.assertEqual(r.status_code, 403)


class AnnuaireProfilsTests(TestCase):
    """Un membre peut consulter le profil (poste/compétences) d'un collègue
    — annuaire, pas une donnée RH sensible — mais pas son salaire."""

    def setUp(self):
        self.client = APIClient()
        self.membre = make_user("annuaire_membre")
        self.collegue = make_user("annuaire_collegue")
        self.profil_collegue = Profil.objects.get(utilisateur=self.collegue)

    def test_membre_peut_lire_le_profil_dun_collegue(self):
        self.client.force_authenticate(self.membre)
        r = self.client.get(f"/api/rh/profils/{self.profil_collegue.id}")
        self.assertEqual(r.status_code, 200)
        r = self.client.get(f"/api/rh/profils/par-utilisateur?utilisateur={self.collegue.id}")
        self.assertEqual(r.status_code, 200)

    def test_membre_ne_voit_pas_le_salaire_dun_collegue(self):
        """salaire_employe reste réservé à rh.employes.gerer, endpoint
        distinct de profil_detail — non exposé par la lecture annuaire."""
        self.client.force_authenticate(self.membre)
        employe = Employe.objects.create(profil=self.profil_collegue, date_embauche="2026-01-01")
        r = self.client.get(f"/api/rh/employes/{employe.id}/salaire")
        self.assertEqual(r.status_code, 403)


class CreerEmployeTests(TestCase):
    """UC « Créer un employé et son contrat » + génération automatique du
    mouvement financier (BF-26), intégration croisée rh/finances."""

    def setUp(self):
        self.client = APIClient()
        self.admin = make_user("adminrh2", "admin")
        self.candidat_user = make_user("futuremploye", "membre")
        self.profil = Profil.objects.get(utilisateur=self.candidat_user)
        self.type_contrat = TypeContrat.objects.create(nom="CDI")

    def test_creation_employe_genere_contrat_remuneration_et_mouvement(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/rh/employes", {
            "profil": self.profil.id, "type_contrat": self.type_contrat.id,
            "date_embauche": "2026-08-01", "montant": "500000",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Contrat.objects.filter(employe_id=r.data["id"]).count(), 1)
        self.assertEqual(Remuneration.objects.filter(contrat__employe_id=r.data["id"]).count(), 1)
        self.assertTrue(MouvementFinancier.objects.filter(employe_id=r.data["id"]).exists())

    def test_membre_ne_peut_pas_creer_un_employe(self):
        self.client.force_authenticate(self.candidat_user)
        r = self.client.post("/api/rh/employes", {
            "profil": self.profil.id, "type_contrat": self.type_contrat.id,
            "date_embauche": "2026-08-01", "montant": "500000",
        }, format="json")
        self.assertEqual(r.status_code, 403)


class MonSalaireTests(TestCase):
    """BNF-09 révisé : l'accès à son propre salaire est toujours permis,
    indépendamment des permissions RH générales."""

    def setUp(self):
        self.client = APIClient()
        self.membre = make_user("employemembre", "membre")
        profil = Profil.objects.get(utilisateur=self.membre)
        type_contrat = TypeContrat.objects.create(nom="CDI")
        from .models import Employe
        employe = Employe.objects.create(profil=profil, date_embauche="2026-01-01")
        contrat = Contrat.objects.create(employe=employe, type_contrat=type_contrat, date_debut="2026-01-01")
        Remuneration.objects.create(contrat=contrat, montant=300000, periodicite=Periodicite.MENSUELLE)

    def test_employe_voit_son_propre_salaire_sans_permission_rh(self):
        self.client.force_authenticate(self.membre)
        r = self.client.get("/api/rh/employes/moi/salaire")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["contrats"][0]["remunerations"]), 1)

    def test_autre_membre_sans_employe_recoit_404(self):
        autre = make_user("sansemploye", "membre")
        self.client.force_authenticate(autre)
        r = self.client.get("/api/rh/employes/moi/salaire")
        self.assertEqual(r.status_code, 404)


class RecrutementTests(TestCase):
    """BF-49 / BNF-17 : une candidature retenue crée compte, profil, employé
    et contrat en une seule transaction, sans ressaisie."""

    def setUp(self):
        self.poste = Poste.objects.create(nom="Développeur")
        self.offre = OffreEmploi.objects.create(poste=self.poste, description="Poste ouvert")
        self.candidat = Candidat.objects.create(
            offre=self.offre, nom="Josué Test", contact="josue@example.com", statut=StatutCandidature.ENTRETIEN
        )

    def test_embaucher_refuse_si_candidat_pas_retenue(self):
        with self.assertRaises(ValueError):
            embaucher(self.candidat)

    def test_embaucher_cree_compte_profil_employe_contrat_et_mouvement(self):
        self.candidat.statut = StatutCandidature.RETENUE
        self.candidat.save()
        employe, temp_password = embaucher(self.candidat)

        self.assertTrue(User.objects.filter(email="josue@example.com").exists())
        self.assertTrue(temp_password)
        self.assertEqual(employe.profil.poste, self.poste)
        self.assertEqual(employe.contrats.count(), 1)
        self.assertEqual(employe.contrats.first().remunerations.count(), 1)
        self.assertTrue(MouvementFinancier.objects.filter(employe=employe).exists())
        user = User.objects.get(email="josue@example.com")
        self.assertTrue(user.doit_changer_mdp)

    def test_endpoint_patch_statut_retenue_declenche_embauche(self):
        client = APIClient()
        admin = make_user("adminrecrut", "admin")
        client.force_authenticate(admin)
        r = client.put(f"/api/rh/candidats/{self.candidat.id}", {
            "offre": self.offre.id, "nom": self.candidat.nom, "contact": self.candidat.contact,
            "statut": "retenue",
        }, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(User.objects.filter(email="josue@example.com").exists())


class FormationTests(TestCase):
    """BF-52 : une formation terminée ajoute automatiquement les compétences
    visées au profil."""

    def setUp(self):
        from .models import Employe
        self.membre = make_user("stagiaireformation", "membre")
        profil = Profil.objects.get(utilisateur=self.membre)
        self.employe = Employe.objects.create(profil=profil, date_embauche="2026-01-01")
        self.competence = Competence.objects.create(nom="React")
        self.formation = Formation.objects.create(nom="Formation React")
        self.formation.competences_visees.add(self.competence)
        self.inscription = InscriptionFormation.objects.create(
            employe=self.employe, formation=self.formation, statut=StatutInscriptionFormation.EN_COURS
        )

    def test_terminer_inscription_ajoute_les_competences(self):
        terminer_inscription(self.inscription)
        self.inscription.refresh_from_db()
        self.assertEqual(self.inscription.statut, StatutInscriptionFormation.TERMINEE)
        self.assertIn(self.competence, self.employe.profil.competences.all())


class SignalementVisibiliteTests(TestCase):
    """BNF-18 : un signalement n'est visible que par Admin et Superadmin."""

    def setUp(self):
        self.client = APIClient()
        self.membre = make_user("signalant", "membre")
        self.admin = make_user("admintraite", "admin")

    def test_membre_peut_creer_mais_pas_lister(self):
        self.client.force_authenticate(self.membre)
        r = self.client.post("/api/rh/signalements", {"description": "Différend avec un collègue"}, format="json")
        self.assertEqual(r.status_code, 201)
        r = self.client.get("/api/rh/signalements")
        self.assertEqual(r.status_code, 403)

    def test_admin_peut_lister_et_traiter(self):
        self.client.force_authenticate(self.membre)
        r = self.client.post("/api/rh/signalements", {"description": "Différend"}, format="json")
        signalement_id = r.data["id"]
        self.client.force_authenticate(self.admin)
        r = self.client.get("/api/rh/signalements")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        r = self.client.patch(f"/api/rh/signalements/{signalement_id}", {"statut": "traite"}, format="json")
        self.assertEqual(r.status_code, 200)
