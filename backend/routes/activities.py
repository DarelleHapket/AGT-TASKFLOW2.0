# backend/routes/activities.py
from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_auth

activities_bp = Blueprint("activities", __name__)

# CDC BF-08 / BNF-05 : admin = lecture seule sur les activités.
_ADMIN_READ_ONLY = "L'administrateur dispose d'un accès en lecture seule sur les activités."


# ── GET /api/activities/ ─────────────────────────────────────────────────────
# Tout utilisateur authentifié (admin inclus) peut lister les activités.

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
    return jsonify([dict(r) for r in rows])


# ── POST /api/activities/ ────────────────────────────────────────────────────
# Admin → 403. Guard is_chef_of_project() : Étape 6 (session future).

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
            "INSERT INTO activities (name, project_id, description) VALUES (?, ?, ?)",
            (name, project_id, description)
        )
        conn.commit()
        row = conn.execute(
            """SELECT a.*, p.name AS project_name
               FROM activities a
               JOIN projects p ON a.project_id = p.id
               WHERE a.id = ?""",
            (c.lastrowid,)
        ).fetchone()
        conn.close()
        return jsonify(dict(row)), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


# ── PUT /api/activities/<id> ─────────────────────────────────────────────────
# Admin → 403.

@activities_bp.route("/<int:aid>", methods=["PUT"])
@require_auth
def update_activity(aid, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    data        = request.get_json() or {}
    name        = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    project_id  = data.get("project_id")

    if not name:
        return jsonify({"error": "Le nom de l'activité est obligatoire."}), 400

    conn = get_db()
    conn.execute(
        "UPDATE activities SET name=?, description=?, project_id=? WHERE id=?",
        (name, description, project_id, aid)
    )
    conn.commit()
    row = conn.execute(
        """SELECT a.*, p.name AS project_name
           FROM activities a
           JOIN projects p ON a.project_id = p.id
           WHERE a.id = ?""",
        (aid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(row)) if row else (jsonify({"error": "Activité introuvable."}), 404)


# ── DELETE /api/activities/<id> ──────────────────────────────────────────────
# Admin → 403.
# Note : la suppression en cascade vers tasks est gérée par ON DELETE CASCADE (BDD).

@activities_bp.route("/<int:aid>", methods=["DELETE"])
@require_auth
def delete_activity(aid, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    conn = get_db()
    conn.execute("DELETE FROM activities WHERE id=?", (aid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": aid})