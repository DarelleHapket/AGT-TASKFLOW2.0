# backend/routes/reports.py
from flask import Blueprint, request, jsonify
from database import get_db
from datetime import date, datetime, timezone, timedelta
from utils.auth import require_auth

reports_bp = Blueprint("reports", __name__)


def _user_role(user):
    """Rôle effectif, avec repli sur is_admin (cohérent avec le reste du projet)."""
    return user.get("role") or ("admin" if user.get("is_admin") else "membre")


def get_date_range(period):
    """Retourne (date_from, date_to) selon la période demandée."""
    today = date.today()
    if period == "today":
        return today.isoformat(), today.isoformat()
    elif period == "week":
        monday = today - timedelta(days=today.weekday())
        sunday = monday + timedelta(days=6)
        return monday.isoformat(), sunday.isoformat()
    elif period == "month":
        first = today.replace(day=1)
        if today.month == 12:
            next_first = today.replace(year=today.year + 1, month=1, day=1)
        else:
            next_first = today.replace(month=today.month + 1, day=1)
        last = next_first - timedelta(days=1)
        return first.isoformat(), last.isoformat()
    return None, None


@reports_bp.route("/data/", methods=["GET"])
@require_auth
def get_report_data(current_user):
    """
    GET /api/reports/data/?period=week&member_id=X&date_from=Y&date_to=Z
    Rapport groupé par membre.
    Filtrage par rôle :
      - admin       : tous les membres
      - chef_projet : les membres ayant une tâche dans un de ses projets (+ lui-même)
      - membre      : lui-même uniquement
    """
    period    = request.args.get("period", "week")
    member_id = request.args.get("member_id")
    date_from = request.args.get("date_from")
    date_to   = request.args.get("date_to")

    if not date_from or not date_to:
        date_from, date_to = get_date_range(period)

    conn = get_db()

    # ── Filtrage par rôle (RBAC) ────────────────────────────────────────────
    role = _user_role(current_user)
    if role == "admin":
        allowed_ids = None  # pas de restriction
    elif role == "chef_projet":
        rows = conn.execute(
            """SELECT DISTINCT m.id
               FROM members m
               JOIN tasks t    ON t.responsible = m.name
               JOIN projects p ON t.project_id = p.id
               WHERE p.chef_id = ?""",
            (current_user["id"],)
        ).fetchall()
        allowed_ids = {r["id"] for r in rows}
        allowed_ids.add(current_user["id"])
    else:  # membre
        allowed_ids = {current_user["id"]}

    # Un membre ne peut jamais demander le rapport d'un autre
    if allowed_ids is not None and member_id:
        if int(member_id) not in allowed_ids:
            conn.close()
            return jsonify({"error": "Accès non autorisé à ce membre"}), 403

    # ── Récupérer les membres concernés ─────────────────────────────────────
    if member_id:
        members = conn.execute("SELECT * FROM members WHERE id=?", (member_id,)).fetchall()
    elif allowed_ids is None:
        members = conn.execute("SELECT * FROM members ORDER BY name").fetchall()
    else:
        placeholders = ",".join("?" for _ in allowed_ids)
        members = conn.execute(
            f"SELECT * FROM members WHERE id IN ({placeholders}) ORDER BY name",
            tuple(allowed_ids)
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

        all_tasks = conn.execute(
            """SELECT t.*, p.name as project_name, a.name as activity_name
               FROM tasks t
               LEFT JOIN projects p ON t.project_id = p.id
               LEFT JOIN activities a ON t.activity_id = a.id
               WHERE t.responsible = ? AND t.is_archived = 0""",
            (m_name,)
        ).fetchall()
        all_tasks = [dict(t) for t in all_tasks]

        done_tasks = [t for t in all_tasks
                      if t["status"] == "done"
                      and t.get("completed_at")
                      and (not date_from or t["completed_at"][:10] >= date_from)
                      and (not date_to   or t["completed_at"][:10] <= date_to)]
        in_progress = [t for t in all_tasks if t["status"] == "in_progress"]
        blocked     = [t for t in all_tasks if t["status"] == "blocked"]

        today_str = date.today().isoformat()
        overdue = [t for t in all_tasks
                   if t.get("due_date") and t["due_date"] < today_str and t["status"] != "done"]

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
                    "project_name": t.get("project_name") or "Sans projet",
                    "items": [dict(d) for d in diffs]
                })

        report_data["members"].append({
            "id":    m["id"],
            "name":  m_name,
            "color": m.get("color", "#6366f1"),
            "summary": {
                "total_assigned":    len(all_tasks),
                "total_done":        len(done_tasks),
                "total_in_progress": len(in_progress),
                "total_blocked":     len(blocked),
                "total_overdue":     len(overdue),
                "total_coupons":     sum((t.get("duration", 0) or 0) for t in done_tasks),
            },
            "done_tasks":        done_tasks,
            "in_progress_tasks": in_progress,
            "blocked_tasks":     blocked,
            "overdue_tasks":     overdue,
            "difficulties":      difficulties,
        })

    conn.close()
    return jsonify(report_data)


@reports_bp.route("/project/", methods=["GET"])
@require_auth
def get_project_report(current_user):
    """
    GET /api/reports/project/?project_id=X&period=week&date_from=Y&date_to=Z
    Rapport groupé PAR PROJET. Réservé à admin et chef_projet.
      - admin : n'importe quel projet
      - chef  : uniquement ses projets (projects.chef_id = lui)
      - membre : interdit (403)
    """
    role = _user_role(current_user)
    if role not in ("admin", "chef_projet"):
        return jsonify({"error": "Rapport par projet réservé aux chefs de projet et à l'admin"}), 403

    project_id = request.args.get("project_id")
    period     = request.args.get("period", "week")
    date_from  = request.args.get("date_from")
    date_to    = request.args.get("date_to")
    if not date_from or not date_to:
        date_from, date_to = get_date_range(period)

    if not project_id:
        return jsonify({"error": "project_id requis"}), 400

    conn = get_db()

    project = conn.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
    if not project:
        conn.close()
        return jsonify({"error": "Projet introuvable"}), 404
    project = dict(project)

    if role == "chef_projet" and project.get("chef_id") != current_user["id"]:
        conn.close()
        return jsonify({"error": "Ce projet n'est pas dans votre périmètre"}), 403

    chef_name = None
    if project.get("chef_id"):
        chef = conn.execute("SELECT name FROM members WHERE id=?", (project["chef_id"],)).fetchone()
        chef_name = chef["name"] if chef else None

    tasks = conn.execute(
        """SELECT t.*, a.name as activity_name
           FROM tasks t
           LEFT JOIN activities a ON t.activity_id = a.id
           WHERE t.project_id = ? AND t.is_archived = 0""",
        (project_id,)
    ).fetchall()
    tasks = [dict(t) for t in tasks]

    today_str = date.today().isoformat()
    done        = [t for t in tasks if t["status"] == "done"]
    in_progress = [t for t in tasks if t["status"] == "in_progress"]
    blocked     = [t for t in tasks if t["status"] == "blocked"]
    overdue     = [t for t in tasks
                   if t.get("due_date") and t["due_date"] < today_str and t["status"] != "done"]

    by_member = {}
    for t in tasks:
        who = t.get("responsible") or "—"
        by_member.setdefault(who, {"name": who, "total": 0, "done": 0, "coupons": 0})
        by_member[who]["total"] += 1
        if t["status"] == "done":
            by_member[who]["done"] += 1
            by_member[who]["coupons"] += (t.get("duration", 0) or 0)

    difficulties = []
    for t in tasks:
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
                "project_name": project["name"],
                "items": [dict(d) for d in diffs],
            })

    conn.close()
    return jsonify({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": current_user["name"],
        "period": period,
        "date_from": date_from,
        "date_to": date_to,
        "project": {
            "id":   project["id"],
            "name": project["name"],
            "description": project.get("description", ""),
            "chef_name": chef_name,
        },
        "summary": {
            "total_tasks":       len(tasks),
            "total_done":        len(done),
            "total_in_progress": len(in_progress),
            "total_blocked":     len(blocked),
            "total_overdue":     len(overdue),
            "total_coupons":     sum((t.get("duration", 0) or 0) for t in done),
        },
        "members":           list(by_member.values()),
        "done_tasks":        done,
        "in_progress_tasks": in_progress,
        "blocked_tasks":     blocked,
        "overdue_tasks":     overdue,
        "difficulties":      difficulties,
    })