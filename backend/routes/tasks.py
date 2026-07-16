# backend/routes/tasks.py
from flask import Blueprint, request, jsonify
from database import get_db
from datetime import datetime, timezone

tasks_bp = Blueprint("tasks", __name__)


def fetch_task(conn, task_id):
    row = conn.execute(
        """SELECT t.*, p.name as project_name, a.name as activity_name
           FROM tasks t
           LEFT JOIN projects p ON t.project_id = p.id
           LEFT JOIN activities a ON t.activity_id = a.id
           WHERE t.id = ?""",
        (task_id,)
    ).fetchone()
    if not row:
        return None
    task = dict(row)
    deps = conn.execute(
        "SELECT depends_on FROM task_dependencies WHERE task_id=?", (task_id,)
    ).fetchall()
    task["dependencies"] = [d["depends_on"] for d in deps]
    return task


def task_matches_date_filter(task, date_from, date_to, single_date):
    """
    Vérifie si une tâche est active sur une période donnée.
    Une tâche est active si : start_date <= date_to ET end_date/due_date >= date_from
    Si pas de dates sur la tâche → toujours incluse (comportement v1)
    """
    if not date_from and not date_to and not single_date:
        return True

    if single_date:
        date_from = single_date
        date_to = single_date

    t_start = task.get("start_date")
    t_end   = task.get("end_date") or task.get("due_date")

    # Si la tâche n'a pas de dates → on l'inclut toujours
    if not t_start and not t_end:
        return True

    # Si la tâche a une date de début → vérifier qu'elle est avant date_to
    if t_start and date_to and t_start > date_to:
        return False

    # Si la tâche a une date de fin → vérifier qu'elle est après date_from
    if t_end and date_from and t_end < date_from:
        return False

    return True


@tasks_bp.route("/", methods=["GET"])
def list_tasks():
    # ── Paramètres de filtrage ──────────────────────────────────────────────
    show_archived = request.args.get("show_archived", "false").lower() == "true"
    date_from     = request.args.get("date_from")
    date_to       = request.args.get("date_to")
    single_date   = request.args.get("date")
    priority      = request.args.get("priority")
    member        = request.args.get("member")
    project_id    = request.args.get("project_id")
    status        = request.args.get("status")
    search        = request.args.get("search", "").strip().lower()

    conn = get_db()
    rows = conn.execute(
        """SELECT t.*, p.name as project_name, a.name as activity_name
           FROM tasks t
           LEFT JOIN projects p ON t.project_id = p.id
           LEFT JOIN activities a ON t.activity_id = a.id
           ORDER BY t.created_at"""
    ).fetchall()

    tasks = []
    for row in rows:
        task = dict(row)
        deps = conn.execute(
            "SELECT depends_on FROM task_dependencies WHERE task_id=?",
            (task["id"],)
        ).fetchall()
        task["dependencies"] = [d["depends_on"] for d in deps]

        # ── Filtres ────────────────────────────────────────────────────────
        if not show_archived and task.get("is_archived"):
            continue
        if priority and task.get("priority") != priority:
            continue
        if member and task.get("responsible") != member:
            continue
        if project_id and str(task.get("project_id")) != str(project_id):
            continue
        if status and task.get("status") != status:
            continue
        if search and search not in (task.get("description") or "").lower() \
                  and search not in (task.get("id") or "").lower() \
                  and search not in (task.get("project_name") or "").lower() \
                  and search not in (task.get("activity_name") or "").lower():
            continue
        if not task_matches_date_filter(task, date_from, date_to, single_date):
            continue

        tasks.append(task)

    conn.close()
    return jsonify(tasks)


@tasks_bp.route("/", methods=["POST"])
def create_task():
    data = request.get_json()
    task_id     = (data.get("id") or "").strip()
    description = (data.get("description") or "").strip()
    if not task_id or not description:
        return jsonify({"error": "id and description required"}), 400
    conn = get_db()
    try:
        conn.execute(
            """INSERT INTO tasks
               (id, project_id, activity_id, description, duration,
                responsible, status, priority, start_date, end_date,
                due_date, completed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (task_id, data.get("project_id"), data.get("activity_id"),
             description, data.get("duration", 1),
             data.get("responsible", ""), data.get("status", "todo"),
             data.get("priority", "normale"),
             data.get("start_date"), data.get("end_date"),
             data.get("due_date"), data.get("completed_at"))
        )
        for dep in data.get("dependencies", []):
            conn.execute(
                "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on) VALUES (?, ?)",
                (task_id, dep)
            )
        conn.commit()
        task = fetch_task(conn, task_id)
        conn.close()
        return jsonify(task), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


@tasks_bp.route("/<task_id>", methods=["PUT"])
def update_task(task_id):
    data       = request.get_json()
    new_status = data.get("status", "todo")
    completed_at = data.get("completed_at")
    if new_status == "done" and not completed_at:
        completed_at = datetime.now(timezone.utc).isoformat()
    elif new_status != "done":
        completed_at = None

    conn = get_db()
    conn.execute(
        """UPDATE tasks SET project_id=?, activity_id=?, description=?,
           duration=?, responsible=?, status=?, priority=?,
           start_date=?, end_date=?, due_date=?, completed_at=?
           WHERE id=?""",
        (data.get("project_id"), data.get("activity_id"),
         data.get("description", ""), data.get("duration", 1),
         data.get("responsible", ""), new_status,
         data.get("priority", "normale"),
         data.get("start_date"), data.get("end_date"),
         data.get("due_date"), completed_at, task_id)
    )
    conn.execute("DELETE FROM task_dependencies WHERE task_id=?", (task_id,))
    for dep in data.get("dependencies", []):
        conn.execute(
            "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on) VALUES (?, ?)",
            (task_id, dep)
        )
    conn.commit()
    task = fetch_task(conn, task_id)
    conn.close()
    return jsonify(task) if task else (jsonify({"error": "not found"}), 404)


@tasks_bp.route("/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    conn = get_db()
    conn.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": task_id})


@tasks_bp.route("/<task_id>/archive", methods=["PATCH"])
def archive_task(task_id):
    """Archive une tâche — admin uniquement (vérifié côté frontend)."""
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    conn.execute(
        "UPDATE tasks SET is_archived=1, archived_at=? WHERE id=?",
        (now, task_id)
    )
    conn.commit()
    task = fetch_task(conn, task_id)
    conn.close()
    return jsonify(task) if task else (jsonify({"error": "not found"}), 404)


@tasks_bp.route("/<task_id>/unarchive", methods=["PATCH"])
def unarchive_task(task_id):
    """Désarchive une tâche."""
    conn = get_db()
    conn.execute(
        "UPDATE tasks SET is_archived=0, archived_at=NULL WHERE id=?",
        (task_id,)
    )
    conn.commit()
    task = fetch_task(conn, task_id)
    conn.close()
    return jsonify(task) if task else (jsonify({"error": "not found"}), 404)