from flask import Blueprint, request, jsonify
from database import get_db

activities_bp = Blueprint("activities", __name__)


@activities_bp.route("/", methods=["GET"])
def list_activities():
    project_id = request.args.get("project_id")
    conn = get_db()
    if project_id:
        rows = conn.execute(
            """SELECT a.*, p.name as project_name FROM activities a
               JOIN projects p ON a.project_id = p.id
               WHERE a.project_id=? ORDER BY a.name""",
            (project_id,)
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT a.*, p.name as project_name FROM activities a
               JOIN projects p ON a.project_id = p.id ORDER BY p.name, a.name"""
        ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@activities_bp.route("/", methods=["POST"])
def create_activity():
    data = request.get_json()
    name = (data.get("name") or "").strip()
    project_id = data.get("project_id")
    description = (data.get("description") or "").strip()
    if not name or not project_id:
        return jsonify({"error": "name and project_id required"}), 400
    conn = get_db()
    try:
        c = conn.execute(
            "INSERT INTO activities (name, project_id, description) VALUES (?, ?, ?)",
            (name, project_id, description)
        )
        conn.commit()
        row = conn.execute(
            """SELECT a.*, p.name as project_name FROM activities a
               JOIN projects p ON a.project_id=p.id WHERE a.id=?""",
            (c.lastrowid,)
        ).fetchone()
        conn.close()
        return jsonify(dict(row)), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


@activities_bp.route("/<int:aid>", methods=["PUT"])
def update_activity(aid):
    data = request.get_json()
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    project_id = data.get("project_id")
    if not name:
        return jsonify({"error": "name required"}), 400
    conn = get_db()
    conn.execute(
        "UPDATE activities SET name=?, description=?, project_id=? WHERE id=?",
        (name, description, project_id, aid)
    )
    conn.commit()
    row = conn.execute(
        """SELECT a.*, p.name as project_name FROM activities a
           JOIN projects p ON a.project_id=p.id WHERE a.id=?""",
        (aid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(row)) if row else (jsonify({"error": "not found"}), 404)


@activities_bp.route("/<int:aid>", methods=["DELETE"])
def delete_activity(aid):
    conn = get_db()
    conn.execute("DELETE FROM activities WHERE id=?", (aid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": aid})
