from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from authentification.services import HasPerm

from notifications.services import notify

from .models import (
    Candidat, Competence, Conge, Contrat, Disponibilite, Employe, Equipe, Formation,
    InscriptionFormation, NoteFrais, OffreEmploi, Periodicite, Poste, Profil, Remuneration,
    Responsabilite, Signalement, StatutCandidature, StatutDemande, StatutInscriptionFormation, TypeContrat,
)
from .serializers import (
    CandidatSerializer, CompetenceSerializer, CongeSerializer, ContratSerializer,
    DisponibiliteSerializer, EmployeSerializer, EquipeSerializer, FormationSerializer,
    InscriptionFormationSerializer, NoteFraisSerializer, OffreEmploiSerializer, PosteSerializer,
    ProfilSerializer, RemunerationSerializer, ResponsabiliteSerializer, SignalementSerializer,
    TypeContratSerializer,
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
    """Lecture ouverte à tout authentifié (annuaire des compétences,
    non sensible) — seule l'écriture reste réservée à rh.write."""
    queryset = Competence.objects.all()
    serializer_class = CompetenceSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return super().get_permissions()


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


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profil_detail(request, pk):
    """Lecture (poste/compétences) ouverte à tout authentifié — un membre
    peut consulter la fiche d'un collègue (annuaire), pas seulement la
    sienne. Le salaire reste un endpoint séparé (salaire_employe),
    réservé à rh.employes.gerer : ce n'est pas exposé ici. L'écriture
    (assigner un poste/des compétences) reste réservée à rh.write."""
    profil = Profil.objects.filter(pk=pk).first()
    if not profil:
        return Response({"error": "Profil introuvable."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "PATCH":
        if not request.user.is_superadmin() and not request.user.peut("rh.write"):
            return Response({"error": "Permission requise : rh.write"}, status=status.HTTP_403_FORBIDDEN)
        serializer = ProfilSerializer(profil, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    return Response(ProfilSerializer(profil).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profil_par_utilisateur(request):
    """Utilisé par le formulaire « Créer un employé » (Admin choisit un
    membre par Utilisateur.id) et par la fiche membre (lecture annuaire,
    cf. profil_detail) — même ouverture, mêmes raisons."""
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


class _DemandeSalarieMixin:
    """Commun à Congé et Note de frais (espace salarié, hors CDC initial) :
    l'employé pose sa demande et voit ses propres demandes ; un gestionnaire
    RH (permission `<gerer_perm>`) voit tout et valide/refuse."""
    gerer_perm = None  # ex: "rh.conges.gerer"

    def get_permissions(self):
        if self.action in ("update", "partial_update"):
            return [HasPerm(self.gerer_perm)()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset_base()
        if user.is_superadmin() or user.peut(self.gerer_perm):
            return qs
        return qs.filter(employe__profil__utilisateur=user)

    def create(self, request, *args, **kwargs):
        profil = Profil.objects.filter(utilisateur=request.user).first()
        if not profil or not hasattr(profil, "employe"):
            return Response({"error": "Aucun statut d'employé rattaché à votre profil."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(employe=profil.employe, statut=StatutDemande.EN_ATTENTE)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        if response.status_code == 200:
            obj = self.get_object()
            notify(
                obj.employe.profil.utilisateur, self.notif_type,
                f"{self.notif_label} {obj.get_statut_display().lower()}",
                obj.commentaire_validation or "",
                expediteur=request.user,
            )
        return response

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        user = request.user
        is_owner = obj.employe.profil.utilisateur_id == user.id
        is_manager = user.is_superadmin() or user.peut(self.gerer_perm)
        if not (is_manager or (is_owner and obj.statut == StatutDemande.EN_ATTENTE)):
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class CongeViewSet(_DemandeSalarieMixin, viewsets.ModelViewSet):
    serializer_class = CongeSerializer
    gerer_perm = "rh.conges.gerer"
    notif_type = "conge_traite"
    notif_label = "Votre demande de congé a été"

    def queryset_base(self):
        return Conge.objects.select_related("employe__profil__utilisateur")


class NoteFraisViewSet(_DemandeSalarieMixin, viewsets.ModelViewSet):
    serializer_class = NoteFraisSerializer
    gerer_perm = "rh.notes_frais.gerer"
    notif_type = "note_frais_traitee"
    notif_label = "Votre note de frais a été"

    def queryset_base(self):
        return NoteFrais.objects.select_related("employe__profil__utilisateur")
