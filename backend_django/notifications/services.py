"""notify() — port de backend/utils/notif.py. Un utilisateur ne se notifie
jamais lui-même (règle commune documentée dans RBAC.md)."""
from .models import Notification


def notify(destinataire, type_, titre, corps="", expediteur=None, tache_id=None):
    if expediteur is not None and expediteur.pk == destinataire.pk:
        return None
    return Notification.objects.create(
        destinataire=destinataire, expediteur=expediteur, type=type_,
        titre=titre, corps=corps, tache_id=tache_id,
    )
