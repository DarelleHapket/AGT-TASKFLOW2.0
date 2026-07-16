# backend/routes/difficulties.py
from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_auth

difficulties_bp = Blueprint("difficulties", __name__)


def _user_role(user):
    """Rôle effectif, avec repli sur is_admin (comme partout ailleurs)."""
    return user.get("role") or ("admin" if user.get("is_admin") else "membre")


def can_access_task(conn, user, task):
    """
    Détermine si `user` a le droit d'accéder aux difficultés de `task`.
    - admin        : accès à tout
    - chef_projet  : accès si la tâche appartient à un projet dont il est le chef
    - membre       : accès si la tâche lui est assignée
    `task` et `user` sont des dicts. `conn` est une connexion ouverte.
    """
    role = _user_role(user)

    if role == "admin":
        return True

    if role == "chef_projet":
        project_id = task.get("project_id")
        if not project_id:
            return False
        proj = conn.execute(
            "SELECT chef_id FROM projects WHERE id=?", (project_id,)
        ).fetchone()
        return bool(proj) and proj["chef_id"] == user["id"]

    # membre
    return task.get("responsible") == user.get("name")


@difficulties_bp.route("/", methods=["GET"])
@require_auth
def list_difficulties(current_user):
    """
    GET /api/difficulties/?task_id=T001
    Retourne les difficultés d'une tâche, si l'utilisateur y a accès.
    - admin : toutes ; chef_projet : celles de ses projets ; membre : ses tâches.
    """
    task_id = request.args.get("task_id")
    if not task_id:
        return jsonify({"error": "task_id requis"}), 400

    conn = get_db()

    task = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    if not task:
        conn.close()
        return jsonify({"error": "Tâche introuvable"}), 404

    if not can_access_task(conn, current_user, dict(task)):
        conn.close()
        return jsonify({"error": "Accès non autorisé à cette tâche"}), 403

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

    # Peut signaler : le membre assigné, l'admin, ou le chef du projet de la tâche
    if not can_access_task(conn, current_user, task):
        conn.close()
        return jsonify({
            "error": "Vous n'avez pas accès à cette tâche"
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

    # Récupérer la tâche liée pour vérifier le rôle chef/admin
    task = conn.execute("SELECT * FROM tasks WHERE id=?", (diff["task_id"],)).fetchone()
    can_manage = bool(task) and can_access_task(conn, current_user, dict(task))

    if not is_author and not can_manage:
        conn.close()
        return jsonify({"error": "Non autorisé"}), 403

    conn.execute("DELETE FROM task_difficulties WHERE id=?", (did,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": did})