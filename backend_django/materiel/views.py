from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from authentification.services import HasPerm

from .models import Materiel, MouvementMateriel, TypeMateriel
from .serializers import MaterielSerializer, MouvementMaterielSerializer, TypeMaterielSerializer
from .services import appliquer_mouvement, calculer_stock, verifier_coherence_projet


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
        materiel = serializer.validated_data["materiel"]
        projet = serializer.validated_data.get("projet")
        if serializer.validated_data["type_mouvement"] == "affectation" and projet:
            try:
                verifier_coherence_projet(materiel, projet)
            except DjangoValidationError as e:
                raise DRFValidationError({"projet": e.messages})
        mouvement = serializer.save(enregistre_par=self.request.user)
        try:
            appliquer_mouvement(mouvement)
        except DjangoValidationError as e:
            mouvement.delete()
            raise DRFValidationError({"quantite": e.messages})

    def update(self, request, *args, **kwargs):
        return Response({"error": "Un mouvement de matériel ne peut pas être modifié (BNF-04)."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Un mouvement de matériel ne peut pas être modifié (BNF-04)."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Un mouvement de matériel ne peut pas être supprimé (BNF-04)."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


@api_view(["GET"])
@permission_classes([HasPerm("materiel.read")])
def stock(request):
    """BF-11 : quantités par type et par projet."""
    return Response(calculer_stock(Materiel.objects.all()))
