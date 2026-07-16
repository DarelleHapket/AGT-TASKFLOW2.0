# backend/routes/daily_order.py
from flask import Blueprint, request, jsonify
from database import get_db
from datetime import date
from utils.auth import require_auth, require_admin

daily_order_bp = Blueprint("daily_order", __name__)


@daily_order_bp.route("/", methods=["GET"])
@require_auth
def get_daily_order(current_user):
    """
    GET /api/daily-order/?member_id=X&date=YYYY-MM-DD
    Retourne l'ordre du jour d'un membre pour une date donnée.
    Si pas de date → aujourd'hui.
    Accessible par tous les membres connectés.
    """
    member_id  = request.args.get("member_id", current_user["id"])
    target_date = request.args.get("date", date.today().isoformat())

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
@require_admin
def set_daily_order(current_user):
    """
    POST /api/daily-order/
    Body: { member_id, task_id, date, order_index, note }
    Ajoute ou met à jour une entrée dans l'ordre du jour.
    Réservé à Gabriel (admin).
    """
    data        = request.get_json() or {}
    member_id   = data.get("member_id")
    task_id     = data.get("task_id")
    target_date = data.get("date", date.today().isoformat())
    order_index = data.get("order_index", 0)
    note        = data.get("note", "")

    if not member_id or not task_id:
        return jsonify({"error": "member_id et task_id requis"}), 400

    conn = get_db()
    conn.execute(
        """INSERT INTO daily_task_order
           (member_id, task_id, date, order_index, note)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(member_id, task_id, date)
           DO UPDATE SET order_index=excluded.order_index,
                         note=excluded.note""",
        (member_id, task_id, target_date, order_index, note)
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
@require_admin
def set_daily_order_bulk(current_user):
    """
    POST /api/daily-order/bulk
    Body: { member_id, date, tasks: [{task_id, order_index, note}] }
    Remplace tout l'ordre du jour d'un membre pour une date.
    Réservé à Gabriel (admin).
    """
    data        = request.get_json() or {}
    member_id   = data.get("member_id")
    target_date = data.get("date", date.today().isoformat())
    tasks       = data.get("tasks", [])

    if not member_id:
        return jsonify({"error": "member_id requis"}), 400

    conn = get_db()
    # Supprimer l'ordre existant pour ce membre/date
    conn.execute(
        "DELETE FROM daily_task_order WHERE member_id=? AND date=?",
        (member_id, target_date)
    )
    # Réinsérer dans le nouvel ordre
    for i, t in enumerate(tasks):
        conn.execute(
            """INSERT INTO daily_task_order
               (member_id, task_id, date, order_index, note)
               VALUES (?, ?, ?, ?, ?)""",
            (member_id, t["task_id"], target_date, t.get("order_index", i), t.get("note", ""))
        )
    conn.commit()
    conn.close()
    return jsonify({"success": True, "count": len(tasks)})


@daily_order_bp.route("/<int:oid>", methods=["DELETE"])
@require_admin
def delete_daily_order(oid, current_user):
    """
    DELETE /api/daily-order/<id>
    Supprime une entrée de l'ordre du jour.
    """
    conn = get_db()
    conn.execute("DELETE FROM daily_task_order WHERE id=?", (oid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": oid})