from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from authentification.services import HasPerm

from .models import (
    Candidat, Competence, Contrat, Disponibilite, Employe, Equipe, Formation,
    InscriptionFormation, OffreEmploi, Periodicite, Poste, Profil, Remuneration,
    Responsabilite, Signalement, StatutCandidature, StatutInscriptionFormation, TypeContrat,
)
from .serializers import (
    CandidatSerializer, CompetenceSerializer, ContratSerializer, DisponibiliteSerializer,
    EmployeSerializer, EquipeSerializer, FormationSerializer, InscriptionFormationSerializer,
    OffreEmploiSerializer, PosteSerializer, ProfilSerializer, RemunerationSerializer,
    ResponsabiliteSerializer, SignalementSerializer, TypeContratSerializer,
)
from .services import embaucher, terminer_inscription


class _ReadWritePermMixin:
    """list/retrieve -> <module>.read ; le reste -> <module>.write."""
    read_perm = "rh.read"
    write_perm = "rh.write"

    def get_permissions(self):
        code = self.read_perm if self.action in ("list", "retrieve") else self.write_perm
        return [HasPerm(code)()]


class CompetenceViewSet(_ReadWritePermMixin, viewsets.ModelViewSet):
    queryset = Competence.objects.all()
    serializer_class = CompetenceSerializer


class PosteViewSet(_ReadWritePermMixin, viewsets.ModelViewSet):
    queryset = Poste.objects.prefetch_related("responsabilites")
    serializer_class = PosteSerializer


class ResponsabiliteViewSet(_ReadWritePermMixin, viewsets.ModelViewSet):
    queryset = Responsabilite.objects.all()
    serializer_class = ResponsabiliteSerializer


class EquipeViewSet(_ReadWritePermMixin, viewsets.ModelViewSet):
    queryset = Equipe.objects.all()
    serializer_class = EquipeSerializer


class TypeContratViewSet(_ReadWritePermMixin, viewsets.ModelViewSet):
    queryset = TypeContrat.objects.all()
    serializer_class = TypeContratSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mon_profil(request):
    profil, _ = Profil.objects.get_or_create(utilisateur=request.user)
    return Response(ProfilSerializer(profil).data)


@api_view(["GET"])
@permission_classes([HasPerm("rh.read")])
def profil_detail(request, pk):
    profil = Profil.objects.filter(pk=pk).first()
    if not profil:
        return Response({"error": "Profil introuvable."}, status=status.HTTP_404_NOT_FOUND)
    return Response(ProfilSerializer(profil).data)


@api_view(["GET"])
@permission_classes([HasPerm("rh.read")])
def profil_par_utilisateur(request):
    """Utilisé par le formulaire « Créer un employé » : Admin choisit un
    membre (Utilisateur.id) dans la liste, pas directement un Profil.id."""
    utilisateur_id = request.query_params.get("utilisateur")
    profil = Profil.objects.filter(utilisateur_id=utilisateur_id).first()
    if not profil:
        return Response({"error": "Profil introuvable pour ce membre."}, status=status.HTTP_404_NOT_FOUND)
    return Response(ProfilSerializer(profil).data)


@api_view(["POST"])
@permission_classes([HasPerm("rh.employes.gerer")])
def creer_employe(request):
    """UC « Créer un employé et son contrat » (Document d'Analyse §4) — crée
    employé + contrat + première rémunération en une seule transaction."""
    profil_id = request.data.get("profil")
    profil = Profil.objects.filter(pk=profil_id).first()
    if not profil:
        return Response({"error": "Profil introuvable."}, status=status.HTTP_404_NOT_FOUND)
    if hasattr(profil, "employe"):
        return Response({"error": "Ce profil est déjà rattaché à un employé."}, status=status.HTTP_400_BAD_REQUEST)
    type_contrat = TypeContrat.objects.filter(pk=request.data.get("type_contrat")).first()
    if not type_contrat:
        return Response({"error": "Type de contrat introuvable."}, status=status.HTTP_400_BAD_REQUEST)
    montant = request.data.get("montant")
    periodicite = request.data.get("periodicite", Periodicite.MENSUELLE)
    date_embauche = request.data.get("date_embauche")
    date_debut = request.data.get("date_debut", date_embauche)
    if not date_embauche or montant is None:
        return Response({"error": "date_embauche et montant sont requis."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        employe = Employe.objects.create(profil=profil, date_embauche=date_embauche)
        contrat = Contrat.objects.create(employe=employe, type_contrat=type_contrat, date_debut=date_debut)
        remuneration = Remuneration.objects.create(contrat=contrat, montant=montant, periodicite=periodicite)
        from finances.services import generer_mouvement_salarial
        generer_mouvement_salarial(remuneration)

    return Response(EmployeSerializer(employe).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mon_salaire(request):
    """BNF-09 révisé : l'accès à son propre salaire est toujours permis,
    indépendamment des permissions RH générales."""
    profil = Profil.objects.filter(utilisateur=request.user).first()
    if not profil or not hasattr(profil, "employe"):
        return Response({"error": "Aucun statut d'employé rattaché à votre profil."}, status=status.HTTP_404_NOT_FOUND)
    return Response(EmployeSerializer(profil.employe).data)


@api_view(["GET"])
@permission_classes([HasPerm("rh.employes.gerer")])
def salaire_employe(request, pk):
    employe = Employe.objects.filter(pk=pk).first()
    if not employe:
        return Response({"error": "Employé introuvable."}, status=status.HTTP_404_NOT_FOUND)
    return Response(EmployeSerializer(employe).data)


class DisponibiliteViewSet(viewsets.ModelViewSet):
    serializer_class = DisponibiliteSerializer

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Disponibilite.objects.select_related("employe__profil__utilisateur")
        if user.is_superadmin() or user.peut("rh.disponibilite.gerer"):
            return qs
        return qs.filter(employe__profil__utilisateur=user)

    def _est_gestionnaire_ou_soi(self, request, employe_id):
        user = request.user
        if user.is_superadmin() or user.peut("rh.disponibilite.gerer"):
            return True
        employe = Employe.objects.filter(pk=employe_id).first()
        return bool(employe and employe.profil.utilisateur_id == user.id)

    def create(self, request, *args, **kwargs):
        if not self._est_gestionnaire_ou_soi(request, request.data.get("employe")):
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        if not self._est_gestionnaire_ou_soi(request, obj.employe_id):
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class OffreEmploiViewSet(viewsets.ModelViewSet):
    queryset = OffreEmploi.objects.select_related("poste")
    serializer_class = OffreEmploiSerializer
    permission_classes = [HasPerm("rh.recrutement.gerer")]


class CandidatViewSet(viewsets.ModelViewSet):
    queryset = Candidat.objects.select_related("offre")
    serializer_class = CandidatSerializer
    permission_classes = [HasPerm("rh.recrutement.gerer")]

    def update(self, request, *args, **kwargs):
        candidat = self.get_object()
        nouveau_statut = request.data.get("statut")
        response = super().update(request, *args, **kwargs)
        if response.status_code == 200 and nouveau_statut == StatutCandidature.RETENUE:
            candidat.refresh_from_db()
            try:
                embaucher(candidat)
            except ValueError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return response


class FormationViewSet(_ReadWritePermMixin, viewsets.ModelViewSet):
    queryset = Formation.objects.all()
    serializer_class = FormationSerializer
    write_perm = "rh.formations.gerer"


class InscriptionFormationViewSet(viewsets.ModelViewSet):
    queryset = InscriptionFormation.objects.select_related("employe__profil__utilisateur", "formation")
    serializer_class = InscriptionFormationSerializer
    permission_classes = [HasPerm("rh.formations.gerer")]

    def update(self, request, *args, **kwargs):
        inscription = self.get_object()
        if request.data.get("statut") == StatutInscriptionFormation.TERMINEE:
            terminer_inscription(inscription)
            return Response(InscriptionFormationSerializer(inscription).data)
        return super().update(request, *args, **kwargs)


class SignalementViewSet(viewsets.ModelViewSet):
    serializer_class = SignalementSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated()]
        return [HasPerm("rh.signalements.traiter")()]

    def get_queryset(self):
        """BNF-18 : visible uniquement par Admin et Superadmin — un membre ne
        voit même pas la liste de ses propres signalements après création
        (dépôt à sens unique, cohérent avec le canal de remontée décrit au
        Document d'Analyse §4)."""
        return Signalement.objects.select_related("auteur")

    def perform_create(self, serializer):
        serializer.save(auteur=self.request.user)
