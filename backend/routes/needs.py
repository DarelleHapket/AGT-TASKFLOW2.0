from flask import Blueprint, request, jsonify
from database import get_db, NEED_TYPES, NEED_STATUSES
from utils.auth import require_auth

needs_bp = Blueprint("needs", __name__)


def enrich(row):
    d = dict(row)
    return d


@needs_bp.route("/types", methods=["GET"])
@require_auth
def get_types(current_user):
    return jsonify(NEED_TYPES)


@needs_bp.route("/statuses", methods=["GET"])
@require_auth
def get_statuses(current_user):
    return jsonify(NEED_STATUSES)


@needs_bp.route("/", methods=["GET"])
@require_auth
def list_needs(current_user):
    conn = get_db()
    rows = conn.execute(
        """SELECT n.*, p.name as project_name, a.name as activity_name
           FROM needs n
           LEFT JOIN projects p ON n.project_id = p.id
           LEFT JOIN activities a ON n.activity_id = a.id
           ORDER BY n.created_at DESC"""
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@needs_bp.route("/", methods=["POST"])
@require_auth
def create_need(current_user):
    data = request.get_json()
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400
    conn = get_db()
    c = conn.execute(
        """INSERT INTO needs (title, description, type, status, project_id, activity_id)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (title, data.get("description", ""), data.get("type", "Autre"),
         data.get("status", "initié"),
         data.get("project_id") or None, data.get("activity_id") or None)
    )
    conn.commit()
    row = conn.execute(
        """SELECT n.*, p.name as project_name, a.name as activity_name
           FROM needs n
           LEFT JOIN projects p ON n.project_id = p.id
           LEFT JOIN activities a ON n.activity_id = a.id
           WHERE n.id=?""", (c.lastrowid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@needs_bp.route("/<int:nid>", methods=["PUT"])
@require_auth
def update_need(current_user, nid):
    data = request.get_json()
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400
    conn = get_db()
    conn.execute(
        """UPDATE needs SET title=?, description=?, type=?, status=?,
           project_id=?, activity_id=? WHERE id=?""",
        (title, data.get("description", ""), data.get("type", "Autre"),
         data.get("status", "initié"),
         data.get("project_id") or None, data.get("activity_id") or None, nid)
    )
    conn.commit()
    row = conn.execute(
        """SELECT n.*, p.name as project_name, a.name as activity_name
           FROM needs n
           LEFT JOIN projects p ON n.project_id = p.id
           LEFT JOIN activities a ON n.activity_id = a.id
           WHERE n.id=?""", (nid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(row)) if row else (jsonify({"error": "not found"}), 404)


@needs_bp.route("/<int:nid>", methods=["DELETE"])
@require_auth
def delete_need(current_user, nid):
    conn = get_db()
    conn.execute("DELETE FROM needs WHERE id=?", (nid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": nid})