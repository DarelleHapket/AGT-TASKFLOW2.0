# backend/utils/notif.py
#
# A-06 — Helper de création de notifications.
# Prend une connexion SQLite DÉJÀ OUVERTE (pas fermée ici).
# L'appelant est responsable du conn.commit() après l'injection.
#
# Types reconnus :
#   "task_assigned"      → responsable notifié à la création d'une tâche
#   "difficulty_reported"→ chef du projet notifié lors d'un signalement
#   "register_request"   → admin(s) notifié(s) lors d'une demande de compte


def notify(conn, recipient_id, sender_id, type_, title, body, task_id=None):
    """
    Insère une notification dans la table `notifications`.

    Paramètres
    ----------
    conn         : connexion SQLite ouverte (get_db())
    recipient_id : int — ID du membre destinataire
    sender_id    : int | None — ID du membre expéditeur (None si système)
    type_        : str — type de notification (voir liste ci-dessus)
    title        : str — titre court affiché dans la cloche
    body         : str — description longue
    task_id      : str | None — ID de la tâche concernée (pour le lien)
    """
    conn.execute(
        """INSERT INTO notifications
           (recipient_id, sender_id, type, title, body, task_id)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (recipient_id, sender_id, type_, title, body, task_id)
    )