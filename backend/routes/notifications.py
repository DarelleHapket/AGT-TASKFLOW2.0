# backend/routes/notifications.py
#
# A-06 — Système de notifications persistant (Option B).
#
# Routes :
#   GET  /api/notifications/          → liste des notifications du user connecté
#                                       + purge automatique des > 7 jours
#   PATCH /api/notifications/<id>/read → marque une notification comme lue
#   PATCH /api/notifications/read-all  → marque toutes les notifs comme lues

from flask import Blueprint, jsonify
from database import get_db
from utils.auth import require_auth

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("/", methods=["GET"])
@require_auth
def list_notifications(current_user):
    """
    Retourne les notifications du membre connecté (7 derniers jours).
    Purge silencieusement les notifications de plus de 7 jours avant retour.
    """
    conn = get_db()

    # Purge automatique — fenêtre glissante de 7 jours
    conn.execute(
        "DELETE FROM notifications WHERE created_at < datetime('now', '-7 days')"
    )
    conn.commit()

    rows = conn.execute(
        """SELECT n.*, m.name AS sender_name
           FROM notifications n
           LEFT JOIN members m ON n.sender_id = m.id
           WHERE n.recipient_id = ?
           ORDER BY n.created_at DESC""",
        (current_user["id"],)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@notifications_bp.route("/<int:nid>/read", methods=["PATCH"])
@require_auth
def mark_read(nid, current_user):
    """
    Marque une notification spécifique comme lue (read_at = now).
    Vérifie que la notification appartient bien au membre connecté.
    """
    conn = get_db()
    notif = conn.execute(
        "SELECT * FROM notifications WHERE id=? AND recipient_id=?",
        (nid, current_user["id"])
    ).fetchone()
    if not notif:
        conn.close()
        return jsonify({"error": "Notification introuvable"}), 404

    conn.execute(
        "UPDATE notifications SET read_at=datetime('now') WHERE id=?",
        (nid,)
    )
    conn.commit()
    conn.close()
    return jsonify({"updated": nid})


@notifications_bp.route("/read-all", methods=["PATCH"])
@require_auth
def mark_all_read(current_user):
    """
    Marque toutes les notifications non lues du membre connecté comme lues.
    """
    conn = get_db()
    conn.execute(
        """UPDATE notifications SET read_at=datetime('now')
           WHERE recipient_id=? AND read_at IS NULL""",
        (current_user["id"],)
    )
    conn.commit()
    conn.close()
    return jsonify({"updated": True})