# backend/routes/projects.py
#
# A-03 — Corrections :
#   Bug 1 : POST /  → chef_id = current_user["id"] ajouté dans l'INSERT
#   Bug 2 : PUT /<id>  → garde ownership : seul le chef du projet peut modifier
#   Bug 2 : DELETE /<id> → idem

from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_auth, require_role

projects_bp = Blueprint("projects", __name__)

_ADMIN_READ_ONLY  = "L'administrateur dispose d'un accès en lecture seule sur les projets."
_NOT_YOUR_PROJECT = "Vous n'êtes pas le chef de ce projet."


# ── Helper interne ───────────────────────────────────────────────────────────

def _fetch_project(conn, pid):
    """Retourne un projet avec chef_name (LEFT JOIN members)."""
    return conn.execute(
        """SELECT p.*, m.name AS chef_name
           FROM projects p
           LEFT JOIN members m ON p.chef_id = m.id
           WHERE p.id = ?""",
        (pid,)
    ).fetchone()


def _is_owner(project, current_user):
    """Vérifie que current_user est bien le chef de ce projet."""
    chef_id = project["chef_id"]
    if chef_id is None:
        return False
    return int(chef_id) == int(current_user["id"])


# ── GET /api/projects/ ───────────────────────────────────────────────────────

@projects_bp.route("/", methods=["GET"])
@require_auth
def list_projects(current_user):
    conn = get_db()
    rows = conn.execute(
        """SELECT p.*, m.name AS chef_name
           FROM projects p
           LEFT JOIN members m ON p.chef_id = m.id
           ORDER BY p.name"""
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ── POST /api/projects/ ──────────────────────────────────────────────────────
# Admin → 403.
# Chef → crée le projet ET devient automatiquement chef_id (Bug 1 corrigé).

@projects_bp.route("/", methods=["POST"])
@require_auth
def create_project(current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    data        = request.get_json() or {}
    name        = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()

    if not name:
        return jsonify({"error": "Le nom du projet est obligatoire."}), 400

    conn = get_db()
    try:
        # Bug 1 — chef_id = id du membre connecté
        c = conn.execute(
            "INSERT INTO projects (name, description, chef_id) VALUES (?, ?, ?)",
            (name, description, current_user["id"])
        )
        conn.commit()
        row = _fetch_project(conn, c.lastrowid)
        conn.close()
        return jsonify(dict(row)), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


# ── PUT /api/projects/<id> ───────────────────────────────────────────────────
# Admin → 403.
# Bug 2 — seul le chef du projet peut modifier (ownership guard).

@projects_bp.route("/<int:pid>", methods=["PUT"])
@require_auth
def update_project(pid, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not project:
        conn.close()
        return jsonify({"error": "Projet introuvable."}), 404

    # Bug 2 — garde ownership
    if not _is_owner(project, current_user):
        conn.close()
        return jsonify({"error": _NOT_YOUR_PROJECT}), 403

    data        = request.get_json() or {}
    name        = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()

    if not name:
        conn.close()
        return jsonify({"error": "Le nom du projet est obligatoire."}), 400

    conn.execute(
        "UPDATE projects SET name=?, description=? WHERE id=?",
        (name, description, pid)
    )
    conn.commit()
    row = _fetch_project(conn, pid)
    conn.close()
    return jsonify(dict(row)) if row else (jsonify({"error": "Projet introuvable."}), 404)


# ── DELETE /api/projects/<id> ────────────────────────────────────────────────
# Admin → 403.
# Bug 2 — seul le chef du projet peut supprimer (ownership guard).

@projects_bp.route("/<int:pid>", methods=["DELETE"])
@require_auth
def delete_project(pid, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not project:
        conn.close()
        return jsonify({"error": "Projet introuvable."}), 404

    # Bug 2 — garde ownership
    if not _is_owner(project, current_user):
        conn.close()
        return jsonify({"error": _NOT_YOUR_PROJECT}), 403

    conn.execute("DELETE FROM projects WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": pid})


# ── PUT /api/projects/<id>/chef ──────────────────────────────────────────────
# Poste B (Darelle) — conservé intact.

@projects_bp.route("/<int:pid>/chef", methods=["PUT"])
@require_role("admin")
def set_project_chef(pid, current_user):
    """
    PUT /api/projects/<id>/chef
    Body: { "chef_id": <member_id | null> }
    Désigne (ou retire) le chef d'un projet.
    Si chef_id fourni : le membre reçoit le role 'chef_projet'.
    """
    data    = request.get_json() or {}
    chef_id = data.get("chef_id", None)

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not project:
        conn.close()
        return jsonify({"error": "Projet introuvable."}), 404

    if chef_id is None:
        conn.execute("UPDATE projects SET chef_id=NULL WHERE id=?", (pid,))
        conn.commit()
        row = _fetch_project(conn, pid)
        conn.close()
        return jsonify(dict(row))

    member = conn.execute("SELECT * FROM members WHERE id=?", (chef_id,)).fetchone()
    if not member:
        conn.close()
        return jsonify({"error": "Membre introuvable."}), 404

    member = dict(member)
    conn.execute("UPDATE projects SET chef_id=? WHERE id=?", (chef_id, pid))
    if not member.get("is_admin"):
        conn.execute(
            "UPDATE members SET role='chef_projet' WHERE id=? AND role != 'admin'",
            (chef_id,)
        )
    conn.commit()
    row = _fetch_project(conn, pid)
    conn.close()
    return jsonify(dict(row))