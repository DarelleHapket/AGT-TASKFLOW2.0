# backend/routes/project_members.py
#
# A-07 — CRUD des membres d'un projet (table project_members).
# Enregistré dans app.py avec url_prefix="/api/projects".
#
# Endpoints :
#   GET    /api/projects/<id>/members          → liste (membres du projet + admin)
#   POST   /api/projects/<id>/members          → ajouter un membre (owner uniquement)
#   PUT    /api/projects/<id>/members/<mid>    → changer le rôle (owner uniquement)
#   DELETE /api/projects/<id>/members/<mid>    → retirer un membre (owner uniquement)
#
# Contraintes :
#   - L'owner ne peut pas modifier son propre rôle ni se retirer
#   - Le rôle 'owner' ne peut pas être attribué via ces endpoints
#     (il est géré par create_project et set_project_chef)
#   - Un membre déjà présent ne peut pas être re-ajouté (409)

from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_auth
from utils.permissions import get_project_role, is_project_member

project_members_bp = Blueprint("project_members", __name__)

# ── Constantes messages ──────────────────────────────────────────────────────
_PROJECT_NOT_FOUND = "Projet introuvable."
_MEMBER_NOT_FOUND  = "Membre introuvable."
_NOT_OWNER         = "Seul le propriétaire du projet peut gérer l'équipe."
_ALREADY_MEMBER    = "Ce membre fait déjà partie du projet."
_CANT_SELF         = "Vous ne pouvez pas modifier votre propre rôle ou vous retirer."
_CANT_CHANGE_OWNER = "Le rôle du propriétaire ne peut pas être modifié."
_VALID_ROLES       = ("manager", "contributor")


def _check_project(conn, pid):
    """Vérifie que le projet existe. Retourne True/False."""
    row = conn.execute("SELECT id FROM projects WHERE id = ?", (pid,)).fetchone()
    return row is not None


def _require_owner(conn, current_user, pid):
    """
    Retourne None si l'utilisateur est owner, sinon retourne la réponse d'erreur.
    Permet le pattern : `err = _require_owner(...); if err: return err`
    """
    role = get_project_role(conn, current_user["id"], pid)
    if role != "owner":
        return jsonify({"error": _NOT_OWNER}), 403
    return None


def _fetch_member_row(conn, pid, mid):
    """Retourne la ligne project_members enrichie avec les infos du membre."""
    return conn.execute("""
        SELECT pm.member_id, pm.role, pm.joined_at,
               m.name, m.color, m.email
        FROM project_members pm
        JOIN members m ON pm.member_id = m.id
        WHERE pm.project_id = ? AND pm.member_id = ?
    """, (pid, mid)).fetchone()


# ── GET /api/projects/<id>/members ──────────────────────────────────────────

@project_members_bp.route("/<int:pid>/members", methods=["GET"])
@require_auth
def list_project_members(pid, current_user):
    """
    Liste les membres du projet avec leurs rôles.
    Accessible à tous les membres du projet et aux admins.
    Ordre : owner → managers → contributors (alphabétique dans chaque groupe).
    """
    conn = get_db()

    if not _check_project(conn, pid):
        conn.close()
        return jsonify({"error": _PROJECT_NOT_FOUND}), 404

    if not current_user.get("is_admin") and not is_project_member(conn, current_user["id"], pid):
        conn.close()
        return jsonify({"error": "Accès réservé aux membres de ce projet."}), 403

    rows = conn.execute("""
        SELECT pm.member_id, pm.role, pm.joined_at,
               m.name, m.color, m.email
        FROM project_members pm
        JOIN members m ON pm.member_id = m.id
        WHERE pm.project_id = ?
        ORDER BY
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
    """
    Ajoute un membre au projet avec le rôle spécifié (défaut : contributor).
    Réservé à l'owner du projet.

    Body : { "member_id": int, "role": "manager" | "contributor" }
    """
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
        return jsonify({
            "error": f"Rôle invalide. Valeurs acceptées : {', '.join(_VALID_ROLES)}"
        }), 400

    member = conn.execute(
        "SELECT id, name, is_active, is_admin FROM members WHERE id = ?", (member_id,)
    ).fetchone()
    if not member:
        conn.close()
        return jsonify({"error": _MEMBER_NOT_FOUND}), 404

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
    """
    Change le rôle d'un membre du projet.
    Réservé à l'owner. Ne peut pas modifier le rôle de l'owner lui-même.

    Body : { "role": "manager" | "contributor" }
    """
    conn = get_db()

    if not _check_project(conn, pid):
        conn.close()
        return jsonify({"error": _PROJECT_NOT_FOUND}), 404

    err = _require_owner(conn, current_user, pid)
    if err:
        conn.close()
        return err

    # L'owner ne peut pas modifier son propre rôle
    if mid == current_user["id"]:
        conn.close()
        return jsonify({"error": _CANT_SELF}), 403

    data = request.get_json() or {}
    role = data.get("role")

    if role not in _VALID_ROLES:
        conn.close()
        return jsonify({
            "error": f"Rôle invalide. Valeurs acceptées : {', '.join(_VALID_ROLES)}"
        }), 400

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
    """
    Retire un membre du projet.
    Réservé à l'owner. L'owner ne peut pas se retirer lui-même.
    """
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