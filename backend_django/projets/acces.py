"""Règles d'accès projet/tâche/activité (P3/P4) — port de backend/utils/permissions.py.

Modèle de rôles PAR PROJET (MembreProjet.role, couche IBAC — instance-based,
scopée à un projet précis, pas à toute la plateforme) : des paquets de
permissions prédéfinis assignés par projet, ajustables par le Superadmin ou
le propriétaire du projet — pas des rôles figés en dur.
  owner       -> créateur, seul à gérer l'équipe et le projet
  manager     -> promu par l'owner, full edit sur tâches + activités
  contributor -> défaut à l'ajout, status_only si responsable d'une tâche

RBAC global (2 rôles seulement, 2026-08-19 : superadmin + user) : plus de
comportement transversal lié à un nom de rôle ici — un user ne voit/modifie
que ce que son appartenance à un projet (ci-dessus) ou ses permissions
explicites autorisent. Seul superadmin garde un bypass total (`is_superadmin`).

Amélioration vs Flask : `responsable` est maintenant une vraie FK (voir
models.py), donc plus besoin de `_name_match` insensible à la casse pour
comparer un nom en texte libre.
"""
from .models import MembreProjet

# Paquet de permissions par défaut par rôle projet (IBAC scopé projet) — pas
# stocké, calculé à la volée. Une ligne PermissionMembreProjet (direct)
# accorde/retire une permission précise en plus ou en moins de ce paquet et
# prime toujours dessus — même logique que User.peut() au niveau global.
ROLE_PERMISSIONS_PAR_DEFAUT = {
    MembreProjet.OWNER: {"taches.gerer", "activites.gerer", "equipe.gerer", "projet.gerer"},
    MembreProjet.MANAGER: {"taches.gerer", "activites.gerer"},
    MembreProjet.CONTRIBUTOR: set(),
}


def get_project_role(user, projet_id):
    """'owner' | 'manager' | 'contributor' | None."""
    if not projet_id or not user or not user.is_authenticated:
        return None
    mp = MembreProjet.objects.filter(projet_id=projet_id, utilisateur=user).first()
    return mp.role if mp else None


def get_project_permissions(user, projet_id):
    """Permissions projet effectives pour user sur projet_id : paquet par
    défaut du rôle + octroi direct - retrait direct."""
    if not projet_id or not user or not user.is_authenticated:
        return set()
    mp = MembreProjet.objects.filter(projet_id=projet_id, utilisateur=user).prefetch_related("permissions_directes").first()
    if not mp:
        return set()
    effective = set(ROLE_PERMISSIONS_PAR_DEFAUT.get(mp.role, set()))
    for pd in mp.permissions_directes.all():
        if pd.accordee:
            effective.add(pd.code)
        else:
            effective.discard(pd.code)
    return effective


def has_project_permission(user, projet_id, code):
    return user.is_superadmin() or code in get_project_permissions(user, projet_id)


def is_project_member(user, projet_id):
    return get_project_role(user, projet_id) is not None


def get_user_project_ids(user):
    return set(MembreProjet.objects.filter(utilisateur=user).values_list("projet_id", flat=True))


def is_task_visible(tache, user):
    """Superadmin -> tout. Tâche sans projet -> créateur ou responsable. Tâche
    avec projet -> visible par tout membre actif (A-09, ouverture de visibilité)."""
    if user.is_superadmin():
        return True
    if tache.projet_id is None:
        return tache.createur_id == user.id or tache.responsable_id == user.id
    return True


def get_task_permission_level(user, tache):
    """'full' | 'status_only' | 'read_only'."""
    if tache.createur_id == user.id:
        return "full"
    if tache.projet_id:
        if has_project_permission(user, tache.projet_id, "taches.gerer"):
            return "full"
        if is_project_member(user, tache.projet_id) and tache.responsable_id == user.id:
            return "status_only"
        return "read_only"
    if tache.responsable_id == user.id:
        return "status_only"
    return "read_only"


def can_edit_activity(user, activite):
    if activite.createur_id == user.id:
        return True
    return has_project_permission(user, activite.projet_id, "activites.gerer")


def can_create_activity(user, projet_id):
    return has_project_permission(user, projet_id, "activites.gerer")


def can_access_task(user, tache):
    """Accès aux difficultés d'une tâche — port de can_access_task (difficulties.py Flask).
    Permission taches.gerer sur le projet, créateur, ou responsable assigné."""
    if tache.projet_id and has_project_permission(user, tache.projet_id, "taches.gerer"):
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
    if get_project_role(user, projet_id) is None:
        return False, "Vous n'êtes pas membre de ce projet.", 403
    if not has_project_permission(user, projet_id, "taches.gerer"):
        return False, "Vous n'avez pas la permission de gérer les tâches sur ce projet.", 403
    if responsable_id and not MembreProjet.objects.filter(projet_id=projet_id, utilisateur_id=responsable_id).exists():
        return False, "Le responsable désigné n'est pas membre de ce projet.", 400
    return True, None, None
