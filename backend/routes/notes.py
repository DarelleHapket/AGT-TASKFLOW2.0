from flask import Blueprint, request, jsonify
from database import get_db
from datetime import datetime, timezone

notes_bp = Blueprint("notes", __name__)


@notes_bp.route("/", methods=["GET"])
def list_notes():
    conn = get_db()
    rows = conn.execute(
        """SELECT n.*, p.name as project_name, a.name as activity_name,
                  t.description as task_description
           FROM notes n
           LEFT JOIN projects p ON n.project_id = p.id
           LEFT JOIN activities a ON n.activity_id = a.id
           LEFT JOIN tasks t ON n.task_id = t.id
           ORDER BY n.updated_at DESC"""
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@notes_bp.route("/", methods=["POST"])
def create_note():
    data = request.get_json()
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400
    conn = get_db()
    c = conn.execute(
        """INSERT INTO notes (title, content, project_id, activity_id, task_id)
           VALUES (?, ?, ?, ?, ?)""",
        (title, data.get("content", ""),
         data.get("project_id") or None,
         data.get("activity_id") or None,
         data.get("task_id") or None)
    )
    conn.commit()
    row = conn.execute(
        """SELECT n.*, p.name as project_name, a.name as activity_name,
                  t.description as task_description
           FROM notes n
           LEFT JOIN projects p ON n.project_id = p.id
           LEFT JOIN activities a ON n.activity_id = a.id
           LEFT JOIN tasks t ON n.task_id = t.id
           WHERE n.id=?""", (c.lastrowid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@notes_bp.route("/<int:nid>", methods=["PUT"])
def update_note(nid):
    data = request.get_json()
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        """UPDATE notes SET title=?, content=?, project_id=?, activity_id=?,
           task_id=?, updated_at=? WHERE id=?""",
        (title, data.get("content", ""),
         data.get("project_id") or None,
         data.get("activity_id") or None,
         data.get("task_id") or None,
         now, nid)
    )
    conn.commit()
    row = conn.execute(
        """SELECT n.*, p.name as project_name, a.name as activity_name,
                  t.description as task_description
           FROM notes n
           LEFT JOIN projects p ON n.project_id = p.id
           LEFT JOIN activities a ON n.activity_id = a.id
           LEFT JOIN tasks t ON n.task_id = t.id
           WHERE n.id=?""", (nid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(row)) if row else (jsonify({"error": "not found"}), 404)


@notes_bp.route("/<int:nid>", methods=["DELETE"])
def delete_note(nid):
    conn = get_db()
    conn.execute("DELETE FROM notes WHERE id=?", (nid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": nid})