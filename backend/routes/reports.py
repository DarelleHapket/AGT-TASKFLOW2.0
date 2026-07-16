# backend/routes/reports.py
from flask import Blueprint, request, jsonify
from database import get_db
from datetime import date, datetime, timezone
from utils.auth import require_auth

reports_bp = Blueprint("reports", __name__)


def get_date_range(period):
    """Retourne (date_from, date_to) selon la période demandée."""
    today = date.today()
    if period == "today":
        return today.isoformat(), today.isoformat()
    elif period == "week":
        day = today.weekday()
        monday = today.replace(day=today.day - day)
        sunday = monday.replace(day=monday.day + 6)
        return monday.isoformat(), sunday.isoformat()
    elif period == "month":
        first = today.replace(day=1)
        if today.month == 12:
            last = today.replace(year=today.year + 1, month=1, day=1)
        else:
            last = today.replace(month=today.month + 1, day=1)
        last = last.replace(day=last.day - 1)
        return first.isoformat(), last.isoformat()
    return None, None


@reports_bp.route("/data/", methods=["GET"])
@require_auth
def get_report_data(current_user):
    """
    GET /api/reports/data/?period=week&member_id=X&date_from=Y&date_to=Z
    Retourne les données JSON structurées pour génération PDF frontend.
    Accessible à tous les membres connectés.
    """
    period    = request.args.get("period", "week")
    member_id = request.args.get("member_id")
    date_from = request.args.get("date_from")
    date_to   = request.args.get("date_to")

    # Si pas de plage perso → calculer selon période
    if not date_from or not date_to:
        date_from, date_to = get_date_range(period)

    conn = get_db()

    # ── Récupérer les membres concernés ─────────────────────────────────────
    if member_id:
        members = conn.execute(
            "SELECT * FROM members WHERE id=?", (member_id,)
        ).fetchall()
    else:
        members = conn.execute(
            "SELECT * FROM members ORDER BY name"
        ).fetchall()

    report_data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": current_user["name"],
        "period": period,
        "date_from": date_from,
        "date_to": date_to,
        "members": []
    }

    for member in members:
        m = dict(member)
        m_name = m["name"]

        # ── Tâches assignées au membre ───────────────────────────────────
        all_tasks = conn.execute(
            """SELECT t.*, p.name as project_name, a.name as activity_name
               FROM tasks t
               LEFT JOIN projects p ON t.project_id = p.id
               LEFT JOIN activities a ON t.activity_id = a.id
               WHERE t.responsible = ? AND t.is_archived = 0""",
            (m_name,)
        ).fetchall()
        all_tasks = [dict(t) for t in all_tasks]

        # ── Tâches terminées sur la période ─────────────────────────────
        done_tasks = [t for t in all_tasks
                      if t["status"] == "done"
                      and t.get("completed_at")
                      and (not date_from or t["completed_at"][:10] >= date_from)
                      and (not date_to   or t["completed_at"][:10] <= date_to)]

        # ── Tâches en cours ──────────────────────────────────────────────
        in_progress = [t for t in all_tasks if t["status"] == "in_progress"]

        # ── Tâches bloquées ──────────────────────────────────────────────
        blocked = [t for t in all_tasks if t["status"] == "blocked"]

        # ── Tâches en retard ─────────────────────────────────────────────
        today_str = date.today().isoformat()
        overdue = [t for t in all_tasks
                   if t.get("due_date")
                   and t["due_date"] < today_str
                   and t["status"] != "done"]

        # ── Difficultés signalées ────────────────────────────────────────
        difficulties = []
        for t in all_tasks:
            diffs = conn.execute(
                """SELECT d.*, mem.name as member_name
                   FROM task_difficulties d
                   JOIN members mem ON d.member_id = mem.id
                   WHERE d.task_id = ?
                   ORDER BY d.created_at DESC""",
                (t["id"],)
            ).fetchall()
            if diffs:
                difficulties.append({
                    "task_id": t["id"],
                    "task_description": t["description"],
                    "items": [dict(d) for d in diffs]
                })

        report_data["members"].append({
            "id":           m["id"],
            "name":         m_name,
            "color":        m.get("color", "#6366f1"),
            "summary": {
                "total_assigned":   len(all_tasks),
                "total_done":       len(done_tasks),
                "total_in_progress": len(in_progress),
                "total_blocked":    len(blocked),
                "total_overdue":    len(overdue),
                "total_coupons":    sum(t["duration"] for t in done_tasks),
            },
            "done_tasks":       done_tasks,
            "in_progress_tasks": in_progress,
            "blocked_tasks":    blocked,
            "overdue_tasks":    overdue,
            "difficulties":     difficulties,
        })

    conn.close()
    return jsonify(report_data)