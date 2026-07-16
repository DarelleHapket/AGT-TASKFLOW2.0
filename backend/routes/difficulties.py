# backend/routes/difficulties.py
from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_auth

difficulties_bp = Blueprint("difficulties", __name__)


@difficulties_bp.route("/", methods=["GET"])
@require_auth
def list_difficulties(current_user):
    """
    GET /api/difficulties/?task_id=T001
    Retourne toutes les difficultés d'une tâche.
    Accessible en lecture à tous les membres connectés.
    """
    task_id = request.args.get("task_id")
    if not task_id:
        return jsonify({"error": "task_id requis"}), 400

    conn = get_db()
    rows = conn.execute(
        """SELECT d.*, m.name as member_name
           FROM task_difficulties d
           LEFT JOIN members m ON d.member_id = m.id
           WHERE d.task_id = ?
           ORDER BY d.created_at DESC""",
        (task_id,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@difficulties_bp.route("/", methods=["POST"])
@require_auth
def create_difficulty(current_user):
    """
    POST /api/difficulties/
    Body: { "task_id": "T001", "content": "Blocage sur..." }
    Réservé au membre assigné à la tâche (ou admin).
    """
    data = request.get_json() or {}
    task_id = (data.get("task_id") or "").strip()
    content = (data.get("content") or "").strip()

    if not task_id or not content:
        return jsonify({"error": "task_id et content requis"}), 400

    conn = get_db()

    # Vérifier que la tâche existe
    task = conn.execute(
        "SELECT * FROM tasks WHERE id=?", (task_id,)
    ).fetchone()
    if not task:
        conn.close()
        return jsonify({"error": "Tâche introuvable"}), 404

    task = dict(task)

    # Seul le membre assigné ou l'admin peut signaler
    is_assigned = task.get("responsible") == current_user["name"]
    is_admin = current_user.get("is_admin", False)

    if not is_assigned and not is_admin:
        conn.close()
        return jsonify({
            "error": "Seul le membre assigné peut signaler une difficulté"
        }), 403

    c = conn.execute(
        """INSERT INTO task_difficulties (task_id, member_id, content)
           VALUES (?, ?, ?)""",
        (task_id, current_user["id"], content)
    )
    conn.commit()

    row = conn.execute(
        """SELECT d.*, m.name as member_name
           FROM task_difficulties d
           LEFT JOIN members m ON d.member_id = m.id
           WHERE d.id=?""",
        (c.lastrowid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@difficulties_bp.route("/<int:did>", methods=["DELETE"])
@require_auth
def delete_difficulty(did, current_user):
    """
    DELETE /api/difficulties/<id>
    Réservé à l'admin ou à l'auteur de la difficulté.
    """
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM task_difficulties WHERE id=?", (did,)
    ).fetchone()

    if not row:
        conn.close()
        return jsonify({"error": "Difficulté introuvable"}), 404

    diff = dict(row)
    is_author = diff["member_id"] == current_user["id"]
    is_admin = current_user.get("is_admin", False)

    if not is_author and not is_admin:
        conn.close()
        return jsonify({"error": "Non autorisé"}), 403

    conn.execute("DELETE FROM task_difficulties WHERE id=?", (did,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": did})