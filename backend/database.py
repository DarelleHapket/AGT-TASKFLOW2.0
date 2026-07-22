# backend/database.py
#
# A-07 — Bloc 6 : table project_members
#   • Rôles par projet : 'owner' | 'manager' | 'contributor'
#   • Seed rattrapage : recrée les entrées depuis les données existantes
#     (chef_id, task owners, responsibles, activity owners) pour que
#     aucune tâche/activité existante ne devienne invisible après la migration.

import sqlite3
import os
import hashlib

DB_PATH = os.environ.get("DB_PATH", "taskflow.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


NEED_TYPES = ["Matériel", "Logiciel", "Humain", "Autre"]
NEED_STATUSES = ["initié", "demandé", "couvert"]


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def init_db():
    conn = get_db()
    c = conn.cursor()

    # ── Tables existantes v1 ────────────────────────────────────────────────

    c.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT ''
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            project_id INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(name, project_id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#6366f1'
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            project_id INTEGER,
            activity_id INTEGER,
            responsible TEXT DEFAULT '',
            duration INTEGER DEFAULT 1,
            status TEXT DEFAULT 'todo',
            priority TEXT DEFAULT 'normale',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP DEFAULT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS task_dependencies (
            task_id TEXT NOT NULL,
            depends_on TEXT NOT NULL,
            PRIMARY KEY (task_id, depends_on),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (depends_on) REFERENCES tasks(id) ON DELETE CASCADE
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS needs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            type TEXT DEFAULT 'Autre',
            status TEXT DEFAULT 'initié',
            project_id INTEGER DEFAULT NULL,
            activity_id INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            project_id INTEGER DEFAULT NULL,
            activity_id INTEGER DEFAULT NULL,
            task_id TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
        )
    """)

    # ── Migrations v2 Bloc 1 — non destructives ─────────────────────────────

    migrations_b1 = [
        ("members", "email",               "ALTER TABLE members ADD COLUMN email TEXT DEFAULT NULL"),
        ("members", "password_hash",       "ALTER TABLE members ADD COLUMN password_hash TEXT DEFAULT NULL"),
        ("members", "is_admin",            "ALTER TABLE members ADD COLUMN is_admin BOOLEAN DEFAULT 0"),
        ("members", "is_active",           "ALTER TABLE members ADD COLUMN is_active BOOLEAN DEFAULT 1"),
        ("members", "daily_coupon_target", "ALTER TABLE members ADD COLUMN daily_coupon_target INTEGER DEFAULT 2"),
        ("members", "role",                "ALTER TABLE members ADD COLUMN role TEXT DEFAULT 'membre'"),
        ("members", "status",              "ALTER TABLE members ADD COLUMN status TEXT DEFAULT 'active'"),
        ("projects", "chef_id",            "ALTER TABLE projects ADD COLUMN chef_id INTEGER DEFAULT NULL REFERENCES members(id)"),
        ("tasks",   "start_date",          "ALTER TABLE tasks ADD COLUMN start_date DATE DEFAULT NULL"),
        ("tasks",   "end_date",            "ALTER TABLE tasks ADD COLUMN end_date DATE DEFAULT NULL"),
        ("tasks",   "due_date",            "ALTER TABLE tasks ADD COLUMN due_date DATE DEFAULT NULL"),
        ("tasks",   "report",              "ALTER TABLE tasks ADD COLUMN report TEXT DEFAULT NULL"),
        ("tasks",   "report_at",           "ALTER TABLE tasks ADD COLUMN report_at TIMESTAMP DEFAULT NULL"),
        ("tasks",   "is_archived",         "ALTER TABLE tasks ADD COLUMN is_archived BOOLEAN DEFAULT 0"),
    ]

    # ── Migrations v2 Bloc 2 — non destructives ─────────────────────────────

    migrations_b2 = [
        ("tasks", "archived_at", "ALTER TABLE tasks ADD COLUMN archived_at TIMESTAMP DEFAULT NULL"),
    ]

    # ── Migrations v2 Bloc 3 — non destructives ─────────────────────────────

    migrations_b3 = [
        ("tasks", "owner_id", "ALTER TABLE tasks ADD COLUMN owner_id INTEGER DEFAULT NULL REFERENCES members(id)"),
    ]

    # ── Migrations v2 Bloc 4 (Poste B) — non destructives ───────────────────

    migrations_b4 = [
        ("daily_task_order", "start_time",   "ALTER TABLE daily_task_order ADD COLUMN start_time TEXT DEFAULT NULL"),
        ("daily_task_order", "duration_min", "ALTER TABLE daily_task_order ADD COLUMN duration_min INTEGER DEFAULT NULL"),
        ("notes",            "member_id",    "ALTER TABLE notes ADD COLUMN member_id INTEGER DEFAULT NULL REFERENCES members(id)"),
    ]

    # ── Migrations v2 Bloc 5 — non destructives ─────────────────────────────

    migrations_b5 = [
        ("activities", "owner_id", "ALTER TABLE activities ADD COLUMN owner_id INTEGER DEFAULT NULL REFERENCES members(id)"),
    ]

    # ── Migrations v2 Bloc 7 (A-08) — Soft delete membres ───────────────────
    # Remplace la suppression physique pour conserver la traçabilité dans
    # project_members et dans l'historique des tâches/activités.
    #   deleted_at IS NULL  → membre actif ou suspendu
    #   deleted_at NOT NULL → compte supprimé (archive, plus jamais connecté)

    migrations_b7 = [
        ("members", "deleted_at", "ALTER TABLE members ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL"),
    ]

    # Blocs 1-3 + 5 + 7 : appliqués avant la création des nouvelles tables
    for table, column, sql in migrations_b1 + migrations_b2 + migrations_b3 + migrations_b5 + migrations_b7:
        try:
            c.execute(sql)
        except Exception:
            pass  # Colonne déjà existante → on ignore

    # ── Nouvelles tables v2 Bloc 1 ───────────────────────────────────────────

    c.execute("""
        CREATE TABLE IF NOT EXISTS task_difficulties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            member_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        )
    """)

    # ── Nouvelles tables v2 Bloc 2 ───────────────────────────────────────────

    c.execute("""
        CREATE TABLE IF NOT EXISTS daily_task_order (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            task_id TEXT NOT NULL,
            date DATE NOT NULL,
            order_index INTEGER NOT NULL,
            note TEXT DEFAULT '',
            start_time TEXT DEFAULT NULL,
            duration_min INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(member_id, task_id, date),
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    """)

    # Bloc 4 rejoué ici (daily_task_order vient d'être créée)
    for table, column, sql in migrations_b4:
        try:
            c.execute(sql)
        except Exception:
            pass

    # ── Notifications (A-06) ─────────────────────────────────────────────────

    c.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient_id INTEGER NOT NULL,
            sender_id INTEGER DEFAULT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT DEFAULT '',
            task_id TEXT DEFAULT NULL,
            read_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (recipient_id) REFERENCES members(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES members(id) ON DELETE SET NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    """)

    # ── Table project_members (A-07 — Bloc 6) ───────────────────────────────
    # Rôles par projet, indépendants du rôle global du membre.
    #   owner       → créateur du projet (1 seul, ne peut pas être retiré)
    #   manager     → promu par l'owner, full edit sur tâches et activités
    #   contributor → défaut à l'ajout, status_only sur les tâches dont il est responsable

    c.execute("""
        CREATE TABLE IF NOT EXISTS project_members (
            project_id  INTEGER NOT NULL,
            member_id   INTEGER NOT NULL,
            role        TEXT    NOT NULL DEFAULT 'contributor'
                        CHECK(role IN ('owner', 'manager', 'contributor')),
            joined_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (project_id, member_id),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (member_id)  REFERENCES members(id)  ON DELETE CASCADE
        )
    """)

    # ── Seed membres par défaut si table vide ───────────────────────────────

    c.execute("SELECT COUNT(*) FROM members")
    if c.fetchone()[0] == 0:
        defaults = [
            ("gabriel", "#6366f1"), ("steven", "#f59e0b"),
            ("stephane", "#10b981"), ("steve", "#ec4899"), ("penka", "#8b5cf6"),
        ]
        c.executemany("INSERT INTO members (name, color) VALUES (?, ?)", defaults)

    # ── Seed Gabriel admin ──────────────────────────────────────────────────

    gabriel = c.execute(
        "SELECT * FROM members WHERE LOWER(name)='gabriel'"
    ).fetchone()

    if gabriel and not gabriel["email"]:
        c.execute(
            """UPDATE members SET
               email='gabriel@ag-technologies.tech',
               password_hash=?,
               is_admin=1,
               is_active=1,
               role='admin',
               status='active'
               WHERE LOWER(name)='gabriel'""",
            (hash_password("AGT2026!"),)
        )

    # ── Seed autres membres ─────────────────────────────────────────────────

    other_members = c.execute(
        "SELECT * FROM members WHERE LOWER(name) != 'gabriel' AND email IS NULL"
    ).fetchall()

    for m in other_members:
        email = f"{m['name'].lower()}@ag-technologies.tech"
        c.execute(
            """UPDATE members SET
               email=?, password_hash=?, is_admin=0, is_active=1, role='membre', status='active'
               WHERE id=?""",
            (email, hash_password("AGT2026!"), m["id"])
        )

    # ── Rattrapage role / status ─────────────────────────────────────────────
    c.execute("UPDATE members SET role='admin'  WHERE is_admin=1 AND (role IS NULL OR role='' OR role='membre')")
    c.execute("UPDATE members SET role='membre' WHERE is_admin=0 AND (role IS NULL OR role='')")
    c.execute("UPDATE members SET status='active' WHERE status IS NULL OR status=''")

    # ── Seed rattrapage project_members (A-07) ───────────────────────────────
    # Garantit qu'aucune donnée existante ne devient invisible après la migration.
    # Exécuté à chaque démarrage (INSERT OR IGNORE = idempotent).

    # 1. Chefs de projet existants → owner
    c.execute("""
        INSERT OR IGNORE INTO project_members (project_id, member_id, role)
        SELECT id, chef_id, 'owner'
        FROM projects
        WHERE chef_id IS NOT NULL
    """)

    # 2. Créateurs de tâches → contributor (si projet défini et membre actif)
    c.execute("""
        INSERT OR IGNORE INTO project_members (project_id, member_id, role)
        SELECT DISTINCT t.project_id, t.owner_id, 'contributor'
        FROM tasks t
        JOIN members m ON m.id = t.owner_id AND m.is_active = 1
        WHERE t.project_id IS NOT NULL AND t.owner_id IS NOT NULL
    """)

    # 3. Responsables de tâches (par nom) → contributor
    c.execute("""
        INSERT OR IGNORE INTO project_members (project_id, member_id, role)
        SELECT DISTINCT t.project_id, m.id, 'contributor'
        FROM tasks t
        JOIN members m ON LOWER(TRIM(m.name)) = LOWER(TRIM(t.responsible))
                       AND m.is_active = 1
        WHERE t.project_id IS NOT NULL
          AND t.responsible IS NOT NULL
          AND t.responsible != ''
    """)

    # 4. Créateurs d'activités → contributor
    c.execute("""
        INSERT OR IGNORE INTO project_members (project_id, member_id, role)
        SELECT DISTINCT a.project_id, a.owner_id, 'contributor'
        FROM activities a
        JOIN members m ON m.id = a.owner_id AND m.is_active = 1
        WHERE a.owner_id IS NOT NULL
    """)

    conn.commit()
    conn.close()
