import shutil
import sqlite3
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from authentification.models import StatutCompte, User
from authentification.services import assign_role
from projets.models import Difficulte, Projet, Tache


def make_user(username, role="user"):
    u = User.objects.create(username=username, statut=StatutCompte.ACTIF, is_active=True)
    assign_role(u, role)
    return u


class BackupApiTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.override = override_settings(BACKUP_DIR=self.tmp)
        self.override.enable()
        self.superadmin = make_user("gabriel", "superadmin")
        self.membre = make_user("darelle", "user")
        self.client = APIClient()

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_membre_ne_peut_pas_lister_les_sauvegardes(self):
        self.client.force_authenticate(self.membre)
        r = self.client.get("/api/admin/backups")
        self.assertEqual(r.status_code, 403)

    def test_superadmin_cree_et_liste_une_sauvegarde(self):
        self.client.force_authenticate(self.superadmin)
        r = self.client.post("/api/admin/backups/creer")
        self.assertEqual(r.status_code, 201)
        r2 = self.client.get("/api/admin/backups")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(len(r2.data["backups"]), 1)

    def test_import_refuse_sans_confirmation_exacte(self):
        self.client.force_authenticate(self.superadmin)
        r = self.client.post("/api/admin/backups/importer", {"confirmation": "oui"}, format="multipart")
        self.assertEqual(r.status_code, 400)


def make_legacy_sqlite(path):
    """Construit une base SQLite au format Flask (schéma minimal) pour tester
    la commande migrate_from_sqlite sans dépendre d'un vrai export."""
    conn = sqlite3.connect(path)
    conn.executescript("""
        CREATE TABLE members (
            id INTEGER PRIMARY KEY, name TEXT, color TEXT, email TEXT,
            password_hash TEXT, is_admin INTEGER, is_active INTEGER,
            daily_coupon_target INTEGER, role TEXT, status TEXT
        );
        CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT, description TEXT, chef_id INTEGER);
        CREATE TABLE activities (id INTEGER PRIMARY KEY, name TEXT, description TEXT, project_id INTEGER, owner_id INTEGER);
        CREATE TABLE tasks (
            id TEXT PRIMARY KEY, description TEXT, project_id INTEGER, activity_id INTEGER,
            responsible TEXT, duration INTEGER, status TEXT, priority TEXT,
            created_at TEXT, completed_at TEXT, start_date TEXT, end_date TEXT, due_date TEXT,
            report TEXT, report_at TEXT, is_archived INTEGER, archived_at TEXT, owner_id INTEGER
        );
        CREATE TABLE task_dependencies (task_id TEXT, depends_on TEXT);
        CREATE TABLE task_difficulties (id INTEGER PRIMARY KEY, task_id TEXT, member_id INTEGER, content TEXT, created_at TEXT);
    """)
    conn.execute("INSERT INTO members VALUES (1,'Gabriel','#fff','gabriel@x.com','hash',1,1,4,'admin','active')")
    conn.execute("INSERT INTO members VALUES (2,'Darelle','#000','darelle@x.com','hash',0,1,4,'chef_projet','active')")
    conn.execute("INSERT INTO projects VALUES (1,'ERP','desc',2)")
    conn.execute("INSERT INTO activities VALUES (1,'Analyse','',1,2)")
    conn.execute("INSERT INTO tasks VALUES ('T1','Tache A',1,1,'Darelle',2,'todo','medium',NULL,NULL,'','','',NULL,NULL,0,NULL,2)")
    conn.execute("INSERT INTO tasks VALUES ('T2','Tache B',1,1,'Darelle',1,'todo','medium',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,2)")
    conn.execute("INSERT INTO task_dependencies VALUES ('T2','T1')")
    conn.execute("INSERT INTO task_difficulties VALUES (1,'T1',2,'bloqué par X',NULL)")
    conn.commit()
    conn.close()


class MigrateFromSqliteTests(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.source = str(Path(self.tmpdir) / "legacy.db")
        make_legacy_sqlite(self.source)

    def tearDown(self):
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_dry_run_n_ecrit_rien(self):
        call_command("migrate_from_sqlite", source=self.source)
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(Projet.objects.count(), 0)

    def test_commit_migre_toutes_les_donnees(self):
        rapport = str(Path(self.tmpdir) / "mdp.txt")
        call_command("migrate_from_sqlite", source=self.source, commit=True, rapport_mdp=rapport)

        self.assertEqual(User.objects.count(), 2)
        gabriel = User.objects.get(pk=1)
        darelle = User.objects.get(pk=2)
        # Catalogue réduit à 2 rôles (2026-08-19) : "admin"/"chef_projet"
        # legacy n'existent plus comme rôles — les deux comptes obtiennent le
        # rôle "user" avec les permissions équivalentes accordées en direct
        # (cf. migrate_from_sqlite.py::PERMISSIONS_LEGACY_ADMIN/_CHEF_PROJET).
        self.assertIn("user", gabriel.roles_codes())
        self.assertTrue(gabriel.peut("membres.validate"))
        self.assertIn("user", darelle.roles_codes())
        self.assertTrue(darelle.peut("projets.write"))
        self.assertTrue(gabriel.doit_changer_mdp)
        # Mot de passe legacy (SHA-256 non salé) non conservé tel quel :
        # un nouveau hash Django (compatible) a été généré.
        self.assertNotEqual(gabriel.password, "hash")

        self.assertEqual(Projet.objects.count(), 1)
        t1 = Tache.objects.get(pk="T1")
        t2 = Tache.objects.get(pk="T2")
        self.assertEqual(t1.responsable_id, darelle.id)  # résolu par nom (Darelle)
        self.assertIn(t1, t2.dependances.all())
        self.assertEqual(Difficulte.objects.filter(tache=t1).count(), 1)
        self.assertTrue(Path(rapport).exists())

    def test_dates_vides_ne_font_pas_echouer(self):
        """Une chaîne vide en base SQLite (au lieu de NULL) sur une date
        optionnelle ne doit pas faire planter la migration."""
        call_command("migrate_from_sqlite", source=self.source, commit=True,
                     rapport_mdp=str(Path(self.tmpdir) / "mdp.txt"))
        t1 = Tache.objects.get(pk="T1")
        self.assertIsNone(t1.date_debut)
