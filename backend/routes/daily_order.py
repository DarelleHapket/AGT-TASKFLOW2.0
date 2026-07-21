# backend/routes/daily_order.py
from flask import Blueprint, request, jsonify
from database import get_db
from datetime import date
from utils.auth import require_auth

daily_order_bp = Blueprint("daily_order", __name__)


def _user_role(user):
    return user.get("role") or ("admin" if user.get("is_admin") else "membre")


def _can_edit(current_user, member_id):
    """
    Un membre ne peut modifier QUE sa propre journée.
    L'admin/chef ne modifient PAS la journée d'un membre (lecture seule) —
    Ma Journée est personnelle. On autorise donc uniquement le propriétaire.
    """
    return str(current_user["id"]) == str(member_id)


@daily_order_bp.route("/", methods=["GET"])
@require_auth
def get_daily_order(current_user):
    """
    GET /api/daily-order/?member_id=X&date=YYYY-MM-DD
    Retourne l'ordre du jour d'un membre pour une date donnée.
    Lecture : le membre voit la sienne ; admin/chef peuvent consulter celle
    d'un membre (lecture seule).
    """
    member_id   = request.args.get("member_id", current_user["id"])
    target_date = request.args.get("date", date.today().isoformat())

    role = _user_role(current_user)
    # Un simple membre ne peut lire que sa propre journée
    if role == "membre" and str(member_id) != str(current_user["id"]):
        return jsonify({"error": "Accès non autorisé"}), 403

    conn = get_db()
    rows = conn.execute(
        """SELECT dto.*, t.description, t.status, t.priority,
                  t.responsible, t.due_date,
                  p.name as project_name, a.name as activity_name
           FROM daily_task_order dto
           JOIN tasks t ON dto.task_id = t.id
           LEFT JOIN projects p ON t.project_id = p.id
           LEFT JOIN activities a ON t.activity_id = a.id
           WHERE dto.member_id = ? AND dto.date = ?
           ORDER BY dto.order_index ASC""",
        (member_id, target_date)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@daily_order_bp.route("/", methods=["POST"])
@require_auth
def set_daily_order(current_user):
    """
    POST /api/daily-order/
    Body: { member_id, task_id, date, order_index, note, start_time, duration_min }
    Ajoute ou met à jour une entrée. Le membre gère uniquement SA journée.
    """
    data        = request.get_json() or {}
    member_id   = data.get("member_id", current_user["id"])
    task_id     = data.get("task_id")
    target_date = data.get("date", date.today().isoformat())
    order_index = data.get("order_index", 0)
    note        = data.get("note", "")
    start_time  = data.get("start_time")
    duration_min = data.get("duration_min")

    if not task_id:
        return jsonify({"error": "task_id requis"}), 400
    if not _can_edit(current_user, member_id):
        return jsonify({"error": "Vous ne pouvez modifier que votre propre journée"}), 403

    conn = get_db()
    conn.execute(
        """INSERT INTO daily_task_order
           (member_id, task_id, date, order_index, note, start_time, duration_min)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(member_id, task_id, date)
           DO UPDATE SET order_index=excluded.order_index,
                         note=excluded.note,
                         start_time=excluded.start_time,
                         duration_min=excluded.duration_min""",
        (member_id, task_id, target_date, order_index, note, start_time, duration_min)
    )
    conn.commit()

    row = conn.execute(
        """SELECT dto.*, t.description, t.status, t.priority,
                  t.responsible, t.due_date,
                  p.name as project_name, a.name as activity_name
           FROM daily_task_order dto
           JOIN tasks t ON dto.task_id = t.id
           LEFT JOIN projects p ON t.project_id = p.id
           LEFT JOIN activities a ON t.activity_id = a.id
           WHERE dto.member_id=? AND dto.task_id=? AND dto.date=?""",
        (member_id, task_id, target_date)
    ).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@daily_order_bp.route("/bulk", methods=["POST"])
@require_auth
def set_daily_order_bulk(current_user):
    """
    POST /api/daily-order/bulk
    Body: { member_id, date, tasks: [{task_id, order_index, note, start_time, duration_min}] }
    Remplace tout l'ordre du jour du membre pour une date. Sa journée uniquement.
    """
    data        = request.get_json() or {}
    member_id   = data.get("member_id", current_user["id"])
    target_date = data.get("date", date.today().isoformat())
    tasks       = data.get("tasks", [])

    if not _can_edit(current_user, member_id):
        return jsonify({"error": "Vous ne pouvez modifier que votre propre journée"}), 403

    conn = get_db()
    conn.execute(
        "DELETE FROM daily_task_order WHERE member_id=? AND date=?",
        (member_id, target_date)
    )
    for i, t in enumerate(tasks):
        conn.execute(
            """INSERT INTO daily_task_order
               (member_id, task_id, date, order_index, note, start_time, duration_min)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (member_id, t["task_id"], target_date, t.get("order_index", i),
             t.get("note", ""), t.get("start_time"), t.get("duration_min"))
        )
    conn.commit()
    conn.close()
    return jsonify({"success": True, "count": len(tasks)})


@daily_order_bp.route("/<int:oid>", methods=["DELETE"])
@require_auth
def delete_daily_order(oid, current_user):
    """
    DELETE /api/daily-order/<id>
    Supprime une entrée — uniquement si elle appartient au membre courant.
    """
    conn = get_db()
    row = conn.execute("SELECT member_id FROM daily_task_order WHERE id=?", (oid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Entrée introuvable"}), 404
    if not _can_edit(current_user, row["member_id"]):
        conn.close()
        return jsonify({"error": "Vous ne pouvez modifier que votre propre journée"}), 403

    conn.execute("DELETE FROM daily_task_order WHERE id=?", (oid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": oid})