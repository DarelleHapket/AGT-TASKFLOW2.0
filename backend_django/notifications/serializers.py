from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "type", "titre", "corps", "tache_id", "lu_le", "cree_le", "sender_name"]

    def get_sender_name(self, obj):
        return obj.expediteur.display_name() if obj.expediteur else None
