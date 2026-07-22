# backend/routes/activities.py
#
# A-05 — Ownership créateur (owner_id)
# A-07 — Intégration RBAC project_members :
#   • GET /     → filtre P3 : activités des projets dont l'utilisateur est membre
#   • POST /    → peut créer = owner ou manager du projet
#   • PUT/DEL   → can_edit_activity (owner OU manager/owner du projet) — P4
#   • Champ renvoyé : `can_edit` (remplace `is_owner` pour refléter la réalité élargie)

from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_auth
from utils.permissions import (
    can_edit_activity,
    can_create_activity,
    get_user_project_ids,
)

activities_bp = Blueprint("activities", __name__)

_ADMIN_READ_ONLY    = "L'administrateur dispose d'un accès en lecture seule sur les activités."
_NOT_AUTHORIZED     = "Vous n'êtes pas autorisé à modifier cette activité."
_ACTIVITY_NOT_FOUND = "Activité introuvable."
_NO_PROJECT_RIGHTS  = "Seuls le propriétaire et les managers du projet peuvent créer des activités."


def fetch_activity(conn, aid):
    row = conn.execute("""
        SELECT a.*, p.name AS project_name
        FROM activities a
        JOIN projects p ON a.project_id = p.id
        WHERE a.id = ?
    """, (aid,)).fetchone()
    return dict(row) if row else None


# ── GET /api/activities/ ─────────────────────────────────────────────────────
# P3 : retourne uniquement les activités des projets dont l'utilisateur est membre.
# Admin : voit tout.
# Chaque activité embarque `can_edit` (bool) pour piloter les boutons dans l'UI.

@activities_bp.route("/", methods=["GET"])
@require_auth
def list_activities(current_user):
    project_id_filter = request.args.get("project_id")
    conn = get_db()

    # Pré-calcul des projets accessibles (une seule requête)
    is_admin = current_user.get("is_admin")
    member_project_ids = set() if is_admin else get_user_project_ids(conn, current_user["id"])

    if project_id_filter:
        rows = conn.execute("""
            SELECT a.*, p.name AS project_name
            FROM activities a
            JOIN projects p ON a.project_id = p.id
            WHERE a.project_id = ?
            ORDER BY a.name COLLATE NOCASE
        """, (project_id_filter,)).fetchall()
    else:
        rows = conn.execute("""
            SELECT a.*, p.name AS project_name
            FROM activities a
            JOIN projects p ON a.project_id = p.id
            ORDER BY p.name COLLATE NOCASE, a.name COLLATE NOCASE
        """).fetchall()

    activities = []
    for row in rows:
        a = dict(row)

        # Filtre P3 (admin voit tout)
        if not is_admin and a["project_id"] not in member_project_ids:
            continue

        a["can_edit"] = can_edit_activity(conn, current_user, a)
        activities.append(a)

    conn.close()
    return jsonify(activities)


# ── POST /api/activities/ ────────────────────────────────────────────────────
# Requiert : owner ou manager du projet.

@activities_bp.route("/", methods=["POST"])
@require_auth
def create_activity(current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    data        = request.get_json() or {}
    name        = (data.get("name") or "").strip()
    project_id  = data.get("project_id")
    description = (data.get("description") or "").strip()

    if not name or not project_id:
        return jsonify({"error": "Le nom et le projet sont obligatoires."}), 400

    conn = get_db()

    # Vérification du projet
    project = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        conn.close()
        return jsonify({"error": "Projet introuvable."}), 404

    if not can_create_activity(conn, current_user, project_id):
        conn.close()
        return jsonify({"error": _NO_PROJECT_RIGHTS}), 403

    try:
        c = conn.execute(
            "INSERT INTO activities (name, project_id, description, owner_id) VALUES (?, ?, ?, ?)",
            (name, project_id, description, current_user["id"])
        )
        conn.commit()
        activity = fetch_activity(conn, c.lastrowid)
        activity["can_edit"] = True
        conn.close()
        return jsonify(activity), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


# ── PUT /api/activities/<id> ─────────────────────────────────────────────────
# Autorisé si : créateur (owner_id) OU owner/manager du projet (P4).

@activities_bp.route("/<int:aid>", methods=["PUT"])
@require_auth
def update_activity(aid, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    conn = get_db()
    activity = fetch_activity(conn, aid)
    if not activity:
        conn.close()
        return jsonify({"error": _ACTIVITY_NOT_FOUND}), 404

    if not can_edit_activity(conn, current_user, activity):
        conn.close()
        return jsonify({"error": _NOT_AUTHORIZED}), 403

    data        = request.get_json() or {}
    name        = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    project_id  = data.get("project_id")

    if not name:
        conn.close()
        return jsonify({"error": "Le nom de l'activité est obligatoire."}), 400

    conn.execute(
        "UPDATE activities SET name = ?, description = ?, project_id = ? WHERE id = ?",
        (name, description, project_id, aid)
    )
    conn.commit()
    updated = fetch_activity(conn, aid)
    if updated:
        updated["can_edit"] = can_edit_activity(conn, current_user, updated)
    conn.close()
    return jsonify(updated) if updated else (jsonify({"error": _ACTIVITY_NOT_FOUND}), 404)


# ── DELETE /api/activities/<id> ──────────────────────────────────────────────
# Autorisé si : créateur (owner_id) OU owner/manager du projet (P4).

@activities_bp.route("/<int:aid>", methods=["DELETE"])
@require_auth
def delete_activity(aid, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    conn = get_db()
    activity = fetch_activity(conn, aid)
    if not activity:
        conn.close()
        return jsonify({"error": _ACTIVITY_NOT_FOUND}), 404

    if not can_edit_activity(conn, current_user, activity):
        conn.close()
        return jsonify({"error": _NOT_AUTHORIZED}), 403

    conn.execute("DELETE FROM activities WHERE id = ?", (aid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": aid})