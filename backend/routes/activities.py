# backend/routes/activities.py
#
# A-05 — Ownership des activités :
#   • Tout membre non-admin peut créer une activité (owner_id = créateur auto).
#   • PUT / DELETE réservés au owner de l'activité.
#   • Activités créées avant cette migration : owner_id = NULL, donc non
#     éditables/supprimables via l'UI tant qu'aucun owner n'est assigné
#     (pas de rattrapage automatique — décision produit, cohérente avec le
#     traitement des tâches en A-04).
#   • Chaque activité renvoyée par GET embarque `is_owner` (bool) pour piloter
#     l'UI sans dupliquer la logique côté frontend.

from flask import Blueprint, request, jsonify
from database import get_db

activities_bp = Blueprint("activities", __name__)

# CDC BF-08 / BNF-05 : admin = lecture seule sur les activités.
_ADMIN_READ_ONLY = "L'administrateur dispose d'un accès en lecture seule sur les activités."
_NOT_OWNER        = "Seul le créateur de cette activité peut la modifier ou la supprimer."
_ACTIVITY_NOT_FOUND = "Activité introuvable."

from utils.auth import require_auth


def is_owner(activity, user_id):
    """True si l'utilisateur est le créateur de l'activité."""
    return activity.get("owner_id") is not None and activity["owner_id"] == user_id


def fetch_activity(conn, aid):
    row = conn.execute(
        """SELECT a.*, p.name AS project_name
           FROM activities a
           JOIN projects p ON a.project_id = p.id
           WHERE a.id = ?""",
        (aid,)
    ).fetchone()
    return dict(row) if row else None


# ── GET /api/activities/ ─────────────────────────────────────────────────────
# Tout utilisateur authentifié (admin inclus) peut lister les activités.
# Chaque activité embarque `is_owner` pour piloter les droits d'édition côté UI.

@activities_bp.route("/", methods=["GET"])
@require_auth
def list_activities(current_user):
    project_id = request.args.get("project_id")
    conn = get_db()

    if project_id:
        rows = conn.execute(
            """SELECT a.*, p.name AS project_name
               FROM activities a
               JOIN projects p ON a.project_id = p.id
               WHERE a.project_id = ? ORDER BY a.name""",
            (project_id,)
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT a.*, p.name AS project_name
               FROM activities a
               JOIN projects p ON a.project_id = p.id
               ORDER BY p.name, a.name"""
        ).fetchall()

    conn.close()

    activities = []
    for row in rows:
        a = dict(row)
        a["is_owner"] = is_owner(a, current_user["id"])
        activities.append(a)

    return jsonify(activities)


# ── POST /api/activities/ ────────────────────────────────────────────────────
# Ouvert à tout membre non-admin. Le créateur devient automatiquement owner_id.

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
    try:
        c = conn.execute(
            "INSERT INTO activities (name, project_id, description, owner_id) VALUES (?, ?, ?, ?)",
            (name, project_id, description, current_user["id"])
        )
        conn.commit()
        activity = fetch_activity(conn, c.lastrowid)
        activity["is_owner"] = True
        conn.close()
        return jsonify(activity), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


# ── PUT /api/activities/<id> ─────────────────────────────────────────────────
# Réservé au créateur (owner_id) de l'activité.

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

    if not is_owner(activity, current_user["id"]):
        conn.close()
        return jsonify({"error": _NOT_OWNER}), 403

    data        = request.get_json() or {}
    name        = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    project_id  = data.get("project_id")

    if not name:
        conn.close()
        return jsonify({"error": "Le nom de l'activité est obligatoire."}), 400

    conn.execute(
        "UPDATE activities SET name=?, description=?, project_id=? WHERE id=?",
        (name, description, project_id, aid)
    )
    conn.commit()
    updated = fetch_activity(conn, aid)
    if updated:
        updated["is_owner"] = True
    conn.close()
    return jsonify(updated) if updated else (jsonify({"error": _ACTIVITY_NOT_FOUND}), 404)


# ── DELETE /api/activities/<id> ──────────────────────────────────────────────
# Réservé au créateur (owner_id) de l'activité.
# Note : la suppression en cascade vers tasks est gérée par ON DELETE CASCADE (BDD).

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

    if not is_owner(activity, current_user["id"]):
        conn.close()
        return jsonify({"error": _NOT_OWNER}), 403

    conn.execute("DELETE FROM activities WHERE id=?", (aid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": aid})