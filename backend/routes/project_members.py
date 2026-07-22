# backend/routes/project_members.py
#
# A-07 — CRUD membres d'un projet
# A-08 — Soft delete : GET /<pid>/members inclut les membres supprimés (deleted_at)
#         en les ordonnant en dernier pour conserver la traçabilité du projet.
#         POST /<pid>/members rejette un membre avec deleted_at IS NOT NULL.

from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_auth
from utils.permissions import get_project_role, is_project_member

project_members_bp = Blueprint("project_members", __name__)

_PROJECT_NOT_FOUND = "Projet introuvable."
_MEMBER_NOT_FOUND  = "Membre introuvable."
_NOT_OWNER         = "Seul le propriétaire du projet peut gérer l'équipe."
_ALREADY_MEMBER    = "Ce membre fait déjà partie du projet."
_CANT_SELF         = "Vous ne pouvez pas modifier votre propre rôle ou vous retirer."
_CANT_CHANGE_OWNER = "Le rôle du propriétaire ne peut pas être modifié."
_VALID_ROLES       = ("manager", "contributor")


def _check_project(conn, pid):
    row = conn.execute("SELECT id FROM projects WHERE id = ?", (pid,)).fetchone()
    return row is not None


def _require_owner(conn, current_user, pid):
    role = get_project_role(conn, current_user["id"], pid)
    if role != "owner":
        return jsonify({"error": _NOT_OWNER}), 403
    return None


def _fetch_member_row(conn, pid, mid):
    return conn.execute("""
        SELECT pm.member_id, pm.role, pm.joined_at,
               m.name, m.color, m.email, m.deleted_at
        FROM project_members pm
        JOIN members m ON pm.member_id = m.id
        WHERE pm.project_id = ? AND pm.member_id = ?
    """, (pid, mid)).fetchone()


# ── GET /api/projects/<id>/members ──────────────────────────────────────────
# Retourne TOUS les membres du projet, y compris les supprimés (soft delete).
# Les supprimés apparaissent en dernier, marqués avec deleted_at.
# Cela permet de consulter l'historique complet de l'équipe.

@project_members_bp.route("/<int:pid>/members", methods=["GET"])
@require_auth
def list_project_members(pid, current_user):
    conn = get_db()
    if not _check_project(conn, pid):
        conn.close()
        return jsonify({"error": _PROJECT_NOT_FOUND}), 404

    if not current_user.get("is_admin") and not is_project_member(conn, current_user["id"], pid):
        conn.close()
        return jsonify({"error": "Accès réservé aux membres de ce projet."}), 403

    rows = conn.execute("""
        SELECT pm.member_id, pm.role, pm.joined_at,
               m.name, m.color, m.email, m.deleted_at
        FROM project_members pm
        JOIN members m ON pm.member_id = m.id
        WHERE pm.project_id = ?
        ORDER BY
            CASE WHEN m.deleted_at IS NOT NULL THEN 1 ELSE 0 END,
            CASE pm.role
                WHEN 'owner'       THEN 0
                WHEN 'manager'     THEN 1
                WHEN 'contributor' THEN 2
                ELSE 3
            END,
            m.name COLLATE NOCASE
    """, (pid,)).fetchall()

    conn.close()
    return jsonify([dict(r) for r in rows])


# ── POST /api/projects/<id>/members ─────────────────────────────────────────

@project_members_bp.route("/<int:pid>/members", methods=["POST"])
@require_auth
def add_project_member(pid, current_user):
    conn = get_db()
    if not _check_project(conn, pid):
        conn.close()
        return jsonify({"error": _PROJECT_NOT_FOUND}), 404

    err = _require_owner(conn, current_user, pid)
    if err:
        conn.close()
        return err

    data      = request.get_json() or {}
    member_id = data.get("member_id")
    role      = data.get("role", "contributor")

    if not member_id:
        conn.close()
        return jsonify({"error": "member_id est obligatoire."}), 400

    if role not in _VALID_ROLES:
        conn.close()
        return jsonify({"error": f"Rôle invalide. Valeurs acceptées : {', '.join(_VALID_ROLES)}"}), 400

    member = conn.execute(
        "SELECT id, name, is_active, is_admin, deleted_at FROM members WHERE id = ?",
        (member_id,)
    ).fetchone()
    if not member:
        conn.close()
        return jsonify({"error": _MEMBER_NOT_FOUND}), 404

    # Refuser l'ajout d'un membre supprimé (soft delete)
    if member["deleted_at"] is not None:
        conn.close()
        return jsonify({"error": "Ce compte a été supprimé et ne peut plus être ajouté à un projet."}), 403

    if not member["is_active"]:
        conn.close()
        return jsonify({"error": "Ce compte n'est pas encore actif."}), 400

    if member["is_admin"]:
        conn.close()
        return jsonify({"error": "L'administrateur ne peut pas être ajouté à une équipe projet."}), 403

    if is_project_member(conn, member_id, pid):
        conn.close()
        return jsonify({"error": _ALREADY_MEMBER}), 409

    conn.execute(
        "INSERT INTO project_members (project_id, member_id, role) VALUES (?, ?, ?)",
        (pid, member_id, role)
    )
    conn.commit()

    row = _fetch_member_row(conn, pid, member_id)
    conn.close()
    return jsonify(dict(row)), 201


# ── PUT /api/projects/<id>/members/<mid> ─────────────────────────────────────

@project_members_bp.route("/<int:pid>/members/<int:mid>", methods=["PUT"])
@require_auth
def update_project_member_role(pid, mid, current_user):
    conn = get_db()
    if not _check_project(conn, pid):
        conn.close()
        return jsonify({"error": _PROJECT_NOT_FOUND}), 404

    err = _require_owner(conn, current_user, pid)
    if err:
        conn.close()
        return err

    if mid == current_user["id"]:
        conn.close()
        return jsonify({"error": _CANT_SELF}), 403

    data = request.get_json() or {}
    role = data.get("role")

    if role not in _VALID_ROLES:
        conn.close()
        return jsonify({"error": f"Rôle invalide. Valeurs acceptées : {', '.join(_VALID_ROLES)}"}), 400

    existing = conn.execute(
        "SELECT role FROM project_members WHERE project_id = ? AND member_id = ?",
        (pid, mid)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Ce membre ne fait pas partie du projet."}), 404
    if existing["role"] == "owner":
        conn.close()
        return jsonify({"error": _CANT_CHANGE_OWNER}), 403

    conn.execute(
        "UPDATE project_members SET role = ? WHERE project_id = ? AND member_id = ?",
        (role, pid, mid)
    )
    conn.commit()
    row = _fetch_member_row(conn, pid, mid)
    conn.close()
    return jsonify(dict(row))


# ── DELETE /api/projects/<id>/members/<mid> ──────────────────────────────────

@project_members_bp.route("/<int:pid>/members/<int:mid>", methods=["DELETE"])
@require_auth
def remove_project_member(pid, mid, current_user):
    conn = get_db()
    if not _check_project(conn, pid):
        conn.close()
        return jsonify({"error": _PROJECT_NOT_FOUND}), 404

    err = _require_owner(conn, current_user, pid)
    if err:
        conn.close()
        return err

    if mid == current_user["id"]:
        conn.close()
        return jsonify({"error": _CANT_SELF}), 403

    existing = conn.execute(
        "SELECT role FROM project_members WHERE project_id = ? AND member_id = ?",
        (pid, mid)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Ce membre ne fait pas partie du projet."}), 404

    conn.execute(
        "DELETE FROM project_members WHERE project_id = ? AND member_id = ?",
        (pid, mid)
    )
    conn.commit()
    conn.close()
    return jsonify({"removed": mid})
