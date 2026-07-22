# backend/utils/permissions.py
#
# A-07 — Centralisateur RBAC : toute la logique de permission en un seul endroit.
#
# Remplace les helpers dispersés dans tasks.py et activities.py.
# Importé par : tasks.py, activities.py, project_members.py, projects.py
#
# Modèle de rôles par projet (table project_members) :
#   owner       → créateur, seul à gérer l'équipe et le projet
#   manager     → promu par l'owner, full edit sur tâches + activités
#   contributor → défaut à l'ajout, status_only si responsable d'une tâche
#
# Rôle global (members.is_admin) :
#   admin → lecture seule sur toutes les entités opérationnelles (CDC BF-08/BNF-05)


# ── Helpers internes ─────────────────────────────────────────────────────────

def _name_match(responsible, user_name):
    """Comparaison insensible à la casse et aux espaces sur les noms."""
    r = (responsible or "").strip().lower()
    n = (user_name or "").strip().lower()
    return bool(r) and r == n


# ── Rôle projet ──────────────────────────────────────────────────────────────

def get_project_role(conn, user_id, project_id):
    """
    Retourne le rôle de user_id dans project_id.
    Valeurs possibles : 'owner' | 'manager' | 'contributor' | None (hors projet)
    """
    if not project_id or not user_id:
        return None
    row = conn.execute(
        "SELECT role FROM project_members WHERE project_id = ? AND member_id = ?",
        (project_id, user_id)
    ).fetchone()
    return row["role"] if row else None


def is_project_member(conn, user_id, project_id):
    """True si l'utilisateur appartient au projet (quel que soit son rôle)."""
    return get_project_role(conn, user_id, project_id) is not None


def get_user_project_ids(conn, user_id):
    """
    Retourne l'ensemble des project_id où user_id est membre.
    Utilisé pour filtrer les tâches et activités visibles en une seule requête.
    """
    rows = conn.execute(
        "SELECT project_id FROM project_members WHERE member_id = ?",
        (user_id,)
    ).fetchall()
    return {row["project_id"] for row in rows}


# ── Visibilité des tâches (P3) ───────────────────────────────────────────────

def is_task_visible(task, current_user, member_project_ids):
    """
    Détermine si une tâche est visible pour l'utilisateur.

    Paramètres :
        task               — dict de la tâche
        current_user       — dict du membre connecté
        member_project_ids — set de project_id dont l'utilisateur est membre
                             (pré-calculé une seule fois par requête)

    Règles :
        Admin              → voit toutes les tâches
        Tâche sans projet  → visible si owner_id == user.id OU responsible == user.name
        Tâche avec projet  → visible si project_id ∈ member_project_ids
    """
    if current_user.get("is_admin"):
        return True

    pid = task.get("project_id")

    if pid is None:
        # Tâche personnelle / sans projet
        is_owner = task.get("owner_id") == current_user["id"]
        is_resp  = _name_match(task.get("responsible"), current_user.get("name"))
        return is_owner or is_resp

    return pid in member_project_ids


# ── Permissions sur les tâches ───────────────────────────────────────────────

def get_task_permission_level(conn, current_user, task):
    """
    Calcule le niveau de permission de l'utilisateur courant sur une tâche.

    Retourne l'une des chaînes : 'full' | 'status_only' | 'read_only'

    Logique :
        Admin               → read_only (CDC BF-08/BNF-05)
        Créateur (owner_id) → full, quel que soit le projet
        Rôle projet owner/manager → full
        Contributeur ET responsable de la tâche → status_only
        Tout le reste       → read_only
    """
    if current_user.get("is_admin"):
        return "read_only"

    user_id    = current_user["id"]
    project_id = task.get("project_id")

    # Créateur → full edit toujours
    if task.get("owner_id") == user_id:
        return "full"

    if project_id:
        role = get_project_role(conn, user_id, project_id)
        if role in ("owner", "manager"):
            return "full"
        if role == "contributor" and _name_match(task.get("responsible"), current_user.get("name")):
            return "status_only"
        return "read_only"
    else:
        # Tâche sans projet
        if _name_match(task.get("responsible"), current_user.get("name")):
            return "status_only"
        return "read_only"


# ── Permissions sur les activités (P4) ──────────────────────────────────────

def can_edit_activity(conn, current_user, activity):
    """
    True si l'utilisateur peut modifier ou supprimer l'activité.

    Règles :
        Admin               → False (lecture seule, CDC)
        Créateur (owner_id) → True
        Rôle owner/manager dans le projet de l'activité → True (P4)
    """
    if current_user.get("is_admin"):
        return False
    if activity.get("owner_id") == current_user["id"]:
        return True
    role = get_project_role(conn, current_user["id"], activity.get("project_id"))
    return role in ("owner", "manager")


def can_create_activity(conn, current_user, project_id):
    """
    True si l'utilisateur peut créer une activité dans ce projet.
    Requiert : owner ou manager du projet.
    """
    if current_user.get("is_admin"):
        return False
    role = get_project_role(conn, current_user["id"], project_id)
    return role in ("owner", "manager")


# ── Permissions sur les tâches à la création ─────────────────────────────────

def can_create_task_in_project(conn, current_user, project_id):
    """
    True si l'utilisateur peut créer une tâche dans ce projet.
    Requiert : owner ou manager du projet.
    """
    role = get_project_role(conn, current_user["id"], project_id)
    return role in ("owner", "manager")


def validate_task_creation(conn, current_user, data):
    """
    Valide les permissions pour la création d'une tâche.
    Retourne (ok: bool, error_msg: str | None, http_code: int | None).

    Vérifications si project_id est fourni :
        1. Le projet existe
        2. Le créateur est membre du projet
        3. Le créateur est owner ou manager
        4. Si responsible fourni : il est membre du projet
    """
    project_id = data.get("project_id")
    if not project_id:
        return True, None, None

    # 1. Le projet existe
    project = conn.execute(
        "SELECT id FROM projects WHERE id = ?", (project_id,)
    ).fetchone()
    if not project:
        return False, "Projet introuvable.", 404

    user_role = get_project_role(conn, current_user["id"], project_id)

    # 2. Le créateur est membre du projet
    if user_role is None:
        return False, "Vous n'êtes pas membre de ce projet.", 403

    # 3. Le créateur est owner ou manager
    if user_role not in ("owner", "manager"):
        return (
            False,
            "Seuls le propriétaire et les managers peuvent créer des tâches dans ce projet.",
            403,
        )

    # 4. Si responsible fourni : vérifier qu'il est membre du projet
    responsible_name = (data.get("responsible") or "").strip()
    if responsible_name:
        member_row = conn.execute(
            "SELECT id FROM members WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))",
            (responsible_name,)
        ).fetchone()
        if member_row and not is_project_member(conn, member_row["id"], project_id):
            return (
                False,
                f"Le responsable désigné « {responsible_name} » n'est pas membre de ce projet.",
                400,
            )

    return True, None, None