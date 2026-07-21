# backend/routes/difficulties.py
#
# Bugfix (A-05, hors périmètre habituel — signalé à Darelle) :
#   can_access_task() faisait un if/elif exclusif sur le rôle GLOBAL de
#   l'utilisateur (admin / chef_projet / membre). Un utilisateur au rôle
#   "chef_projet" (chef d'un AUTRE projet) tombait dans la branche chef_projet,
#   qui retournait False s'il n'était pas chef du projet de CETTE tâche —
#   sans jamais vérifier s'il était le responsable assigné. Résultat : un
#   chef de projet assigné comme responsable sur une tâche d'un autre projet
#   ne pouvait pas signaler de difficulté ni changer son statut ("Vous n'avez
#   pas accès à cette tâche").
#
#   Corrigé en remplaçant le if/elif par des vérifications cumulatives,
#   cohérentes avec le modèle owner/chef/responsable introduit dans
#   tasks.py (A-04) : admin, OU chef du projet de la tâche, OU owner de la
#   tâche, OU responsable assigné — chaque condition vérifiée indépendamment
#   du rôle global de l'utilisateur.

from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_auth

difficulties_bp = Blueprint("difficulties", __name__)


def can_access_task(conn, user, task):
    """
    Détermine si `user` a le droit d'accéder aux difficultés de `task`.

    Conditions cumulatives (n'importe laquelle suffit), indépendantes du
    rôle global de l'utilisateur :
      - admin                                    : accès à tout
      - chef du projet auquel la tâche appartient : accès
      - owner (créateur) de la tâche              : accès
      - responsable assigné à la tâche             : accès

    `task` et `user` sont des dicts. `conn` est une connexion ouverte.
    """
    if user.get("is_admin"):
        return True

    project_id = task.get("project_id")
    if project_id:
        proj = conn.execute(
            "SELECT chef_id FROM projects WHERE id=?", (project_id,)
        ).fetchone()
        if proj and proj["chef_id"] == user["id"]:
            return True

    if task.get("owner_id") is not None and task["owner_id"] == user["id"]:
        return True

    if task.get("responsible") == user.get("name"):
        return True

    return False


@difficulties_bp.route("/", methods=["GET"])
@require_auth
def list_difficulties(current_user):
    """
    GET /api/difficulties/?task_id=T001
    Retourne les difficultés d'une tâche, si l'utilisateur y a accès.
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
    Réservé aux utilisateurs ayant accès à la tâche (admin, chef du projet,
    owner, ou responsable assigné).
    """
    data = request.get_json() or {}
    task_id = (data.get("task_id") or "").strip()
    content = (data.get("content") or "").strip()

    if not task_id or not content:
        return jsonify({"error": "task_id et content requis"}), 400

    conn = get_db()

    task = conn.execute(
        "SELECT * FROM tasks WHERE id=?", (task_id,)
    ).fetchone()
    if not task:
        conn.close()
        return jsonify({"error": "Tâche introuvable"}), 404

    task = dict(task)

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
    Réservé à l'admin, à l'auteur de la difficulté, ou à qui a accès à la tâche
    (chef du projet, owner, responsable).
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

    task = conn.execute("SELECT * FROM tasks WHERE id=?", (diff["task_id"],)).fetchone()
    can_manage = bool(task) and can_access_task(conn, current_user, dict(task))

    if not is_author and not can_manage:
        conn.close()
        return jsonify({"error": "Non autorisé"}), 403

    conn.execute("DELETE FROM task_difficulties WHERE id=?", (did,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": did})