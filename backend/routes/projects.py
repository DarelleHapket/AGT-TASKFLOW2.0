from flask import Blueprint, request, jsonify
from database import get_db

projects_bp = Blueprint("projects", __name__)


def row_to_dict(row):
    return dict(row) if row else None


@projects_bp.route("/", methods=["GET"])
def list_projects():
    conn = get_db()
    rows = conn.execute("SELECT * FROM projects ORDER BY name").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@projects_bp.route("/", methods=["POST"])
def create_project():
    data = request.get_json()
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    conn = get_db()
    try:
        c = conn.execute(
            "INSERT INTO projects (name, description) VALUES (?, ?)",
            (name, description)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM projects WHERE id=?", (c.lastrowid,)).fetchone()
        conn.close()
        return jsonify(dict(row)), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


@projects_bp.route("/<int:pid>", methods=["PUT"])
def update_project(pid):
    data = request.get_json()
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    conn = get_db()
    conn.execute(
        "UPDATE projects SET name=?, description=? WHERE id=?",
        (name, description, pid)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    return jsonify(dict(row)) if row else (jsonify({"error": "not found"}), 404)


@projects_bp.route("/<int:pid>", methods=["DELETE"])
def delete_project(pid):
    conn = get_db()
    conn.execute("DELETE FROM projects WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": pid})
