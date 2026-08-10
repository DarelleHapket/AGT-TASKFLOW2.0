"""Règles d'accès projet/tâche/activité (P3/P4) — port de backend/utils/permissions.py.

Modèle de rôles par projet (MembreProjet.role) :
  owner       -> créateur, seul à gérer l'équipe et le projet
  manager     -> promu par l'owner, full edit sur tâches + activités
  contributor -> défaut à l'ajout, status_only si responsable d'une tâche

Rôle global 'admin' (authentification.Role) : lecture seule sur toutes les
entités opérationnelles (CDC BF-08/BNF-05) — inchangé par rapport au Flask.

Amélioration vs Flask : `responsable` est maintenant une vraie FK (voir
models.py), donc plus besoin de `_name_match` insensible à la casse pour
comparer un nom en texte libre.
"""
from .models import MembreProjet


def is_admin_role(user):
    return not user.is_superadmin() and "admin" in user.roles_codes()


def get_project_role(user, projet_id):
    """'owner' | 'manager' | 'contributor' | None."""
    if not projet_id or not user or not user.is_authenticated:
        return None
    mp = MembreProjet.objects.filter(projet_id=projet_id, utilisateur=user).first()
    return mp.role if mp else None


def is_project_member(user, projet_id):
    return get_project_role(user, projet_id) is not None


def get_user_project_ids(user):
    return set(MembreProjet.objects.filter(utilisateur=user).values_list("projet_id", flat=True))


def is_task_visible(tache, user):
    """Admin -> tout. Tâche sans projet -> créateur ou responsable. Tâche avec
    projet -> visible par tout membre actif (A-09, ouverture de visibilité)."""
    if is_admin_role(user) or user.is_superadmin():
        return True
    if tache.projet_id is None:
        return tache.createur_id == user.id or tache.responsable_id == user.id
    return True


def get_task_permission_level(user, tache):
    """'full' | 'status_only' | 'read_only'."""
    if is_admin_role(user):
        return "read_only"
    if tache.createur_id == user.id:
        return "full"
    if tache.projet_id:
        role = get_project_role(user, tache.projet_id)
        if role in ("owner", "manager"):
            return "full"
        if role == "contributor" and tache.responsable_id == user.id:
            return "status_only"
        return "read_only"
    if tache.responsable_id == user.id:
        return "status_only"
    return "read_only"


def can_edit_activity(user, activite):
    if is_admin_role(user):
        return False
    if activite.createur_id == user.id:
        return True
    return get_project_role(user, activite.projet_id) in ("owner", "manager")


def can_create_activity(user, projet_id):
    if is_admin_role(user):
        return False
    return get_project_role(user, projet_id) in ("owner", "manager")


def can_access_task(user, tache):
    """Accès aux difficultés d'une tâche — port de can_access_task (difficulties.py Flask).
    Admin, owner/manager du projet, créateur, ou responsable assigné."""
    if is_admin_role(user):
        return True
    if tache.projet_id and get_project_role(user, tache.projet_id) in ("owner", "manager"):
        return True
    if tache.createur_id == user.id:
        return True
    if tache.responsable_id == user.id:
        return True
    return False


def validate_task_creation(user, projet_id, responsable_id):
    """(ok, message_erreur, code_http)."""
    if not projet_id:
        return False, "Une tâche doit être rattachée à un projet.", 400
    from .models import Projet
    if not Projet.objects.filter(pk=projet_id).exists():
        return False, "Projet introuvable.", 404
    role = get_project_role(user, projet_id)
    if role is None:
        return False, "Vous n'êtes pas membre de ce projet.", 403
    if role not in ("owner", "manager"):
        return False, "Seuls le propriétaire et les managers peuvent créer des tâches dans ce projet.", 403
    if responsable_id and not MembreProjet.objects.filter(projet_id=projet_id, utilisateur_id=responsable_id).exists():
        return False, "Le responsable désigné n'est pas membre de ce projet.", 400
    return True, None, None
