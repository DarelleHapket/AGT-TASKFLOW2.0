from flask import Blueprint, request, jsonify
from database import get_db
from datetime import datetime, timezone
from utils.auth import require_auth

notes_bp = Blueprint("notes", __name__)


def _note_full(conn, nid):
    return conn.execute(
        """SELECT n.*, p.name as project_name, a.name as activity_name,
                  t.description as task_description, m.name as author_name
           FROM notes n
           LEFT JOIN projects p ON n.project_id = p.id
           LEFT JOIN activities a ON n.activity_id = a.id
           LEFT JOIN tasks t ON n.task_id = t.id
           LEFT JOIN members m ON n.member_id = m.id
           WHERE n.id=?""", (nid,)
    ).fetchone()


@notes_bp.route("/", methods=["GET"])
@require_auth
def list_notes(current_user):
    """
    GET /api/notes/
    Lecture publique : tout membre connecté voit toutes les notes,
    avec le nom de l'auteur. La modification reste réservée à l'auteur.
    """
    conn = get_db()
    rows = conn.execute(
        """SELECT n.*, p.name as project_name, a.name as activity_name,
                  t.description as task_description, m.name as author_name
           FROM notes n
           LEFT JOIN projects p ON n.project_id = p.id
           LEFT JOIN activities a ON n.activity_id = a.id
           LEFT JOIN tasks t ON n.task_id = t.id
           LEFT JOIN members m ON n.member_id = m.id
           ORDER BY n.updated_at DESC"""
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@notes_bp.route("/", methods=["POST"])
@require_auth
def create_note(current_user):
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400
    conn = get_db()
    c = conn.execute(
        """INSERT INTO notes (title, content, project_id, activity_id, task_id, member_id)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (title, data.get("content", ""),
         data.get("project_id") or None,
         data.get("activity_id") or None,
         data.get("task_id") or None,
         current_user["id"])
    )
    conn.commit()
    row = _note_full(conn, c.lastrowid)
    conn.close()
    return jsonify(dict(row)), 201


@notes_bp.route("/<int:nid>", methods=["PUT"])
@require_auth
def update_note(nid, current_user):
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400

    conn = get_db()
    note = conn.execute("SELECT member_id FROM notes WHERE id=?", (nid,)).fetchone()
    if not note:
        conn.close()
        return jsonify({"error": "not found"}), 404
    # Seul l'auteur peut modifier sa note
    if note["member_id"] is not None and str(note["member_id"]) != str(current_user["id"]):
        conn.close()
        return jsonify({"error": "Vous ne pouvez modifier que vos propres notes"}), 403

    now = datetime.now(timezone.utc).isoformat()
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
    row = _note_full(conn, nid)
    conn.close()
    return jsonify(dict(row)) if row else (jsonify({"error": "not found"}), 404)


@notes_bp.route("/<int:nid>", methods=["DELETE"])
@require_auth
def delete_note(nid, current_user):
    conn = get_db()
    note = conn.execute("SELECT member_id FROM notes WHERE id=?", (nid,)).fetchone()
    if not note:
        conn.close()
        return jsonify({"error": "not found"}), 404
    # Seul l'auteur peut supprimer sa note
    if note["member_id"] is not None and str(note["member_id"]) != str(current_user["id"]):
        conn.close()
        return jsonify({"error": "Vous ne pouvez supprimer que vos propres notes"}), 403

    conn.execute("DELETE FROM notes WHERE id=?", (nid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": nid})