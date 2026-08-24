from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from authentification.services import HasPerm
from notifications.services import notify

from .acces import (
    ROLE_PERMISSIONS_PAR_DEFAUT, can_access_task, can_create_activity, can_edit_activity,
    get_task_permission_level, get_user_project_ids, has_project_permission, is_task_visible,
    validate_task_creation,
)
from .models import Activite, Difficulte, MembreProjet, PermissionMembreProjet, PermissionProjetCode, Projet, Tache
from .pert import CycleError, compute_pert
from .serializers import (
    ActiviteSerializer, DifficulteSerializer, MembreProjetSerializer, ProjetSerializer, TacheSerializer,
)


class CanManageProject(BasePermission):
    message = "Vous n'avez pas la permission de gérer ce projet."

    def has_object_permission(self, request, view, obj):
        return has_project_permission(request.user, obj.id, "projet.gerer")


class ProjetViewSet(viewsets.ModelViewSet):
    queryset = Projet.objects.all().order_by("nom")
    serializer_class = ProjetSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "membres"):
            return [IsAuthenticated()]
        if self.action == "create":
            return [HasPerm("projets.write")()]
        return [IsAuthenticated(), CanManageProject()]

    def perform_create(self, serializer):
        projet = serializer.save()
        MembreProjet.objects.create(projet=projet, utilisateur=self.request.user, role=MembreProjet.OWNER)

    @action(detail=True, methods=["get", "post"])
    def membres(self, request, pk=None):
        projet = self.get_object()
        if request.method == "GET":
            qs = projet.membres.select_related("utilisateur")
            return Response(MembreProjetSerializer(qs, many=True).data)
        # POST — ajout d'un membre, réservé à qui a la permission equipe.gerer
        if not has_project_permission(request.user, projet.id, "equipe.gerer"):
            return Response({"error": "Vous n'avez pas la permission de gérer l'équipe de ce projet."}, status=status.HTTP_403_FORBIDDEN)
        role = request.data.get("role", MembreProjet.CONTRIBUTOR)
        if role not in (MembreProjet.MANAGER, MembreProjet.CONTRIBUTOR):
            return Response({"error": "role doit être 'manager' ou 'contributor'."}, status=status.HTTP_400_BAD_REQUEST)
        membre, created = MembreProjet.objects.get_or_create(
            projet=projet, utilisateur_id=request.data.get("utilisateur"), defaults={"role": role}
        )
        return Response(
            MembreProjetSerializer(membre).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


@api_view(["PUT", "DELETE"])
def membre_projet_detail(request, pid, mid):
    """Modifier le rôle (PUT) ou retirer (DELETE) un membre — réservé à qui a
    la permission equipe.gerer sur ce projet."""
    projet = Projet.objects.filter(pk=pid).first()
    if not projet:
        return Response({"error": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)
    if not has_project_permission(request.user, projet.id, "equipe.gerer"):
        return Response({"error": "Vous n'avez pas la permission de gérer l'équipe de ce projet."}, status=status.HTTP_403_FORBIDDEN)
    membre = MembreProjet.objects.filter(projet=projet, pk=mid).first()
    if not membre:
        return Response({"error": "Membre introuvable dans ce projet."}, status=status.HTTP_404_NOT_FOUND)
    if membre.role == MembreProjet.OWNER:
        return Response({"error": "Le rôle du propriétaire ne peut pas être modifié ici."}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "DELETE":
        membre.delete()
        return Response({"deleted": mid})

    role = request.data.get("role")
    if role not in (MembreProjet.MANAGER, MembreProjet.CONTRIBUTOR):
        return Response({"error": "role doit être 'manager' ou 'contributor'."}, status=status.HTTP_400_BAD_REQUEST)
    membre.role = role
    membre.save()
    return Response(MembreProjetSerializer(membre).data)


PERMISSIONS_PROJET_CATALOGUE = list(PermissionProjetCode.choices)


@api_view(["GET"])
def membre_projet_permissions_detail(request, pid, mid):
    """Détail permission par permission pour un membre de CE projet : d'où
    vient chaque permission (paquet du rôle vs directe/IBAC projet) — même
    forme que authentification/views.py::member_permissions_detail, catalogue
    fixe de 4 codes au lieu du catalogue Permission global. Réservé à qui a
    la permission equipe.gerer sur ce projet."""
    projet = Projet.objects.filter(pk=pid).first()
    if not projet:
        return Response({"error": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)
    if not has_project_permission(request.user, projet.id, "equipe.gerer"):
        return Response({"error": "Vous n'avez pas la permission de gérer l'équipe de ce projet."}, status=status.HTTP_403_FORBIDDEN)
    membre = MembreProjet.objects.filter(projet=projet, pk=mid).first()
    if not membre:
        return Response({"error": "Membre introuvable dans ce projet."}, status=status.HTTP_404_NOT_FOUND)

    paquet_role = ROLE_PERMISSIONS_PAR_DEFAUT.get(membre.role, set())
    directs = {pd.code: pd for pd in membre.permissions_directes.all()}

    result = []
    for code, label in PERMISSIONS_PROJET_CATALOGUE:
        pd = directs.get(code)
        if pd is not None:
            result.append({"code": code, "label": label, "granted": pd.accordee, "source": "direct"})
        elif code in paquet_role:
            result.append({"code": code, "label": label, "granted": True, "source": "role"})
        else:
            result.append({"code": code, "label": label, "granted": False, "source": None})
    return Response(result)


@api_view(["PUT"])
def set_membre_projet_permission(request, pid, mid, code):
    """Accorde/retire une permission directe à un membre sur CE projet
    (IBAC projet) — réservé à qui a la permission equipe.gerer."""
    if code not in PermissionProjetCode.values:
        return Response({"error": "Code de permission inconnu."}, status=status.HTTP_400_BAD_REQUEST)
    projet = Projet.objects.filter(pk=pid).first()
    if not projet:
        return Response({"error": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)
    if not has_project_permission(request.user, projet.id, "equipe.gerer"):
        return Response({"error": "Vous n'avez pas la permission de gérer l'équipe de ce projet."}, status=status.HTTP_403_FORBIDDEN)
    membre = MembreProjet.objects.filter(projet=projet, pk=mid).first()
    if not membre:
        return Response({"error": "Membre introuvable dans ce projet."}, status=status.HTTP_404_NOT_FOUND)

    granted = bool(request.data.get("granted"))
    PermissionMembreProjet.objects.update_or_create(
        membre_projet=membre, code=code, defaults={"accordee": granted}
    )
    return Response({"code": code, "granted": granted})


class ActiviteViewSet(viewsets.ModelViewSet):
    serializer_class = ActiviteSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Activite.objects.select_related("projet")
        projet_id = self.request.query_params.get("projet")
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        if user.is_superadmin():
            return qs
        return qs.filter(projet_id__in=get_user_project_ids(user))

    def create(self, request, *args, **kwargs):
        projet_id = request.data.get("projet")
        if not can_create_activity(request.user, projet_id):
            return Response({"error": "Réservé au propriétaire ou manager du projet."}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(createur=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _guard(self, request, activite):
        if not can_edit_activity(request.user, activite):
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        return None

    def update(self, request, *args, **kwargs):
        guard = self._guard(request, self.get_object())
        return guard or super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        guard = self._guard(request, self.get_object())
        return guard or super().destroy(request, *args, **kwargs)


class TacheViewSet(viewsets.ModelViewSet):
    serializer_class = TacheSerializer

    def get_queryset(self):
        return (Tache.objects
                .select_related("projet", "activite", "responsable", "createur")
                .prefetch_related("dependances"))

    def _pert_map(self, taches):
        payload = [
            {"id": t.id, "duration": t.duree, "dependencies": [d.id for d in t.dependances.all()]}
            for t in taches
        ]
        try:
            return compute_pert(payload), []
        except CycleError as e:
            return {}, e.cycle_ids

    def list(self, request, *args, **kwargs):
        user = request.user
        base = self.get_queryset()
        show_archived = request.query_params.get("show_archived") == "true"

        # PERT calculé sur tout le graphe non archivé AVANT filtrage de visibilité
        # (comme côté Flask) pour garantir l'intégrité des marges/chemin critique.
        non_archivees = list(base.filter(est_archivee=False))
        pert_map, cycle_ids = self._pert_map(non_archivees)

        toutes = non_archivees + (list(base.filter(est_archivee=True)) if show_archived else [])
        visibles = [t for t in toutes if is_task_visible(t, user)]

        projet_id = request.query_params.get("project_id")
        if projet_id:
            visibles = [t for t in visibles if str(t.projet_id) == projet_id]
        statut = request.query_params.get("status")
        if statut:
            visibles = [t for t in visibles if t.statut == statut]
        priorite = request.query_params.get("priority")
        if priorite:
            visibles = [t for t in visibles if t.priorite == priorite]

        serializer = self.get_serializer(visibles, many=True, context={"request": request, "pert_map": pert_map})
        return Response({"tasks": serializer.data, "pert_cycle_ids": cycle_ids})

    def _notify_assignation(self, expediteur, tache):
        """Port de backend/routes/tasks.py (create_task/update_task) : prévient le
        responsable désigné. notify() ignore déjà l'auto-notification (expediteur==destinataire)."""
        notify(
            tache.responsable, "task_assigned",
            f"Tâche assignée : {tache.id}",
            f"{expediteur.display_name()} vous a désigné responsable de la tâche « {tache.description} ».",
            expediteur=expediteur, tache_id=tache.id,
        )

    def _notify_progression(self, expediteur, tache):
        """Le responsable assigné met à jour sa progression (en cours/terminé) :
        prévient le créateur de la tâche et les owner/manager du projet, pour
        qu'ils sachent où ça en est sans avoir à revenir vérifier. notify()
        ignore déjà l'auto-notification (expediteur==destinataire)."""
        label = "en cours" if tache.statut == Tache.IN_PROGRESS else "terminée"
        destinataires = set()
        if tache.createur_id:
            destinataires.add(tache.createur)
        if tache.projet_id:
            chefs = MembreProjet.objects.filter(
                projet_id=tache.projet_id, role__in=[MembreProjet.OWNER, MembreProjet.MANAGER]
            ).select_related("utilisateur")
            destinataires.update(mp.utilisateur for mp in chefs)
        for destinataire in destinataires:
            notify(
                destinataire, "task_progression",
                f"Tâche {label} : {tache.id}",
                f"{expediteur.display_name()} a mis à jour « {tache.description} » : {label}.",
                expediteur=expediteur, tache_id=tache.id,
            )

    def create(self, request, *args, **kwargs):
        projet_id = request.data.get("projet")
        responsable_id = request.data.get("responsable")
        ok, msg, code = validate_task_creation(request.user, projet_id, responsable_id)
        if not ok:
            return Response({"error": msg}, status=code)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tache = serializer.save(createur=request.user)
        if tache.responsable_id:
            self._notify_assignation(request.user, tache)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        tache = self.get_object()
        level = get_task_permission_level(request.user, tache)
        if level == "read_only":
            return Response({"error": "Lecture seule."}, status=status.HTTP_403_FORBIDDEN)
        if level == "status_only":
            statut = request.data.get("statut")
            if statut is None or set(request.data.keys()) - {"statut"}:
                return Response({"error": "Vous ne pouvez modifier que le statut."}, status=status.HTTP_403_FORBIDDEN)
            ancien_statut = tache.statut
            tache.statut = statut
            if statut == Tache.DONE and not tache.date_completion:
                tache.date_completion = timezone.now()
            tache.save()
            if statut != ancien_statut and statut in (Tache.IN_PROGRESS, Tache.DONE):
                self._notify_progression(request.user, tache)
            return Response(self.get_serializer(tache, context={"request": request}).data)
        old_responsable_id = tache.responsable_id
        ancien_statut = tache.statut
        response = super().update(request, *args, **kwargs)
        tache.refresh_from_db()
        if tache.responsable_id and tache.responsable_id != old_responsable_id:
            self._notify_assignation(request.user, tache)
        if tache.statut != ancien_statut and tache.statut in (Tache.IN_PROGRESS, Tache.DONE):
            self._notify_progression(request.user, tache)
        return response

    def destroy(self, request, *args, **kwargs):
        if get_task_permission_level(request.user, self.get_object()) != "full":
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["patch"])
    def archive(self, request, pk=None):
        tache = self.get_object()
        if get_task_permission_level(request.user, tache) != "full":
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        tache.est_archivee = True
        tache.archivee_le = timezone.now()
        tache.save()
        return Response(self.get_serializer(tache, context={"request": request}).data)

    @action(detail=True, methods=["patch"])
    def unarchive(self, request, pk=None):
        tache = self.get_object()
        if get_task_permission_level(request.user, tache) != "full":
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        tache.est_archivee = False
        tache.archivee_le = None
        tache.save()
        return Response(self.get_serializer(tache, context={"request": request}).data)


# ── Difficultés signalées sur une tâche (port de difficulties.py Flask) ──

@api_view(["GET"])
def list_difficulties(request):
    tache_id = request.query_params.get("task_id")
    if not tache_id:
        return Response({"error": "task_id requis"}, status=status.HTTP_400_BAD_REQUEST)
    tache = Tache.objects.filter(pk=tache_id).first()
    if not tache:
        return Response({"error": "Tâche introuvable"}, status=status.HTTP_404_NOT_FOUND)
    if not can_access_task(request.user, tache):
        return Response({"error": "Accès non autorisé à cette tâche"}, status=status.HTTP_403_FORBIDDEN)
    qs = tache.difficultes.select_related("membre")
    return Response(DifficulteSerializer(qs, many=True).data)


@api_view(["POST"])
def create_difficulty(request):
    tache_id = (request.data.get("task_id") or "").strip()
    contenu = (request.data.get("content") or "").strip()
    if not tache_id or not contenu:
        return Response({"error": "task_id et content requis"}, status=status.HTTP_400_BAD_REQUEST)
    tache = Tache.objects.filter(pk=tache_id).first()
    if not tache:
        return Response({"error": "Tâche introuvable"}, status=status.HTTP_404_NOT_FOUND)
    if not can_access_task(request.user, tache):
        return Response({"error": "Vous n'avez pas accès à cette tâche"}, status=status.HTTP_403_FORBIDDEN)

    diff = Difficulte.objects.create(tache=tache, membre=request.user, contenu=contenu)

    # Notifie tous les owners ET managers du projet, sauf le signataire (A-07).
    if tache.projet_id:
        destinataires = MembreProjet.objects.filter(
            projet_id=tache.projet_id, role__in=(MembreProjet.OWNER, MembreProjet.MANAGER)
        ).exclude(utilisateur=request.user).select_related("utilisateur")
        for mp in destinataires:
            notify(
                mp.utilisateur, "difficulty_reported", f"Difficulté signalée : {tache.id}",
                corps=f"{request.user.display_name()} a signalé sur « {tache.description} » : « {contenu[:120]} ».",
                expediteur=request.user, tache_id=tache.id,
            )

    return Response(DifficulteSerializer(diff).data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
def delete_difficulty(request, pk):
    diff = Difficulte.objects.filter(pk=pk).select_related("tache").first()
    if not diff:
        return Response({"error": "Difficulté introuvable"}, status=status.HTTP_404_NOT_FOUND)
    is_author = diff.membre_id == request.user.id
    can_manage = can_access_task(request.user, diff.tache)
    if not is_author and not can_manage:
        return Response({"error": "Non autorisé"}, status=status.HTTP_403_FORBIDDEN)
    diff.delete()
    return Response({"deleted": pk})
