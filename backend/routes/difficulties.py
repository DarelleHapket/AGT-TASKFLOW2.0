# backend/routes/difficulties.py
#
# A-05 — Bugfix can_access_task (conditions cumulatives, hors périmètre Darelle)
# A-07 — Alignement RBAC project_members :
#   • can_access_task() → utilise get_project_role() au lieu de projects.chef_id
#   • create_difficulty() → notifie TOUS les owners ET managers du projet
#     (et non plus uniquement projects.chef_id)

from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_auth
from utils.permissions import get_project_role

difficulties_bp = Blueprint("difficulties", __name__)


def _name_match(a, b):
    return (a or "").strip().lower() == (b or "").strip().lower()


def can_access_task(conn, user, task):
    """
    Détermine si `user` a le droit d'accéder aux difficultés de `task`.

    Conditions (l'une suffit) :
      - Admin                                         → accès
      - Owner ou manager du projet (project_members)  → accès  (A-07)
      - Créateur de la tâche (owner_id)               → accès
      - Responsable assigné                           → accès
    """
    if user.get("is_admin"):
        return True

    # Owner ou manager du projet (A-07 — remplace la vérification chef_id)
    if task.get("project_id"):
        role = get_project_role(conn, user["id"], task["project_id"])
        if role in ("owner", "manager"):
            return True

    # Créateur de la tâche
    if task.get("owner_id") is not None and task["owner_id"] == user["id"]:
        return True

    # Responsable assigné (comparaison insensible à la casse)
    if _name_match(task.get("responsible"), user.get("name")):
        return True

    return False


# ── GET /api/difficulties/ ───────────────────────────────────────────────────

@difficulties_bp.route("/", methods=["GET"])
@require_auth
def list_difficulties(current_user):
    task_id = request.args.get("task_id")
    if not task_id:
        return jsonify({"error": "task_id requis"}), 400

    conn = get_db()
    task = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task:
        conn.close()
        return jsonify({"error": "Tâche introuvable"}), 404

    if not can_access_task(conn, current_user, dict(task)):
        conn.close()
        return jsonify({"error": "Accès non autorisé à cette tâche"}), 403

    rows = conn.execute("""
        SELECT d.*, m.name AS member_name
        FROM task_difficulties d
        LEFT JOIN members m ON d.member_id = m.id
        WHERE d.task_id = ?
        ORDER BY d.created_at DESC
    """, (task_id,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ── POST /api/difficulties/ ──────────────────────────────────────────────────
# A-07 : notifie TOUS les owners et managers du projet (project_members),
# sauf le signataire lui-même, et sans doublon.

@difficulties_bp.route("/", methods=["POST"])
@require_auth
def create_difficulty(current_user):
    data    = request.get_json() or {}
    task_id = (data.get("task_id") or "").strip()
    content = (data.get("content") or "").strip()

    if not task_id or not content:
        return jsonify({"error": "task_id et content requis"}), 400

    conn = get_db()
    task = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task:
        conn.close()
        return jsonify({"error": "Tâche introuvable"}), 404

    task = dict(task)

    if not can_access_task(conn, current_user, task):
        conn.close()
        return jsonify({"error": "Vous n'avez pas accès à cette tâche"}), 403

    c = conn.execute(
        "INSERT INTO task_difficulties (task_id, member_id, content) VALUES (?, ?, ?)",
        (task_id, current_user["id"], content)
    )
    conn.commit()

    # ── Notifications (A-07) ─────────────────────────────────────────────────
    # Destinataires : tous les owners ET managers du projet de la tâche,
    # sauf le signataire lui-même.
    # Si la tâche n'a pas de projet, on ne notifie personne (pas de périmètre).
    if task.get("project_id"):
        from utils.notif import notify as _notify

        recipients = conn.execute("""
            SELECT pm.member_id
            FROM project_members pm
            WHERE pm.project_id = ?
              AND pm.role IN ('owner', 'manager')
              AND pm.member_id != ?
        """, (task["project_id"], current_user["id"])).fetchall()

        for r in recipients:
            _notify(
                conn,
                recipient_id=r["member_id"],
                sender_id=current_user["id"],
                type_="difficulty_reported",
                title=f"Difficulté signalée : {task_id}",
                body=(
                    f"{current_user['name']} a signalé sur «\u202f{task.get('description', task_id)}\u202f»\u202f: "
                    f"«\u202f{content[:120]}\u202f»."
                ),
                task_id=task_id,
            )

        if recipients:
            conn.commit()

    row = conn.execute("""
        SELECT d.*, m.name AS member_name
        FROM task_difficulties d
        LEFT JOIN members m ON d.member_id = m.id
        WHERE d.id = ?
    """, (c.lastrowid,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


# ── DELETE /api/difficulties/<id> ────────────────────────────────────────────

@difficulties_bp.route("/<int:did>", methods=["DELETE"])
@require_auth
def delete_difficulty(did, current_user):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM task_difficulties WHERE id = ?", (did,)
    ).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Difficulté introuvable"}), 404

    diff     = dict(row)
    is_author = diff["member_id"] == current_user["id"]

    task = conn.execute(
        "SELECT * FROM tasks WHERE id = ?", (diff["task_id"],)
    ).fetchone()
    can_manage = bool(task) and can_access_task(conn, current_user, dict(task))

    if not is_author and not can_manage:
        conn.close()
        return jsonify({"error": "Non autorisé"}), 403

    conn.execute("DELETE FROM task_difficulties WHERE id = ?", (did,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": did})