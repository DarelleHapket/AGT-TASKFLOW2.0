# backend/routes/projects.py
#
# A-03 — Corrections ownership + chef_name dans GET
# A-06 — Fix old_chef NameError dans delete_project
# A-07 — Intégration project_members :
#   • GET /          → + member_count + user_role (rôle du user connecté dans chaque projet)
#   • POST /         → auto-insère l'owner dans project_members
#   • PUT /<id>      → guard ownership via project_members ('owner') au lieu de chef_id
#   • DELETE /<id>   → idem
#   • PUT /<id>/chef → synchro project_members (ancien owner → contributor, nouveau → owner)

from flask import Blueprint, request, jsonify
from functools import wraps
from database import get_db
from utils.auth import require_role, require_auth, get_current_user
from utils.permissions import get_project_role

projects_bp = Blueprint("projects", __name__)

_ADMIN_READ_ONLY  = "L'administrateur dispose d'un accès en lecture seule sur les projets."
_NOT_YOUR_PROJECT = "Vous n'êtes pas le propriétaire de ce projet."
_PROJECT_NOT_FOUND = "Projet introuvable."


def require_chef_only(f):
    """Écriture projet réservée au Chef de projet global (CdC : l'admin est en lecture seule)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user, error = get_current_user()
        if error:
            return jsonify({"error": error}), 401
        role = user.get("role") or ("admin" if user.get("is_admin") else "membre")
        if role != "chef_projet":
            return jsonify({"error": "Réservé au chef de projet"}), 403
        return f(*args, current_user=user, **kwargs)
    return decorated


# ── Helpers internes ─────────────────────────────────────────────────────────

def _fetch_project(conn, pid):
    """Retourne un projet avec chef_name + member_count."""
    return conn.execute("""
        SELECT p.*,
               m.name AS chef_name,
               COUNT(DISTINCT pm.member_id) AS member_count
        FROM projects p
        LEFT JOIN members m ON p.chef_id = m.id
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.id = ?
        GROUP BY p.id
    """, (pid,)).fetchone()


def _is_project_owner(conn, user_id, project_id):
    """Vérifie que l'utilisateur est owner du projet dans project_members."""
    role = get_project_role(conn, user_id, project_id)
    return role == "owner"


def _demote_if_orphan(conn, member_id):
    """
    Repasse un membre en 'membre' s'il n'est plus chef (owner) d'aucun projet.
    Ne touche jamais un admin.
    """
    if member_id is None:
        return
    m = conn.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone()
    if not m or dict(m).get("is_admin"):
        return
    still_owner = conn.execute(
        "SELECT COUNT(*) FROM project_members WHERE member_id = ? AND role = 'owner'",
        (member_id,)
    ).fetchone()[0]
    if still_owner == 0:
        conn.execute(
            "UPDATE members SET role = 'membre' WHERE id = ? AND role = 'chef_projet'",
            (member_id,)
        )


# ── GET /api/projects/ ───────────────────────────────────────────────────────
# Retourne tous les projets avec :
#   chef_name    — nom du chef (LEFT JOIN)
#   member_count — nombre de membres dans project_members
#   user_role    — rôle du membre connecté dans ce projet (ou null)

@projects_bp.route("/", methods=["GET"])
@require_auth
def list_projects(current_user):
    conn = get_db()
    rows = conn.execute("""
        SELECT p.*,
               m.name AS chef_name,
               COUNT(DISTINCT pm.member_id) AS member_count
        FROM projects p
        LEFT JOIN members m ON p.chef_id = m.id
        LEFT JOIN project_members pm ON p.id = pm.project_id
        GROUP BY p.id
        ORDER BY p.name COLLATE NOCASE
    """).fetchall()

    projects = []
    for row in rows:
        proj = dict(row)
        # Rôle du user connecté dans ce projet (admin = pas de rôle projet)
        proj["user_role"] = None if current_user.get("is_admin") else get_project_role(
            conn, current_user["id"], proj["id"]
        )
        projects.append(proj)

    conn.close()
    return jsonify(projects)


# ── POST /api/projects/ ──────────────────────────────────────────────────────
# Réservé au chef_projet global. Le créateur devient automatiquement 'owner'
# dans project_members.

@projects_bp.route("/", methods=["POST"])
@require_chef_only
def create_project(current_user):
    data        = request.get_json()
    name        = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()

    if not name:
        return jsonify({"error": "Le nom du projet est obligatoire."}), 400

    conn = get_db()
    try:
        c = conn.execute(
            "INSERT INTO projects (name, description, chef_id) VALUES (?, ?, ?)",
            (name, description, current_user["id"])
        )
        new_id = c.lastrowid

        # Insère automatiquement le créateur comme owner dans project_members
        conn.execute(
            "INSERT OR IGNORE INTO project_members (project_id, member_id, role) VALUES (?, ?, 'owner')",
            (new_id, current_user["id"])
        )
        conn.commit()

        row = _fetch_project(conn, new_id)
        result = dict(row)
        result["user_role"] = "owner"
        result["member_count"] = 1
        conn.close()
        return jsonify(result), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


# ── PUT /api/projects/<id> ───────────────────────────────────────────────────
# Réservé à l'owner du projet dans project_members.

@projects_bp.route("/<int:pid>", methods=["PUT"])
@require_auth
def update_project(pid, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    conn = get_db()
    project = conn.execute("SELECT id FROM projects WHERE id = ?", (pid,)).fetchone()
    if not project:
        conn.close()
        return jsonify({"error": _PROJECT_NOT_FOUND}), 404

    if not _is_project_owner(conn, current_user["id"], pid):
        conn.close()
        return jsonify({"error": _NOT_YOUR_PROJECT}), 403

    data        = request.get_json() or {}
    name        = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()

    if not name:
        conn.close()
        return jsonify({"error": "Le nom du projet est obligatoire."}), 400

    conn.execute(
        "UPDATE projects SET name = ?, description = ? WHERE id = ?",
        (name, description, pid)
    )
    conn.commit()
    row = _fetch_project(conn, pid)
    result = dict(row) if row else None
    if result:
        result["user_role"] = "owner"
    conn.close()
    return jsonify(result) if result else (jsonify({"error": _PROJECT_NOT_FOUND}), 404)


# ── DELETE /api/projects/<id> ────────────────────────────────────────────────
# Réservé à l'owner du projet dans project_members.

@projects_bp.route("/<int:pid>", methods=["DELETE"])
@require_auth
def delete_project(pid, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
    if not project:
        conn.close()
        return jsonify({"error": _PROJECT_NOT_FOUND}), 404

    if not _is_project_owner(conn, current_user["id"], pid):
        conn.close()
        return jsonify({"error": _NOT_YOUR_PROJECT}), 403

    old_chef = dict(project).get("chef_id")
    conn.execute("DELETE FROM projects WHERE id = ?", (pid,))
    # project_members supprimés par ON DELETE CASCADE
    _demote_if_orphan(conn, old_chef)
    conn.commit()
    conn.close()
    return jsonify({"deleted": pid})


# ── PUT /api/projects/<id>/chef ──────────────────────────────────────────────
# Admin uniquement. Désigne (ou retire) le chef d'un projet.
# Synchronise project_members :
#   - Ancien owner → 'contributor' (reste dans le projet)
#   - Nouveau chef → 'owner' (upsert dans project_members)
#   - Rôle global du nouveau chef → 'chef_projet' si pas déjà

@projects_bp.route("/<int:pid>/chef", methods=["PUT"])
@require_role("admin")
def set_project_chef(pid, current_user):
    data    = request.get_json() or {}
    chef_id = data.get("chef_id", None)

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
    if not project:
        conn.close()
        return jsonify({"error": _PROJECT_NOT_FOUND}), 404

    old_chef_id = dict(project).get("chef_id")

    # ── Retrait du chef (chef_id = null) ────────────────────────────────────
    if chef_id is None:
        conn.execute("UPDATE projects SET chef_id = NULL WHERE id = ?", (pid,))
        # L'ancien owner repasse contributor (il reste dans l'équipe)
        if old_chef_id:
            conn.execute("""
                UPDATE project_members SET role = 'contributor'
                WHERE project_id = ? AND member_id = ? AND role = 'owner'
            """, (pid, old_chef_id))
            _demote_if_orphan(conn, old_chef_id)
        conn.commit()
        row = _fetch_project(conn, pid)
        result = dict(row)
        result["user_role"] = None
        conn.close()
        return jsonify(result)

    # ── Vérification du nouveau chef ─────────────────────────────────────────
    member = conn.execute("SELECT * FROM members WHERE id = ?", (chef_id,)).fetchone()
    if not member:
        conn.close()
        return jsonify({"error": "Membre introuvable."}), 404

    member = dict(member)

    # ── Ancien owner → contributor ───────────────────────────────────────────
    if old_chef_id and old_chef_id != chef_id:
        conn.execute("""
            UPDATE project_members SET role = 'contributor'
            WHERE project_id = ? AND member_id = ? AND role = 'owner'
        """, (pid, old_chef_id))
        _demote_if_orphan(conn, old_chef_id)

    # ── Nouveau chef → owner (upsert) ────────────────────────────────────────
    conn.execute(
        "UPDATE projects SET chef_id = ? WHERE id = ?", (chef_id, pid)
    )
    conn.execute("""
        INSERT INTO project_members (project_id, member_id, role)
        VALUES (?, ?, 'owner')
        ON CONFLICT(project_id, member_id) DO UPDATE SET role = 'owner'
    """, (pid, chef_id))

    # Promouvoir le rôle global si nécessaire (sauf admin)
    if not member.get("is_admin"):
        conn.execute(
            "UPDATE members SET role = 'chef_projet' WHERE id = ? AND role != 'admin'",
            (chef_id,)
        )

    conn.commit()
    row = _fetch_project(conn, pid)
    result = dict(row)
    result["user_role"] = get_project_role(conn, current_user["id"], pid)
    conn.close()
    return jsonify(result)