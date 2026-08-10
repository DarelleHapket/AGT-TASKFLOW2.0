"""Migration ponctuelle SQLite (AGT TaskFlow Flask) -> Postgres (Django ORM).

Usage :
    python manage.py migrate_from_sqlite --source /chemin/vers/taskflow.db
    python manage.py migrate_from_sqlite --source ... --commit   # écrit réellement

Par défaut le script tourne en DRY-RUN (aucune écriture, juste un rapport de
ce qui SERAIT migré) — --commit est requis explicitement pour écrire, comme
convenu dans le plan de migration (aucune coupure avant cutover confirmé).

Principes :
  - Les PK numériques (members.id, projects.id, activities.id) sont
    préservées telles quelles côté Django pour que les FK restent cohérentes
    sans table de correspondance. tasks.id (texte libre) est conservé tel
    quel (CharField PK côté Django, voir projets.models.Tache).
  - Mots de passe : les hashes SHA-256 non salés de Flask ne sont PAS
    compatibles avec les hashers Django (BNF sécurité). Chaque compte migré
    reçoit un mot de passe temporaire aléatoire + doit_changer_mdp=True ; la
    liste (email -> mot de passe temporaire) est écrite dans le fichier passé
    à --rapport-mdp, à communiquer hors-bande puis à supprimer.
  - Le schéma source a évolué au fil du projet (RBAC/notifications ajoutés en
    cours de route) : chaque table est lue seulement si elle existe encore
    dans la base source (introspection via sqlite_master / PRAGMA), pour
    fonctionner aussi bien sur un export récent que sur un ancien.
"""
import secrets
import sqlite3
from pathlib import Path

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from authentification.models import PermissionEffective, StatutCompte, User
from authentification.services import assign_role
from notifications.models import Notification
from operations.models import Besoin, Note, OrdreJournalier
from projets.models import Activite, Difficulte, MembreProjet, Projet, Tache

STATUT_MAP = {
    "pending": StatutCompte.EN_ATTENTE,
    "active": StatutCompte.ACTIF,
    "suspended": StatutCompte.SUSPENDU,
    "rejected": StatutCompte.SUPPRIME,
    "deleted": StatutCompte.SUPPRIME,
}


def _sqlite_dict_conn(path):
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def _table_exists(conn, name):
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone() is not None


def _columns(conn, table):
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


class Command(BaseCommand):
    help = "Migre les données de l'ancien AGT TaskFlow (Flask/SQLite) vers Django/Postgres."

    def add_arguments(self, parser):
        parser.add_argument("--source", required=True, help="Chemin vers le fichier .db SQLite source")
        parser.add_argument("--commit", action="store_true", help="Écrit réellement (sinon dry-run)")
        parser.add_argument("--rapport-mdp", default="mots_de_passe_temporaires.txt",
                             help="Fichier où écrire les mots de passe temporaires générés")

    def handle(self, *args, **opts):
        source = Path(opts["source"])
        if not source.exists():
            raise CommandError(f"Fichier introuvable : {source}")

        conn = _sqlite_dict_conn(str(source))
        commit = opts["commit"]
        counts = {}
        mdp_temp = []

        self.stdout.write(self.style.WARNING("DRY-RUN (rien n'est écrit)" if not commit else "COMMIT — écriture réelle"))

        with transaction.atomic():
            self._migrate_members(conn, counts, mdp_temp)
            self._migrate_projects(conn, counts)
            self._migrate_project_members(conn, counts)
            self._migrate_activities(conn, counts)
            self._migrate_tasks(conn, counts)
            self._migrate_task_dependencies(conn, counts)
            self._migrate_task_difficulties(conn, counts)
            self._migrate_notifications(conn, counts)
            self._migrate_needs(conn, counts)
            self._migrate_notes(conn, counts)
            self._migrate_daily_order(conn, counts)

            if not commit:
                transaction.set_rollback(True)

        conn.close()

        self.stdout.write(self.style.SUCCESS("\nRésumé :"))
        for label, n in counts.items():
            self.stdout.write(f"  {label} : {n}")

        if commit and mdp_temp:
            rapport = Path(opts["rapport_mdp"])
            rapport.write_text(
                "email;mot_de_passe_temporaire\n" + "\n".join(f"{e};{p}" for e, p in mdp_temp), encoding="utf-8"
            )
            self.stdout.write(self.style.WARNING(
                f"\n{len(mdp_temp)} mot(s) de passe temporaire(s) écrit(s) dans {rapport} — "
                "à communiquer hors-bande puis à SUPPRIMER ce fichier."
            ))
        elif not commit:
            self.stdout.write(self.style.WARNING("\nDry-run : relancer avec --commit pour écrire réellement."))

    # ── Membres ──────────────────────────────────────────────────────────

    def _migrate_members(self, conn, counts, mdp_temp):
        cols = _columns(conn, "members")
        has_deleted_at = "deleted_at" in cols
        rows = conn.execute("SELECT * FROM members").fetchall()
        n = 0
        for r in rows:
            row = dict(r)
            statut = STATUT_MAP.get(row.get("status"), StatutCompte.ACTIF)
            if has_deleted_at and row.get("deleted_at"):
                statut = StatutCompte.SUPPRIME

            temp_password = secrets.token_urlsafe(9)
            email_prefix = (row["email"] or f"membre{row['id']}").split("@")[0]
            user = User(
                id=row["id"],
                username=f"{email_prefix}-{row['id']}",
                email=row.get("email") or "",
                first_name=row.get("name") or "",
                password=make_password(temp_password),
                is_active=(statut == StatutCompte.ACTIF),
                is_superuser=False,
                statut=statut,
                doit_changer_mdp=True,
                color=row.get("color") or "#6366f1",
                deleted_at=parse_datetime(row["deleted_at"]) if has_deleted_at and row.get("deleted_at") else None,
            )
            user.save()
            mdp_temp.append((user.email, temp_password))

            # Rôle : is_admin=1 -> 'admin' (prioritaire), sinon la colonne
            # legacy 'role' si elle correspond à un rôle connu.
            if row.get("is_admin"):
                assign_role(user, "admin")
            elif row.get("role") in ("membre", "chef_projet", "superadmin"):
                assign_role(user, row["role"])
            else:
                assign_role(user, "membre")
            n += 1
        counts["Membres -> Utilisateurs"] = n

    # ── Projets ──────────────────────────────────────────────────────────

    def _migrate_projects(self, conn, counts):
        rows = conn.execute("SELECT * FROM projects").fetchall()
        for r in rows:
            row = dict(r)
            Projet.objects.create(id=row["id"], nom=row["name"], description=row.get("description") or "")
        counts["Projets"] = len(rows)

    def _migrate_project_members(self, conn, counts):
        n = 0
        if _table_exists(conn, "project_members"):
            rows = conn.execute("SELECT * FROM project_members").fetchall()
            for r in rows:
                row = dict(r)
                if not User.objects.filter(pk=row["member_id"]).exists():
                    continue
                MembreProjet.objects.get_or_create(
                    projet_id=row["project_id"], utilisateur_id=row["member_id"],
                    defaults={"role": row["role"]},
                )
                n += 1
        else:
            # Pas de table project_members dans une base source ancienne :
            # rattrapage depuis projects.chef_id (même logique que le
            # "seed rattrapage" documenté côté Flask, database.py).
            rows = conn.execute("SELECT id, chef_id FROM projects WHERE chef_id IS NOT NULL").fetchall()
            for r in rows:
                row = dict(r)
                if not User.objects.filter(pk=row["chef_id"]).exists():
                    continue
                MembreProjet.objects.get_or_create(
                    projet_id=row["id"], utilisateur_id=row["chef_id"], defaults={"role": "owner"},
                )
                n += 1
        counts["Membres de projet"] = n

    # ── Activités ────────────────────────────────────────────────────────

    def _migrate_activities(self, conn, counts):
        rows = conn.execute("SELECT * FROM activities").fetchall()
        n = 0
        for r in rows:
            row = dict(r)
            owner_id = row.get("owner_id")
            Activite.objects.create(
                id=row["id"], nom=row["name"], description=row.get("description") or "",
                projet_id=row["project_id"],
                createur_id=owner_id if owner_id and User.objects.filter(pk=owner_id).exists() else None,
            )
            n += 1
        counts["Activités"] = n

    # ── Tâches ───────────────────────────────────────────────────────────

    def _migrate_tasks(self, conn, counts):
        members_by_name = {
            (row["name"] or "").strip().lower(): row["id"]
            for row in conn.execute("SELECT id, name FROM members")
        }
        rows = conn.execute("SELECT * FROM tasks").fetchall()
        n = 0
        for r in rows:
            row = dict(r)
            responsable_id = members_by_name.get((row.get("responsible") or "").strip().lower())
            owner_id = row.get("owner_id")
            # SQLite stocke parfois une chaîne vide plutôt que NULL pour les
            # dates optionnelles — Django rejette "" comme DateField.
            start_date = row.get("start_date") or None
            end_date = row.get("end_date") or None
            due_date = row.get("due_date") or None
            Tache.objects.create(
                id=row["id"], description=row["description"] or "",
                projet_id=row.get("project_id"), activite_id=row.get("activity_id"),
                responsable_id=responsable_id if responsable_id and User.objects.filter(pk=responsable_id).exists() else None,
                createur_id=owner_id if owner_id and User.objects.filter(pk=owner_id).exists() else None,
                duree=row.get("duration") or 1,
                statut=row.get("status") or "todo",
                priorite=row.get("priority") or "normale",
                date_completion=parse_datetime(row["completed_at"]) if row.get("completed_at") else None,
                date_debut=start_date, date_fin=end_date, date_echeance=due_date,
                est_archivee=bool(row.get("is_archived")),
                archivee_le=parse_datetime(row["archived_at"]) if row.get("archived_at") else None,
            )
            n += 1
        counts["Tâches"] = n

    def _migrate_task_dependencies(self, conn, counts):
        if not _table_exists(conn, "task_dependencies"):
            counts["Dépendances de tâches"] = 0
            return
        rows = conn.execute("SELECT * FROM task_dependencies").fetchall()
        n = 0
        for r in rows:
            row = dict(r)
            try:
                tache = Tache.objects.get(pk=row["task_id"])
                tache.dependances.add(row["depends_on"])
                n += 1
            except Tache.DoesNotExist:
                continue
        counts["Dépendances de tâches"] = n

    def _migrate_task_difficulties(self, conn, counts):
        if not _table_exists(conn, "task_difficulties"):
            counts["Difficultés"] = 0
            return
        rows = conn.execute("SELECT * FROM task_difficulties").fetchall()
        n = 0
        for r in rows:
            row = dict(r)
            if not Tache.objects.filter(pk=row["task_id"]).exists():
                continue
            if not User.objects.filter(pk=row["member_id"]).exists():
                continue
            Difficulte.objects.create(
                tache_id=row["task_id"], membre_id=row["member_id"], contenu=row["content"],
            )
            n += 1
        counts["Difficultés"] = n

    # ── Notifications ────────────────────────────────────────────────────

    def _migrate_notifications(self, conn, counts):
        if not _table_exists(conn, "notifications"):
            counts["Notifications"] = 0
            return
        rows = conn.execute("SELECT * FROM notifications").fetchall()
        n = 0
        for r in rows:
            row = dict(r)
            if not User.objects.filter(pk=row["recipient_id"]).exists():
                continue
            sender_id = row.get("sender_id")
            Notification.objects.create(
                destinataire_id=row["recipient_id"],
                expediteur_id=sender_id if sender_id and User.objects.filter(pk=sender_id).exists() else None,
                type=row.get("type") or "", titre=row.get("title") or "", corps=row.get("body") or "",
                tache_id=row.get("task_id"),
                lu_le=parse_datetime(row["read_at"]) if row.get("read_at") else None,
            )
            n += 1
        counts["Notifications"] = n

    # ── Besoins / Notes / Ordre journalier ──────────────────────────────

    def _migrate_needs(self, conn, counts):
        if not _table_exists(conn, "needs"):
            counts["Besoins"] = 0
            return
        rows = conn.execute("SELECT * FROM needs").fetchall()
        for r in rows:
            row = dict(r)
            Besoin.objects.create(
                titre=row["title"], description=row.get("description") or "",
                type=row.get("type") or "Autre", statut=row.get("status") or "initié",
                projet_id=row.get("project_id"), activite_id=row.get("activity_id"),
            )
        counts["Besoins"] = len(rows)

    def _migrate_notes(self, conn, counts):
        if not _table_exists(conn, "notes"):
            counts["Notes"] = 0
            return
        cols = _columns(conn, "notes")
        rows = conn.execute("SELECT * FROM notes").fetchall()
        n = 0
        for r in rows:
            row = dict(r)
            auteur_id = row.get("member_id") if "member_id" in cols else None
            Note.objects.create(
                titre=row["title"], contenu=row.get("content") or "",
                projet_id=row.get("project_id"), activite_id=row.get("activity_id"), tache_id=row.get("task_id"),
                auteur_id=auteur_id if auteur_id and User.objects.filter(pk=auteur_id).exists() else None,
            )
            n += 1
        counts["Notes"] = n

    def _migrate_daily_order(self, conn, counts):
        if not _table_exists(conn, "daily_task_order"):
            counts["Ordre journalier"] = 0
            return
        rows = conn.execute("SELECT * FROM daily_task_order").fetchall()
        n = 0
        for r in rows:
            row = dict(r)
            if not (User.objects.filter(pk=row["member_id"]).exists() and Tache.objects.filter(pk=row["task_id"]).exists()):
                continue
            OrdreJournalier.objects.create(
                membre_id=row["member_id"], tache_id=row["task_id"], date=row["date"],
                ordre=row.get("order_index") or 0, note=row.get("note") or "",
                heure_debut=row.get("start_time"), duree_min=row.get("duration_min"),
            )
            n += 1
        counts["Ordre journalier"] = n
