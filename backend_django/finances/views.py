from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from authentification.services import HasPerm

from .models import MouvementFinancier, Prevision, RapportFinancier, TypeMouvementFinancier
from .serializers import (
    MouvementFinancierSerializer, PrevisionSerializer, RapportFinancierSerializer,
    TypeMouvementFinancierSerializer,
)
from .services import calculer_bilan, comparer_prevision


class TypeMouvementFinancierViewSet(viewsets.ModelViewSet):
    queryset = TypeMouvementFinancier.objects.all()
    serializer_class = TypeMouvementFinancierSerializer
    permission_classes = [HasPerm("finances.mouvements.gerer")]


class MouvementFinancierViewSet(viewsets.ModelViewSet):
    """BNF-10 : non modifiable, non supprimable après création — une
    correction se fait par un nouveau mouvement inverse, jamais une édition."""
    queryset = MouvementFinancier.objects.select_related("type_mouvement", "projet", "employe__profil__utilisateur")
    serializer_class = MouvementFinancierSerializer
    permission_classes = [HasPerm("finances.mouvements.gerer")]

    def update(self, request, *args, **kwargs):
        return Response({"error": "Un mouvement financier ne peut pas être modifié (BNF-10)."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        return Response({"error": "Un mouvement financier ne peut pas être modifié (BNF-10)."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Un mouvement financier ne peut pas être supprimé (BNF-10)."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


class PrevisionViewSet(viewsets.ModelViewSet):
    queryset = Prevision.objects.select_related("projet", "employe__profil__utilisateur")
    serializer_class = PrevisionSerializer
    permission_classes = [HasPerm("finances.previsions.gerer")]


@api_view(["GET"])
@permission_classes([HasPerm("finances.bilan.voir")])
def bilan(request):
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")
    if not date_from or not date_to:
        return Response({"error": "date_from et date_to sont requis."}, status=status.HTTP_400_BAD_REQUEST)
    niveau = request.query_params.get("niveau")
    projet_id = request.query_params.get("projet")
    employe_id = request.query_params.get("employe")
    return Response(calculer_bilan(date_from, date_to, niveau=niveau, projet_id=projet_id, employe_id=employe_id))


@api_view(["GET"])
@permission_classes([HasPerm("finances.previsions.gerer")])
def prevision_ecart(request, pk):
    prevision = Prevision.objects.filter(pk=pk).first()
    if not prevision:
        return Response({"error": "Prévision introuvable."}, status=status.HTTP_404_NOT_FOUND)
    return Response(comparer_prevision(prevision))


@api_view(["POST"])
@permission_classes([HasPerm("finances.rapports.telecharger")])
def creer_rapport(request):
    """BF-29 : le PDF/TXT est généré côté client (comme le module rapports
    existant) — cet endpoint n'enregistre que le journal de génération."""
    serializer = RapportFinancierSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(genere_par=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)
