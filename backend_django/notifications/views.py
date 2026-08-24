from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


@api_view(["GET"])
def list_notifications(request):
    """Purge automatique des notifications de plus de 7 jours (comme Flask)."""
    Notification.objects.filter(cree_le__lt=timezone.now() - timedelta(days=7)).delete()
    qs = Notification.objects.filter(destinataire=request.user).select_related("expediteur")
    return Response(NotificationSerializer(qs, many=True).data)


@api_view(["PATCH"])
def mark_read(request, pk):
    updated = Notification.objects.filter(pk=pk, destinataire=request.user).update(lu_le=timezone.now())
    if not updated:
        return Response({"error": "Notification introuvable"}, status=404)
    return Response({"updated": pk})


@api_view(["PATCH"])
def mark_all_read(request):
    Notification.objects.filter(destinataire=request.user, lu_le__isnull=True).update(lu_le=timezone.now())
    return Response({"updated": True})


@api_view(["DELETE"])
def delete_notification(request, pk):
    Notification.objects.filter(pk=pk, destinataire=request.user).delete()
    return Response({"deleted": pk})


@api_view(["DELETE"])
def delete_all_notifications(request):
    Notification.objects.filter(destinataire=request.user).delete()
    return Response({"deleted": "all"})
