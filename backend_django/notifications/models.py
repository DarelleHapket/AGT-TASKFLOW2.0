"""Notifications — port de backend/routes/notifications.py (AGT) + inspiré du
bus générique events.emettre() de team-tool. Purge automatique à 7 jours,
comme côté Flask."""
from django.conf import settings
from django.db import models


class Notification(models.Model):
    destinataire = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    expediteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    type = models.CharField(max_length=50)          # ex: task_assigned, difficulty_reported, register_request
    titre = models.CharField(max_length=200)
    corps = models.TextField(blank=True)
    tache_id = models.CharField(max_length=50, null=True, blank=True)
    lu_le = models.DateTimeField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-cree_le"]
