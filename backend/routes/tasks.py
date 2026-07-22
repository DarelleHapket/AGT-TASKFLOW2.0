# backend/routes/tasks.py
#
# A-04 — Refonte du modèle de permissions (owner/chef/responsable)
# A-06 — Notifications à la création
# A-07 — Intégration RBAC project_members :
#   • get_permission_level délégué à permissions.get_task_permission_level
#   • GET /  → filtre P3 : is_task_visible (membership projet)
#   • POST / → validate_task_creation (membership + rôle owner/manager + responsible membre)
#
# Permission par tâche (champ `permission` dans la réponse) :
#   full        : créateur OU owner/manager du projet
#   status_only : contributor ET responsable de la tâche
#   read_only   : tout le reste (admin inclus)

from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_auth
from utils.pert import compute_pert, CycleError
from utils.permissions import (
    get_task_permission_level,
    is_task_visible,
    get_user_project_ids,
    validate_task_creation,
)
from datetime import datetime, timezone

tasks_bp = Blueprint("tasks", __name__)

# ── Messages d'erreur ────────────────────────────────────────────────────────
_ADMIN_READ_ONLY = "L'administrateur dispose d'un accès en lecture seule sur les tâches."
_NOT_AUTHORIZED  = "Vous n'êtes pas autorisé à modifier cette tâche."
_STATUS_ONLY     = "En tant que responsable, vous ne pouvez modifier que le statut de cette tâche."
_TASK_NOT_FOUND  = "Tâche introuvable."


# ══════════════════════════════════════════════════════════════════════════════
# Helpers de lecture
# ══════════════════════════════════════════════════════════════════════════════

def fetch_task(conn, task_id):
    row = conn.execute("""
        SELECT t.*, p.name AS project_name, a.name AS activity_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN activities a ON t.activity_id = a.id
        WHERE t.id = ?
    """, (task_id,)).fetchone()
    if not row:
        return None
    task = dict(row)
    deps = conn.execute(
        "SELECT depends_on FROM task_dependencies WHERE task_id = ?", (task_id,)
    ).fetchall()
    task["dependencies"] = [d["depends_on"] for d in deps]
    return task


def task_matches_date_filter(task, date_from, date_to, single_date):
    """Vérifie si une tâche est active sur une période donnée."""
    if not date_from and not date_to and not single_date:
        return True
    if single_date:
        date_from = date_to = single_date
    t_start = task.get("start_date")
    t_end   = task.get("end_date") or task.get("due_date")
    if not t_start and not t_end:
        return True
    if t_start and date_to   and t_start > date_to:   return False
    if t_end   and date_from and t_end   < date_from:  return False
    return True


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/tasks/
# ══════════════════════════════════════════════════════════════════════════════
# A-07 — Filtre P3 : is_task_visible
#
# Phase 1 : charger TOUTES les tâches (PERT doit être calculé sur le graphe complet)
# Phase 2 : calculer PERT sur le graphe complet
# Phase 3 : filtrer par visibilité (P3) puis par les filtres utilisateur
# Phase 4 : fusionner les champs PERT

@tasks_bp.route("/", methods=["GET"])
@require_auth
def list_tasks(current_user):
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

    # ── Pré-calcul des projets dont l'utilisateur est membre ─────────────────
    # Une seule requête pour tous les tests de visibilité (performance).
    member_project_ids = (
        set()  # Admin : filtre géré dans is_task_visible (voit tout)
        if current_user.get("is_admin")
        else get_user_project_ids(conn, current_user["id"])
    )

    rows = conn.execute("""
        SELECT t.*, p.name AS project_name, a.name AS activity_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN activities a ON t.activity_id = a.id
        ORDER BY t.created_at
    """).fetchall()

    # ── Phase 1 : construire TOUTES les tâches (PERT sur graphe complet) ─────
    all_tasks = []
    for row in rows:
        task = dict(row)
        deps = conn.execute(
            "SELECT depends_on FROM task_dependencies WHERE task_id = ?",
            (task["id"],)
        ).fetchall()
        task["dependencies"] = [d["depends_on"] for d in deps]
        task["permission"]   = get_task_permission_level(conn, current_user, task)
        all_tasks.append(task)

    conn.close()

    # ── Phase 2 : calcul PERT ────────────────────────────────────────────────
    pert_cycle_ids = None
    try:
        pert_data = compute_pert(all_tasks)
    except CycleError as e:
        pert_data      = {}
        pert_cycle_ids = e.cycle_ids

    # ── Phase 3 & 4 : filtre visibilité + filtres utilisateur + fusion PERT ──
    _NULL_PERT = {"es": None, "ef": None, "ls": None, "lf": None,
                  "slack": None, "critical": False}

    tasks = []
    for task in all_tasks:
        # P3 — visibilité selon membership projet
        if not is_task_visible(task, current_user, member_project_ids):
            continue

        # Filtres UI classiques
        if not show_archived and task.get("is_archived"):
            continue
        if priority   and task.get("priority")   != priority:
            continue
        if member     and task.get("responsible") != member:
            continue
        if project_id and str(task.get("project_id")) != str(project_id):
            continue
        if status     and task.get("status") != status:
            continue
        if search and search not in (task.get("description") or "").lower() \
                  and search not in (task.get("id") or "").lower() \
                  and search not in (task.get("project_name") or "").lower() \
                  and search not in (task.get("activity_name") or "").lower():
            continue
        if not task_matches_date_filter(task, date_from, date_to, single_date):
            continue

        # Fusion PERT (D-05)
        pert = pert_data.get(task["id"], _NULL_PERT)
        task.update({
            "es":       pert.get("es"),
            "ef":       pert.get("ef"),
            "ls":       pert.get("ls"),
            "lf":       pert.get("lf"),
            "slack":    pert.get("slack"),
            "critical": pert.get("critical", False),
        })

        tasks.append(task)

    if pert_cycle_ids is not None:
        return jsonify({"tasks": tasks, "pert_cycle_ids": pert_cycle_ids}), 200

    return jsonify(tasks)


# ══════════════════════════════════════════════════════════════════════════════
# POST /api/tasks/
# ══════════════════════════════════════════════════════════════════════════════
# A-07 — Validations étendues si project_id fourni :
#   1. Le projet existe
#   2. Le créateur est membre du projet
#   3. Le créateur est owner ou manager
#   4. Si responsible fourni : il est membre du projet

@tasks_bp.route("/", methods=["POST"])
@require_auth
def create_task(current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    data        = request.get_json()
    task_id     = (data.get("id") or "").strip()
    description = (data.get("description") or "").strip()

    if not task_id or not description:
        return jsonify({"error": "L'identifiant et la description sont obligatoires."}), 400

    conn = get_db()

    # ── Validations de permission sur le projet (A-07) ────────────────────────
    ok, err_msg, err_code = validate_task_creation(conn, current_user, data)
    if not ok:
        conn.close()
        return jsonify({"error": err_msg}), err_code

    try:
        conn.execute("""
            INSERT INTO tasks
                (id, project_id, activity_id, description, duration,
                 responsible, status, priority, start_date, end_date,
                 due_date, completed_at, owner_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            task_id,
            data.get("project_id"),
            data.get("activity_id"),
            description,
            data.get("duration", 1),
            data.get("responsible", ""),
            data.get("status", "todo"),
            data.get("priority", "normale"),
            data.get("start_date"),
            data.get("end_date"),
            data.get("due_date"),
            data.get("completed_at"),
            current_user["id"],
        ))

        for dep in data.get("dependencies", []):
            conn.execute(
                "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on) VALUES (?, ?)",
                (task_id, dep)
            )
        conn.commit()

        # Notification au responsable désigné (A-06)
        responsible_name = (data.get("responsible") or "").strip()
        if responsible_name:
            from utils.notif import notify as _notify
            member_row = conn.execute(
                "SELECT id FROM members WHERE LOWER(name) = LOWER(?)",
                (responsible_name,)
            ).fetchone()
            if member_row and member_row["id"] != current_user["id"]:
                _notify(
                    conn,
                    recipient_id=member_row["id"],
                    sender_id=current_user["id"],
                    type_="task_assigned",
                    title=f"Tâche assignée : {task_id}",
                    body=f"{current_user['name']} vous a désigné responsable de la tâche « {description} ».",
                    task_id=task_id,
                )
                conn.commit()

        task = fetch_task(conn, task_id)
        task["permission"] = get_task_permission_level(conn, current_user, task)
        conn.close()
        return jsonify(task), 201

    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


# ══════════════════════════════════════════════════════════════════════════════
# PUT /api/tasks/<task_id>
# ══════════════════════════════════════════════════════════════════════════════

@tasks_bp.route("/<task_id>", methods=["PUT"])
@require_auth
def update_task(task_id, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    conn = get_db()
    task = fetch_task(conn, task_id)
    if not task:
        conn.close()
        return jsonify({"error": _TASK_NOT_FOUND}), 404

    permission = get_task_permission_level(conn, current_user, task)
    if permission == "read_only":
        conn.close()
        return jsonify({"error": _NOT_AUTHORIZED}), 403

    data = request.get_json()

    if permission == "full":
        new_status   = data.get("status", "todo")
        completed_at = data.get("completed_at")
        if new_status == "done" and not completed_at:
            completed_at = datetime.now(timezone.utc).isoformat()
        elif new_status != "done":
            completed_at = None

        conn.execute("""
            UPDATE tasks SET
                project_id=?, activity_id=?, description=?,
                duration=?, responsible=?, status=?, priority=?,
                start_date=?, end_date=?, due_date=?, completed_at=?
            WHERE id=?
        """, (
            data.get("project_id"), data.get("activity_id"),
            data.get("description", ""), data.get("duration", 1),
            data.get("responsible", ""), new_status,
            data.get("priority", "normale"),
            data.get("start_date"), data.get("end_date"),
            data.get("due_date"), completed_at, task_id,
        ))
        conn.execute("DELETE FROM task_dependencies WHERE task_id = ?", (task_id,))
        for dep in data.get("dependencies", []):
            conn.execute(
                "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on) VALUES (?, ?)",
                (task_id, dep)
            )

    else:  # status_only
        new_status = data.get("status")
        if new_status is None:
            conn.close()
            return jsonify({"error": _STATUS_ONLY}), 400
        completed_at = datetime.now(timezone.utc).isoformat() if new_status == "done" else None
        conn.execute(
            "UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?",
            (new_status, completed_at, task_id)
        )

    conn.commit()
    updated = fetch_task(conn, task_id)
    if updated:
        updated["permission"] = get_task_permission_level(conn, current_user, updated)
    conn.close()
    return jsonify(updated) if updated else (jsonify({"error": _TASK_NOT_FOUND}), 404)


# ══════════════════════════════════════════════════════════════════════════════
# DELETE /api/tasks/<task_id>
# ══════════════════════════════════════════════════════════════════════════════

@tasks_bp.route("/<task_id>", methods=["DELETE"])
@require_auth
def delete_task(task_id, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    conn = get_db()
    task = fetch_task(conn, task_id)
    if not task:
        conn.close()
        return jsonify({"error": _TASK_NOT_FOUND}), 404

    if get_task_permission_level(conn, current_user, task) != "full":
        conn.close()
        return jsonify({"error": _NOT_AUTHORIZED}), 403

    conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": task_id})


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /api/tasks/<task_id>/archive  &  /unarchive
# ══════════════════════════════════════════════════════════════════════════════

@tasks_bp.route("/<task_id>/archive", methods=["PATCH"])
@require_auth
def archive_task(task_id, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    conn = get_db()
    task = fetch_task(conn, task_id)
    if not task:
        conn.close()
        return jsonify({"error": _TASK_NOT_FOUND}), 404

    if get_task_permission_level(conn, current_user, task) != "full":
        conn.close()
        return jsonify({"error": _NOT_AUTHORIZED}), 403

    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "UPDATE tasks SET is_archived = 1, archived_at = ? WHERE id = ?",
        (now, task_id)
    )
    conn.commit()
    updated = fetch_task(conn, task_id)
    if updated:
        updated["permission"] = get_task_permission_level(conn, current_user, updated)
    conn.close()
    return jsonify(updated) if updated else (jsonify({"error": _TASK_NOT_FOUND}), 404)


@tasks_bp.route("/<task_id>/unarchive", methods=["PATCH"])
@require_auth
def unarchive_task(task_id, current_user):
    if current_user.get("is_admin"):
        return jsonify({"error": _ADMIN_READ_ONLY}), 403

    conn = get_db()
    task = fetch_task(conn, task_id)
    if not task:
        conn.close()
        return jsonify({"error": _TASK_NOT_FOUND}), 404

    if get_task_permission_level(conn, current_user, task) != "full":
        conn.close()
        return jsonify({"error": _NOT_AUTHORIZED}), 403

    conn.execute(
        "UPDATE tasks SET is_archived = 0, archived_at = NULL WHERE id = ?",
        (task_id,)
    )
    conn.commit()
    updated = fetch_task(conn, task_id)
    if updated:
        updated["permission"] = get_task_permission_level(conn, current_user, updated)
    conn.close()
    return jsonify(updated) if updated else (jsonify({"error": _TASK_NOT_FOUND}), 404)