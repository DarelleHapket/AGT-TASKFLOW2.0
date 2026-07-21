# backend/routes/tasks.py
#
# A-04 — Refonte du modèle de permissions sur les tâches :
#
#   Rôles possibles sur une tâche donnée (non exclusifs) :
#     - owner        : créateur de la tâche (task.owner_id == user.id)
#     - chef_projet  : chef du projet auquel la tâche est rattachée
#     - responsible  : membre assigné à la tâche (task.responsible == user.name)
#
#   Droits :
#     - can_full_edit   = owner OU chef_projet
#                         → PUT complet, DELETE, archive, unarchive
#     - responsible seul (ni owner ni chef_projet)
#                         → PUT restreint au champ `status` uniquement
#     - aucun rôle        → lecture seule (aucune écriture)
#
#   Création (POST) : tout membre authentifié non-admin peut créer une tâche,
#   y compris sans projet. Le créateur devient automatiquement owner_id.
#
#   Admin : lecture seule sur toutes les tâches (inchangé, CDC BF-08/BNF-05).

from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_auth
from utils.pert import compute_pert, CycleError
from datetime import datetime, timezone

tasks_bp = Blueprint("tasks", __name__)

# ── Messages d'erreur ────────────────────────────────────────────────────────
_ADMIN_READ_ONLY   = "L'administrateur dispose d'un accès en lecture seule sur les tâches."
_NOT_AUTHORIZED    = "Vous n'êtes pas autorisé à modifier cette tâche."
_STATUS_ONLY       = "En tant que responsable, vous ne pouvez modifier que le statut de cette tâche."
_TASK_NOT_FOUND    = "Tâche introuvable."

# Champs qu'un responsable (non owner, non chef) est autorisé à modifier via PUT
_RESPONSIBLE_EDITABLE_FIELDS = {"status"}


# ══════════════════════════════════════════════════════════════════════════
# Helpers de permission
# ══════════════════════════════════════════════════════════════════════════

def is_chef_of_project(conn, user_id, project_id):
    """True si user_id est le chef_id du projet donné. False si project_id est None."""
    if not project_id:
        return False
    row = conn.execute(
        "SELECT chef_id FROM projects WHERE id = ?", (project_id,)
    ).fetchone()
    return bool(row and row["chef_id"] == user_id)


def is_owner(task, user_id):
    """True si l'utilisateur est le créateur de la tâche."""
    return task.get("owner_id") is not None and task["owner_id"] == user_id


def is_responsible(task, user_name):
    """True si l'utilisateur est le membre assigné à la tâche (comparaison sur le nom)."""
    responsible = (task.get("responsible") or "").strip().lower()
    name        = (user_name or "").strip().lower()
    return bool(responsible) and responsible == name


def can_full_edit(conn, current_user, task):
    """
    Droit d'édition complète : owner OU chef du projet de la tâche.
    Donne accès à PUT (tous champs), DELETE, archive, unarchive.
    """
    if is_owner(task, current_user["id"]):
        return True
    if is_chef_of_project(conn, current_user["id"], task.get("project_id")):
        return True
    return False


def get_permission_level(conn, current_user, task):
    """
    Calcule le niveau de permission de l'utilisateur courant sur une tâche.
    Retourne l'une des chaînes : "full", "status_only", "read_only".
    """
    if can_full_edit(conn, current_user, task):
        return "full"
    if is_responsible(task, current_user.get("name")):
        return "status_only"
    return "read_only"


# ══════════════════════════════════════════════════════════════════════════
# Lecture des tâches
# ══════════════════════════════════════════════════════════════════════════

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
        date_to   = single_date

    t_start = task.get("start_date")
    t_end   = task.get("end_date") or task.get("due_date")

    if not t_start and not t_end:
        return True

    if t_start and date_to and t_start > date_to:
        return False

    if t_end and date_from and t_end < date_from:
        return False

    return True


# ── GET /api/tasks/ ──────────────────────────────────────────────────────────
# CDC BF-12 : tout utilisateur authentifié peut filtrer et lister les tâches.
# Admin inclus (lecture seule).
#
# Chaque tâche renvoyée embarque un champ `permission` ("full" | "status_only" |
# "read_only") calculé pour l'utilisateur courant, afin que le frontend puisse
# adapter l'UI sans dupliquer la logique de permission.
#
# D-05 : les champs PERT (es, ef, ls, lf, slack, critical) sont calculés
# par le backend sur la totalité des tâches, puis fusionnés dans chaque tâche
# de la réponse. En cas de cycle, les champs PERT sont null et un champ
# 'pert_cycle_ids' est ajouté à la réponse (liste des IDs impliqués).

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
    rows = conn.execute(
        """SELECT t.*, p.name as project_name, a.name as activity_name
           FROM tasks t
           LEFT JOIN projects p ON t.project_id = p.id
           LEFT JOIN activities a ON t.activity_id = a.id
           ORDER BY t.created_at"""
    ).fetchall()

    # ── Phase 1 : construire TOUTES les tâches (non filtrées) ────────────────
    # Le PERT doit être calculé sur le graphe complet. Filtrer avant fausserait
    # les passes avant/arrière (des prédécesseurs seraient manquants).
    all_tasks = []
    for row in rows:
        task = dict(row)
        deps = conn.execute(
            "SELECT depends_on FROM task_dependencies WHERE task_id=?",
            (task["id"],)
        ).fetchall()
        task["dependencies"] = [d["depends_on"] for d in deps]
        task["permission"]   = get_permission_level(conn, current_user, task)
        all_tasks.append(task)

    conn.close()

    # ── Phase 2 : calcul PERT sur le graphe complet ──────────────────────────
    pert_cycle_ids = None
    try:
        pert_data = compute_pert(all_tasks)
    except CycleError as e:
        pert_data      = {}
        pert_cycle_ids = e.cycle_ids

    # ── Phase 3 : filtrer et fusionner les champs PERT ───────────────────────
    _NULL_PERT = {"es": None, "ef": None, "ls": None, "lf": None,
                  "slack": None, "critical": False}

    tasks = []
    for task in all_tasks:
        # Filtres (identiques à la v précédente)
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

        # Fusion des champs PERT (D-05)
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

    # En cas de cycle : on retourne quand même les tâches (avec PERT null)
    # + un champ d'avertissement pour que le frontend puisse afficher un message.
    if pert_cycle_ids is not None:
        return jsonify({
            "tasks":          tasks,
            "pert_cycle_ids": pert_cycle_ids,
        }), 200

    return jsonify(tasks)


# ── POST /api/tasks/ ─────────────────────────────────────────────────────────
# Tout membre authentifié non-admin peut créer une tâche, avec ou sans projet.
# Le créateur devient automatiquement owner_id de la tâche.

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
    try:
        conn.execute(
            """INSERT INTO tasks
               (id, project_id, activity_id, description, duration,
                responsible, status, priority, start_date, end_date,
                due_date, completed_at, owner_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (task_id, data.get("project_id"), data.get("activity_id"),
             description, data.get("duration", 1),
             data.get("responsible", ""), data.get("status", "todo"),
             data.get("priority", "normale"),
             data.get("start_date"), data.get("end_date"),
             data.get("due_date"), data.get("completed_at"),
             current_user["id"])
        )
        for dep in data.get("dependencies", []):
            conn.execute(
                "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on) VALUES (?, ?)",
                (task_id, dep)
            )
        conn.commit()

        # A-06 — Notification au responsable désigné
        responsible_name = (data.get("responsible") or "").strip()
        if responsible_name:
            from utils.notif import notify as _notify
            member_row = conn.execute(
                "SELECT id FROM members WHERE LOWER(name)=?",
                (responsible_name.lower(),)
            ).fetchone()
            if member_row and member_row["id"] != current_user["id"]:
                _notify(
                    conn,
                    recipient_id=member_row["id"],
                    sender_id=current_user["id"],
                    type_="task_assigned",
                    title=f"Tâche assignée : {task_id}",
                    body=f"{current_user['name']} vous a désigné responsable de la tâche « {description} ».",
                    task_id=task_id
                )
                conn.commit()

        task = fetch_task(conn, task_id)
        task["permission"] = get_permission_level(conn, current_user, task)
        conn.close()
        return jsonify(task), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


# ── PUT /api/tasks/<task_id> ─────────────────────────────────────────────────
# - Owner ou chef du projet : édition complète de tous les champs.
# - Responsable seul (ni owner ni chef) : seul le champ `status` est appliqué,
#   tout autre champ envoyé est ignoré silencieusement.
# - Aucun des trois : 403.

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

    permission = get_permission_level(conn, current_user, task)
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

    else:  # permission == "status_only"
        # Sécurité serveur : seul le statut est pris en compte, même si le
        # client envoie d'autres champs (bypass UI ou appel API direct).
        new_status = data.get("status")
        if new_status is None:
            conn.close()
            return jsonify({"error": _STATUS_ONLY}), 400

        completed_at = datetime.now(timezone.utc).isoformat() if new_status == "done" else None
        conn.execute(
            "UPDATE tasks SET status=?, completed_at=? WHERE id=?",
            (new_status, completed_at, task_id)
        )

    conn.commit()
    updated = fetch_task(conn, task_id)
    if updated:
        updated["permission"] = get_permission_level(conn, current_user, updated)
    conn.close()
    return jsonify(updated) if updated else (jsonify({"error": _TASK_NOT_FOUND}), 404)


# ── DELETE /api/tasks/<task_id> ──────────────────────────────────────────────
# Owner ou chef du projet uniquement.

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

    if not can_full_edit(conn, current_user, task):
        conn.close()
        return jsonify({"error": _NOT_AUTHORIZED}), 403

    conn.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": task_id})


# ── PATCH /api/tasks/<task_id>/archive ──────────────────────────────────────
# Owner ou chef du projet uniquement.

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

    if not can_full_edit(conn, current_user, task):
        conn.close()
        return jsonify({"error": _NOT_AUTHORIZED}), 403

    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "UPDATE tasks SET is_archived=1, archived_at=? WHERE id=?",
        (now, task_id)
    )
    conn.commit()
    updated = fetch_task(conn, task_id)
    if updated:
        updated["permission"] = get_permission_level(conn, current_user, updated)
    conn.close()
    return jsonify(updated) if updated else (jsonify({"error": _TASK_NOT_FOUND}), 404)


# ── PATCH /api/tasks/<task_id>/unarchive ────────────────────────────────────
# Owner ou chef du projet uniquement.

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

    if not can_full_edit(conn, current_user, task):
        conn.close()
        return jsonify({"error": _NOT_AUTHORIZED}), 403

    conn.execute(
        "UPDATE tasks SET is_archived=0, archived_at=NULL WHERE id=?",
        (task_id,)
    )
    conn.commit()
    updated = fetch_task(conn, task_id)
    if updated:
        updated["permission"] = get_permission_level(conn, current_user, updated)
    conn.close()
    return jsonify(updated) if updated else (jsonify({"error": _TASK_NOT_FOUND}), 404)