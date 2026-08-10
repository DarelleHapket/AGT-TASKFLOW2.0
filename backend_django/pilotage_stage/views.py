from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from authentification.models import User
from authentification.services import HasPerm
from notifications.services import notify

from .models import Branch, Edge, Node, PertStatut, PertTask, Sollicitation, SousTache, Tache
from .serializers import (
    BranchSerializer, PertStatutSerializer, PertTaskSerializer, SousTacheSerializer, TacheSerializer,
)


class BranchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Branch.objects.prefetch_related("nodes", "edges")
    serializer_class = BranchSerializer
    permission_classes = [HasPerm("pilotage.taches.voir_soi")]


class TacheViewSet(viewsets.ModelViewSet):
    """Visibilité par portées : pilotage.taches.voir_soi (défaut membre) /
    voir_tous. Filtres : ?person=<username> et ?jour=<jour>."""
    serializer_class = TacheSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Tache.objects.select_related(
            "branch", "assignee", "validateur", "current_node", "pert_task"
        ).prefetch_related("sous_taches", "transitions", "sollicitations")
        if (user.is_superadmin() or user.peut("pilotage.taches.voir_tous")
                or user.peut("pilotage.taches.valider")):
            pass
        elif user.peut("pilotage.taches.voir_soi"):
            qs = qs.filter(Q(assignee=user) | Q(validateur=user))
        else:
            return qs.none()
        person = self.request.query_params.get("person")
        if person:
            qs = qs.filter(assignee__username=person)
        jour = self.request.query_params.get("jour")
        if jour:
            qs = qs.filter(jour=jour)
        return qs

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPerm("pilotage.taches.gerer")()]
        return [HasPerm("pilotage.taches.voir_soi")()]

    def perform_create(self, serializer):
        branch = serializer.validated_data["branch"]
        start = branch.nodes.filter(kind="start").order_by("num").first()
        validateur = serializer.validated_data.get("validateur") or self.request.user
        tache = serializer.save(created_by=self.request.user, current_node=start, validateur=validateur)
        notify(tache.assignee, "taches.assignation",
               f"Tâche « {tache.titre} » (branche {branch.slug}) vous est assignée",
               expediteur=self.request.user)

    @action(detail=True, methods=["post"])
    def avancer(self, request, pk=None):
        """Nœud bloquant franchi par : le validateur désigné, un détenteur de
        pilotage.taches.valider (rôle lead — jamais un nom en dur), ou un superadmin."""
        tache = self.get_object()
        if tache.clos:
            return Response({"detail": "Tâche close."}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        if not (user.peut("pilotage.taches.gerer") or user.pk == tache.assignee_id
                or user.pk == tache.validateur_id or user.peut("pilotage.taches.valider")):
            return Response({"detail": "Seul l'assigné, le validateur ou un manager avance cette tâche."},
                             status=status.HTTP_403_FORBIDDEN)
        if tache.current_node.blocking and not (
                user.pk == tache.validateur_id or user.peut("pilotage.taches.valider")):
            return Response({"detail": "Nœud bloquant : réservé au validateur désigné ou au rôle lead."},
                             status=status.HTTP_403_FORBIDDEN)
        to_num = request.data.get("to_num")
        edge = Edge.objects.filter(branch=tache.branch, from_num=tache.current_node.num, to_num=to_num).first()
        if not edge:
            return Response({"detail": "Transition inexistante depuis ce nœud."}, status=status.HTTP_400_BAD_REQUEST)
        to_node = get_object_or_404(Node, branch=tache.branch, num=to_num)
        tache.transitions.create(from_node=tache.current_node, to_node=to_node,
                                  par=user, commentaire=request.data.get("commentaire", ""))
        tache.current_node = to_node
        if to_node.kind == "final":
            tache.clos = True
        tache.save()
        cibles = set(User.objects.filter(is_superuser=True)) | {tache.assignee, tache.created_by}
        if tache.validateur:
            cibles.add(tache.validateur)
        titre = f"« {tache.titre} » : {to_node.titre}" + (" (close)" if tache.clos else "")
        for cible in cibles:
            notify(cible, "taches.transition", titre, expediteur=user)
        return Response(TacheSerializer(tache).data)

    @action(detail=True, methods=["post"])
    def solliciter(self, request, pk=None):
        tache = self.get_object()
        vers = get_object_or_404(User, pk=request.data.get("vers"))
        message = (request.data.get("message") or "").strip()[:250]
        if not message:
            return Response({"detail": "Message requis."}, status=status.HTTP_400_BAD_REQUEST)
        Sollicitation.objects.create(tache=tache, de=request.user, vers=vers, message=message)
        notify(vers, "taches.sollicitation",
               f"{request.user.display_name()} vous sollicite sur « {tache.titre} » : {message}",
               expediteur=request.user)
        return Response(TacheSerializer(tache).data)


class SousTacheViewSet(viewsets.ModelViewSet):
    """CRUD réservé à l'assigné de la tâche parente — sa propre roadmap.
    Le superadmin garde la main (filet de sécurité)."""
    serializer_class = SousTacheSerializer

    def get_queryset(self):
        user = self.request.user
        qs = SousTache.objects.select_related("tache", "tache__assignee")
        if user.is_superadmin() or user.peut("pilotage.taches.voir_tous"):
            return qs
        return qs.filter(tache__assignee=user)

    def _verifier_assigne(self, tache):
        user = self.request.user
        if not (user.is_superadmin() or user.pk == tache.assignee_id):
            raise PermissionDenied("Seul l'assigné de la tâche gère ses sous-tâches.")

    def perform_create(self, serializer):
        self._verifier_assigne(serializer.validated_data["tache"])
        serializer.save()

    def perform_update(self, serializer):
        self._verifier_assigne(serializer.instance.tache)
        serializer.save()

    def perform_destroy(self, instance):
        self._verifier_assigne(instance.tache)
        instance.delete()


def export_json():
    graphs = {}
    for b in Branch.objects.prefetch_related("nodes", "edges"):
        graphs[b.slug] = {
            "nodes": [{"id": n.num, "kind": n.kind, "titre": n.titre, "x": n.x, "y": n.y,
                       "blocking": n.blocking, "detail": n.detail} for n in b.nodes.all()],
            "edges": [{"from": e.from_num, "to": e.to_num, "label": e.label} for e in b.edges.all()],
        }
    return {"schema": "agt_arbre", "version": 1,
            "exportedAt": timezone.now().isoformat(), "activeBranch": "tronc",
            "branches": [{"id": b.slug, "nom": b.nom} for b in Branch.objects.all()],
            "graphs": graphs}


@api_view(["GET"])
@permission_classes([HasPerm("pilotage.taches.voir_soi")])
def export_arbre(request):
    return Response(export_json())


class PertTaskViewSet(viewsets.ModelViewSet):
    queryset = PertTask.objects.select_related("statut").prefetch_related("taches")
    serializer_class = PertTaskSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasPerm("pilotage.pert.voir")()]
        return [HasPerm("pilotage.pert.editer")()]


class PertStatutViewSet(viewsets.ModelViewSet):
    queryset = PertStatut.objects.all()
    serializer_class = PertStatutSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasPerm("pilotage.pert.voir")()]
        return [HasPerm("pilotage.pert.editer")()]

    def destroy(self, request, *args, **kwargs):
        statut = self.get_object()
        if statut.taches_pert.exists():
            return Response({"detail": "Statut utilisé par des tâches PERT : réaffectez-les avant de le supprimer."},
                             status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)


@api_view(["GET"])
@permission_classes([HasPerm("pilotage.pert.voir")])
def export_pert(request):
    tasks = [{"id": str(t.num), "name": t.name, "preds": [str(p) for p in t.preds],
              "dur": t.dur, "status": t.statut.cle} for t in PertTask.objects.select_related("statut")]
    return Response({"schema": "agt_pert", "version": 1, "exportedAt": timezone.now().isoformat(), "tasks": tasks})
