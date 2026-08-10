from datetime import date

from django.db.models import Count, Sum
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from projets.acces import is_admin_role
from projets.models import Tache

from .models import Besoin, NEED_STATUSES, NEED_TYPES, Note, OrdreJournalier
from .serializers import BesoinSerializer, NoteSerializer, OrdreJournalierSerializer


@api_view(["GET"])
def need_types(request):
    return Response(NEED_TYPES)


@api_view(["GET"])
def need_statuses(request):
    return Response(NEED_STATUSES)


class BesoinViewSet(viewsets.ModelViewSet):
    """Pas de propriétaire en base (comme côté Flask — champ absent de la table
    needs) : tout membre authentifié peut créer/modifier/supprimer un besoin."""
    queryset = Besoin.objects.select_related("projet", "activite").all()
    serializer_class = BesoinSerializer


class NoteViewSet(viewsets.ModelViewSet):
    """Lecture publique (tout membre voit toutes les notes), écriture réservée
    à l'auteur — port de notes.py (Flask)."""
    queryset = Note.objects.select_related("projet", "activite", "tache", "auteur").all()
    serializer_class = NoteSerializer

    def perform_create(self, serializer):
        serializer.save(auteur=self.request.user)

    def _guard(self, request, note):
        if note.auteur_id is not None and note.auteur_id != request.user.id:
            return Response({"error": "Vous ne pouvez modifier que vos propres notes."}, status=status.HTTP_403_FORBIDDEN)
        return None

    def update(self, request, *args, **kwargs):
        guard = self._guard(request, self.get_object())
        return guard or super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        guard = self._guard(request, self.get_object())
        return guard or super().destroy(request, *args, **kwargs)


# ── Ma journée (OrdreJournalier) — chacun ne gère QUE sa propre journée ──

def _can_edit_day(user, membre_id):
    """Un membre ne modifie QUE sa propre journée — même admin/chef en lecture seule."""
    return str(user.id) == str(membre_id)


def _can_view_day(user, membre_id):
    """Le membre voit la sienne ; admin/chef/superadmin peuvent consulter celle
    d'un membre (lecture seule)."""
    if str(user.id) == str(membre_id):
        return True
    return is_admin_role(user) or user.is_superadmin() or "chef_projet" in user.roles_codes()


@api_view(["GET"])
def get_daily_order(request):
    membre_id = request.query_params.get("member_id", request.user.id)
    target_date = request.query_params.get("date", date.today().isoformat())
    if not _can_view_day(request.user, membre_id):
        return Response({"error": "Accès non autorisé"}, status=status.HTTP_403_FORBIDDEN)
    qs = OrdreJournalier.objects.filter(membre_id=membre_id, date=target_date).select_related("tache", "tache__projet")
    return Response(OrdreJournalierSerializer(qs, many=True).data)


@api_view(["POST"])
def set_daily_order(request):
    membre_id = request.data.get("member_id", request.user.id)
    tache_id = request.data.get("task_id")
    target_date = request.data.get("date", date.today().isoformat())
    if not tache_id:
        return Response({"error": "task_id requis"}, status=status.HTTP_400_BAD_REQUEST)
    if not _can_edit_day(request.user, membre_id):
        return Response({"error": "Vous ne pouvez modifier que votre propre journée"}, status=status.HTTP_403_FORBIDDEN)
    entry, _ = OrdreJournalier.objects.update_or_create(
        membre_id=membre_id, tache_id=tache_id, date=target_date,
        defaults={
            "ordre": request.data.get("order_index", 0),
            "note": request.data.get("note", ""),
            "heure_debut": request.data.get("start_time"),
            "duree_min": request.data.get("duration_min"),
        },
    )
    return Response(OrdreJournalierSerializer(entry).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def set_daily_order_bulk(request):
    membre_id = request.data.get("member_id", request.user.id)
    target_date = request.data.get("date", date.today().isoformat())
    taches = request.data.get("tasks", [])
    if not _can_edit_day(request.user, membre_id):
        return Response({"error": "Vous ne pouvez modifier que votre propre journée"}, status=status.HTTP_403_FORBIDDEN)
    OrdreJournalier.objects.filter(membre_id=membre_id, date=target_date).delete()
    OrdreJournalier.objects.bulk_create([
        OrdreJournalier(
            membre_id=membre_id, tache_id=t["task_id"], date=target_date,
            ordre=t.get("order_index", i), note=t.get("note", ""),
            heure_debut=t.get("start_time"), duree_min=t.get("duration_min"),
        )
        for i, t in enumerate(taches)
    ])
    return Response({"success": True, "count": len(taches)})


@api_view(["DELETE"])
def delete_daily_order(request, pk):
    entry = OrdreJournalier.objects.filter(pk=pk).first()
    if not entry:
        return Response({"error": "Entrée introuvable"}, status=status.HTTP_404_NOT_FOUND)
    if not _can_edit_day(request.user, entry.membre_id):
        return Response({"error": "Vous ne pouvez modifier que votre propre journée"}, status=status.HTTP_403_FORBIDDEN)
    entry.delete()
    return Response({"deleted": pk})


# ── Performances (port de performance.py Flask) ──

@api_view(["GET"])
def performance(request):
    user = request.user
    qs = Tache.objects.filter(statut=Tache.DONE).exclude(responsable__isnull=True)

    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")
    if date_from:
        qs = qs.filter(date_completion__gte=date_from)
    if date_to:
        qs = qs.filter(date_completion__lte=f"{date_to}T23:59:59")

    if is_admin_role(user) or user.is_superadmin():
        allowed_ids = None
    elif "chef_projet" in user.roles_codes():
        allowed_ids = set(
            Tache.objects.filter(projet__membres__utilisateur=user, projet__membres__role="owner")
            .values_list("responsable_id", flat=True)
        )
        allowed_ids.add(user.id)
    else:
        allowed_ids = {user.id}

    if allowed_ids is not None:
        qs = qs.filter(responsable_id__in=allowed_ids)

    agg = (qs.values("responsable_id", "responsable__username")
             .annotate(task_count=Count("id"), total_coupons=Sum("duree"))
             .order_by("-total_coupons"))

    par_projet = (qs.values("responsable_id", "projet__nom")
                    .annotate(task_count=Count("id"), total_coupons=Sum("duree")))
    breakdown = {}
    for row in par_projet:
        breakdown.setdefault(row["responsable_id"], []).append({
            "project": row["projet__nom"] or "Sans projet",
            "task_count": row["task_count"],
            "total_coupons": row["total_coupons"],
        })

    result = [{
        "member": row["responsable__username"],
        "task_count": row["task_count"],
        "total_coupons": row["total_coupons"] or 0,
        "by_project": breakdown.get(row["responsable_id"], []),
    } for row in agg]

    return Response(result)
