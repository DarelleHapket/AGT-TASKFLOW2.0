# backend/database.py
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
    # Étape 3.1bis (A-04) : ownership des tâches.
    # owner_id = créateur de la tâche. NULL pour les tâches déjà existantes
    # avant cette migration (pas de rattrapage automatique — décision produit :
    # ces tâches restent gérables uniquement par le chef du projet ou l'admin
    # jusqu'à ce qu'un nouveau propriétaire les reprenne naturellement).

    migrations_b3 = [
        ("tasks", "owner_id", "ALTER TABLE tasks ADD COLUMN owner_id INTEGER DEFAULT NULL REFERENCES members(id)"),
    ]

    for table, column, sql in migrations_b1 + migrations_b2 + migrations_b3:
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(member_id, task_id, date),
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
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

    # ── Rattrapage role pour bases déjà initialisées ────────────────────────
    # (si la colonne role vient d'être ajoutée sur une base existante, on la
    #  synchronise avec is_admin : is_admin=1 → 'admin', sinon 'membre')
    c.execute("UPDATE members SET role='admin'  WHERE is_admin=1 AND (role IS NULL OR role='' OR role='membre')")
    c.execute("UPDATE members SET role='membre' WHERE is_admin=0 AND (role IS NULL OR role='')")

    # ── Rattrapage status pour bases déjà initialisées ──────────────────────
    # (comptes existants avant l'ajout de la colonne → considérés actifs)
    c.execute("UPDATE members SET status='active' WHERE status IS NULL OR status=''")

    conn.commit()
    conn.close()