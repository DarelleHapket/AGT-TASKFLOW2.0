from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from authentification.models import StatutCompte, User
from authentification.services import HasPerm

from notifications.services import notify

from .models import AlerteMateriel, Materiel, MouvementMateriel, StatutAlerte, TypeAlerte, TypeMateriel
from .serializers import AlerteMaterielSerializer, MaterielSerializer, MouvementMaterielSerializer, TypeMaterielSerializer
from .services import (
    appliquer_mouvement,
    calculer_stock,
    notifier_gestionnaires_materiel,
    verifier_alerte_rupture,
    verifier_coherence_projet,
    verifier_disponibilite_affectation,
)

LABEL_SENS = {
    "achat": "Achat", "affectation": "Affectation", "retour": "Retour",
    "hors_service": "Hors service", "consommation": "Consommation",
}


class _ReadWritePermMixin:
    """list/retrieve -> materiel.read ; le reste -> materiel.write."""
    read_perm = "materiel.read"
    write_perm = "materiel.write"

    def get_permissions(self):
        code = self.read_perm if self.action in ("list", "retrieve") else self.write_perm
        return [HasPerm(code)()]


class TypeMaterielViewSet(_ReadWritePermMixin, viewsets.ModelViewSet):
    queryset = TypeMateriel.objects.all()
    serializer_class = TypeMaterielSerializer

    def destroy(self, request, *args, **kwargs):
        """BF-02 : suppression protégée (du matériel de ce type existe) ->
        message propre au lieu d'un 500 ProtectedError non intercepté."""
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"error": "Ce type est utilisé par du matériel existant, impossible à supprimer."},
                status=status.HTTP_409_CONFLICT,
            )


class MaterielViewSet(_ReadWritePermMixin, viewsets.ModelViewSet):
    queryset = Materiel.objects.select_related("type", "projet")
    serializer_class = MaterielSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        type_id = self.request.query_params.get("type")
        projet_id = self.request.query_params.get("projet")
        if type_id:
            qs = qs.filter(type_id=type_id)
        if projet_id:
            qs = qs.filter(projet_id=projet_id)
        return qs

    def destroy(self, request, *args, **kwargs):
        """BF-04 : suppression protégée (des mouvements référencent ce
        matériel) -> message propre au lieu d'un 500 ProtectedError non
        intercepté."""
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"error": "Ce matériel a des mouvements enregistrés, impossible à supprimer."},
                status=status.HTTP_409_CONFLICT,
            )


class MouvementMaterielViewSet(_ReadWritePermMixin, viewsets.ModelViewSet):
    """BNF-04 : journal daté, jamais modifiable — update/destroy renvoient
    405 (comme MouvementFinancier), pas 403 : ce n'est pas une question de
    permission mais d'impossibilité définitive."""
    queryset = MouvementMateriel.objects.select_related("materiel", "projet", "employe__profil__utilisateur")
    serializer_class = MouvementMaterielSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        materiel_id = self.request.query_params.get("materiel")
        type_materiel_id = self.request.query_params.get("type")
        if materiel_id:
            qs = qs.filter(materiel_id=materiel_id)
        if type_materiel_id:
            qs = qs.filter(materiel__type_id=type_materiel_id)
        return qs

    def perform_create(self, serializer):
        """Notifie tous les utilisateurs actifs après chaque mouvement, quel
        que soit son sens — sur demande explicite, pas seulement Admin/
        Superadmin (ex: rupture de stock, tout le monde est concerné,
        pas seulement la gestion). notify() s'auto-exclut déjà pour l'auteur
        du mouvement."""
        materiel = serializer.validated_data["materiel"]
        projet = serializer.validated_data.get("projet")
        employe = serializer.validated_data.get("employe")
        if serializer.validated_data["type_mouvement"] == "affectation":
            if projet:
                try:
                    verifier_coherence_projet(materiel, projet)
                except DjangoValidationError as e:
                    raise DRFValidationError({"projet": e.messages})
            try:
                verifier_disponibilite_affectation(materiel, projet, employe)
            except DjangoValidationError as e:
                raise DRFValidationError({"non_field_errors": e.messages})
        mouvement = serializer.save(enregistre_par=self.request.user)
        try:
            appliquer_mouvement(mouvement)
        except DjangoValidationError as e:
            mouvement.delete()
            raise DRFValidationError({"quantite": e.messages})

        materiel.refresh_from_db(fields=["quantite"])
        label = LABEL_SENS.get(mouvement.type_mouvement, mouvement.type_mouvement)
        for user in User.objects.filter(statut=StatutCompte.ACTIF, is_active=True):
            notify(
                user, "mouvement_materiel",
                f"{label} : {materiel.nom}",
                f"{label} de {mouvement.quantite} — stock restant : {materiel.quantite}",
                expediteur=self.request.user,
            )

        alerte = verifier_alerte_rupture(materiel)
        if alerte:
            notifier_gestionnaires_materiel(alerte, expediteur=self.request.user)

    def update(self, request, *args, **kwargs):
        return Response({"error": "Un mouvement de matériel ne peut pas être modifié (BNF-04)."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Un mouvement de matériel ne peut pas être modifié (BNF-04)."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Un mouvement de matériel ne peut pas être supprimé (BNF-04)."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


class AlerteMaterielViewSet(_ReadWritePermMixin, viewsets.ModelViewSet):
    """BF-08 à BF-11 : alertes automatiques (rupture de stock) et manuelles
    (anomalie/rappel) — immuables sauf transition `traiter` (même esprit que
    MouvementMaterielViewSet : pas d'update/destroy classiques)."""
    queryset = AlerteMateriel.objects.select_related("materiel", "cree_par", "traitee_par")
    serializer_class = AlerteMaterielSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)
        return qs

    def get_permissions(self):
        """BF-09 : le signalement d'anomalie est ouvert à tout utilisateur
        (materiel.read) ; seul le rappel est réservé à materiel.write — la
        distinction par type se fait dans perform_create, ici on ne pose que
        le plancher le plus bas pour l'action create."""
        if self.action == "create":
            return [HasPerm(self.read_perm)()]
        return super().get_permissions()

    def perform_create(self, serializer):
        """BF-09 : alerte manuelle (anomalie ou rappel — rupture_stock est
        exclusivement auto-générée, cf. verifier_alerte_rupture) ; rappel
        réservé à materiel.write ; anti-doublon (BNF-04) — refuse s'il existe
        déjà une alerte ouverte du même type pour ce matériel."""
        materiel = serializer.validated_data["materiel"]
        type_alerte = serializer.validated_data["type_alerte"]
        if type_alerte not in (TypeAlerte.ANOMALIE, TypeAlerte.RAPPEL):
            raise DRFValidationError({"type_alerte": "Seules les alertes anomalie ou rappel peuvent être créées manuellement."})
        if type_alerte == TypeAlerte.RAPPEL and not self.request.user.peut("materiel.write"):
            raise DRFValidationError({"type_alerte": "La création d'un rappel est réservée à la gestion du matériel."})
        if AlerteMateriel.objects.filter(materiel=materiel, type_alerte=type_alerte, statut=StatutAlerte.OUVERTE).exists():
            raise DRFValidationError({"type_alerte": "Une alerte de ce type est déjà ouverte pour ce matériel."})
        alerte = serializer.save(cree_par=self.request.user)
        notifier_gestionnaires_materiel(alerte, expediteur=self.request.user)

    def update(self, request, *args, **kwargs):
        return Response({"error": "Une alerte ne peut pas être modifiée, utilisez l'action traiter."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Une alerte ne peut pas être modifiée, utilisez l'action traiter."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Une alerte ne peut pas être supprimée."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=True, methods=["post"])
    def traiter(self, request, pk=None):
        """BF-10 : traitement d'une alerte ouverte."""
        alerte = self.get_object()
        if alerte.statut == StatutAlerte.TRAITEE:
            return Response({"error": "Cette alerte est déjà traitée."}, status=status.HTTP_400_BAD_REQUEST)
        alerte.statut = StatutAlerte.TRAITEE
        alerte.traitee_le = timezone.now()
        alerte.traitee_par = request.user
        alerte.save(update_fields=["statut", "traitee_le", "traitee_par"])
        return Response(AlerteMaterielSerializer(alerte).data)


@api_view(["GET"])
@permission_classes([HasPerm("materiel.read")])
def stock(request):
    """BF-12 : encart tableau de bord matériel — stock par type/projet,
    alertes ouvertes et derniers mouvements, en un seul appel."""
    data = calculer_stock(Materiel.objects.all())
    data["alertes_ouvertes"] = AlerteMateriel.objects.filter(statut=StatutAlerte.OUVERTE).count()
    derniers = MouvementMateriel.objects.select_related("materiel").order_by("-date_mouvement")[:5]
    data["derniers_mouvements"] = MouvementMaterielSerializer(derniers, many=True).data
    return Response(data)
