from django.db.models import ProtectedError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from notifications.services import notify

from .models import Permission, PermissionEffective, Role, StatutCompte, User
from .serializers import PermissionSerializer, RegisterSerializer, RoleSerializer, UserSerializer
from .services import HasPerm, IsSuperadmin, assign_role, grant_permission, revoke_permission, revoke_role


# ── Authentification (UC "Se connecter (JWT)" — cf. Document d'Analyse Module 1) ──

@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    """Connexion par email (CDC : « L'utilisateur saisit email et mot de passe »),
    pas par username — username reste l'identifiant technique Django interne."""
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response({"error": "Identifiants incorrects"}, status=status.HTTP_401_UNAUTHORIZED)
    if user.statut == StatutCompte.EN_ATTENTE:
        return Response({"error": "Compte en attente de validation par le Superadmin"}, status=status.HTTP_403_FORBIDDEN)
    if user.statut == StatutCompte.SUSPENDU:
        return Response({"error": "Compte suspendu"}, status=status.HTTP_403_FORBIDDEN)
    if user.statut == StatutCompte.SUPPRIME:
        return Response({"error": "Compte supprimé"}, status=status.HTTP_401_UNAUTHORIZED)
    if not user.check_password(password):
        return Response({"error": "Identifiants incorrects"}, status=status.HTTP_401_UNAUTHORIZED)
    token = RefreshToken.for_user(user)
    return Response({
        "access_token": str(token.access_token),
        "refresh_token": str(token),
        "user": UserSerializer(user).data,
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """Port de backend/routes/auth.py::register — notifie quiconque peut
    valider un compte (permission membres.validate, ou superadmin) d'une
    nouvelle demande (type_="register_request"), pour que la cloche les
    alerte sans qu'ils aient à revenir régulièrement sur /membres."""
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    new_user = serializer.save()

    destinataires = [
        u for u in User.objects.filter(statut=StatutCompte.ACTIF, is_active=True)
        if u.is_superadmin() or u.peut("membres.validate")
    ]
    for admin in destinataires:
        notify(
            admin, "register_request",
            f"Demande de compte : {new_user.display_name()}",
            f"{new_user.display_name()} ({new_user.email}) a soumis une demande de création de compte.",
            expediteur=new_user,
        )

    return Response({"message": "Demande envoyée. En attente de validation par le Superadmin."},
                     status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me(request):
    """PATCH : un membre modifie son propre compte (nom affiché, couleur
    d'avatar) après inscription — email/rôles/statut restent hors de portée
    ici (gérés par Admin/Superadmin via MembreViewSet)."""
    if request.method == "PATCH":
        user = request.user
        if "first_name" in request.data:
            first_name = (request.data.get("first_name") or "").strip()
            if not first_name:
                return Response({"error": "Le nom ne peut pas être vide."}, status=status.HTTP_400_BAD_REQUEST)
            user.first_name = first_name
        if "color" in request.data:
            user.color = request.data.get("color") or user.color
        user.save()
        return Response(UserSerializer(user).data)
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def changer_mdp(request):
    ancien = request.data.get("ancien") or ""
    nouveau = request.data.get("nouveau") or ""
    if not request.user.check_password(ancien):
        return Response({"error": "Ancien mot de passe incorrect"}, status=status.HTTP_400_BAD_REQUEST)
    if len(nouveau) < 6:
        return Response({"error": "Nouveau mot de passe : 6 caractères minimum"}, status=status.HTTP_400_BAD_REQUEST)
    request.user.set_password(nouveau)
    request.user.doit_changer_mdp = False
    request.user.save()
    return Response({"message": "Mot de passe changé."})


# ── Cycle de vie du compte (BUG-01 : Admin, pas seulement Superadmin, valide) ──

@api_view(["PUT"])
@permission_classes([HasPerm("membres.validate")])
def validate_member(request, pk):
    action = (request.data.get("action") or "").strip().lower()
    if action not in ("approve", "reject"):
        return Response({"error": "action doit être 'approve' ou 'reject'"}, status=status.HTTP_400_BAD_REQUEST)
    target = User.objects.filter(pk=pk, statut=StatutCompte.EN_ATTENTE).first()
    if not target:
        return Response({"error": "Demande introuvable ou déjà traitée"}, status=status.HTTP_404_NOT_FOUND)
    if action == "approve":
        target.statut = StatutCompte.ACTIF
        target.is_active = True
        assign_role(target, "user")
    else:
        target.statut = StatutCompte.SUPPRIME
        target.is_active = False
    target.save()
    return Response(UserSerializer(target).data)


@api_view(["PUT"])
@permission_classes([HasPerm("membres.suspend")])
def toggle_active(request, pk):
    target = User.objects.filter(pk=pk).exclude(statut=StatutCompte.SUPPRIME).first()
    if not target:
        return Response({"error": "Membre introuvable"}, status=status.HTTP_404_NOT_FOUND)
    if target.pk == request.user.pk:
        return Response({"error": "Vous ne pouvez pas suspendre votre propre compte."}, status=status.HTTP_403_FORBIDDEN)
    if target.statut == StatutCompte.SUSPENDU:
        target.statut = StatutCompte.ACTIF
        target.is_active = True
    else:
        target.statut = StatutCompte.SUSPENDU
        target.is_active = False
    target.save()
    return Response(UserSerializer(target).data)


class MembreViewSet(viewsets.ModelViewSet):
    """Équivalent de members.py (Flask) — CRUD des comptes, RBAC+IBAC via PermissionEffective."""
    queryset = User.objects.exclude(statut=StatutCompte.SUPPRIME).order_by("username")
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasPerm("membres.read")()]
        return [HasPerm("membres.write")()]

    def destroy(self, request, *args, **kwargs):
        membre = self.get_object()
        if membre.pk == request.user.pk:
            return Response({"error": "Vous ne pouvez pas supprimer votre propre compte."}, status=status.HTTP_403_FORBIDDEN)
        try:
            membre.statut = StatutCompte.SUPPRIME
            membre.is_active = False
            membre.deleted_at = timezone.now()
            membre.save()
            return Response({"deleted": membre.pk})
        except ProtectedError:
            return Response({"error": "Des données protégées référencent ce membre."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], permission_classes=[HasPerm("membres.write")])
    def deleted(self, request):
        """Historique des comptes supprimés — port de GET /members/deleted (Flask),
        réservé à l'admin/superadmin comme l'original (require_admin)."""
        qs = User.objects.filter(statut=StatutCompte.SUPPRIME).order_by("-deleted_at")
        return Response(UserSerializer(qs, many=True).data)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all().order_by("code")
    serializer_class = RoleSerializer
    permission_classes = [HasPerm("roles.manage")]


class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [HasPerm("permissions.manage")]


# ── Attribution de rôles / permissions directes (IBAC) ──

@api_view(["POST"])
@permission_classes([IsSuperadmin])
def assign_member_role(request, pk):
    target = User.objects.filter(pk=pk).first()
    if not target:
        return Response({"error": "Membre introuvable"}, status=status.HTTP_404_NOT_FOUND)
    role_code = request.data.get("role")
    if not Role.objects.filter(code=role_code).exists():
        return Response({"error": "Rôle inconnu"}, status=status.HTTP_400_BAD_REQUEST)
    assign_role(target, role_code, assigned_by=request.user)
    return Response(UserSerializer(target).data, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsSuperadmin])
def revoke_member_role(request, pk, role_code):
    target = User.objects.filter(pk=pk).first()
    if not target:
        return Response({"error": "Membre introuvable"}, status=status.HTTP_404_NOT_FOUND)
    revoke_role(target, role_code)
    return Response(UserSerializer(target).data)


@api_view(["GET"])
@permission_classes([IsSuperadmin])
def member_permissions_detail(request, pk):
    """Détail permission par permission pour un membre : d'où vient chaque
    permission (rôle vs directe/IBAC), pour que l'UI RBAC distingue les deux
    au lieu d'un simple total fusionné — cf. RBACView (frontend)."""
    target = User.objects.filter(pk=pk).first()
    if not target:
        return Response({"error": "Membre introuvable"}, status=status.HTTP_404_NOT_FOUND)
    catalogue = Permission.objects.all().order_by("module", "code")
    if target.is_superadmin():
        return Response([
            {"code": p.code, "module": p.module, "description": p.description, "granted": True, "source": "superadmin"}
            for p in catalogue
        ])
    effectives = {
        pe.permission_id: pe
        for pe in PermissionEffective.objects.filter(user=target).select_related("permission")
    }
    result = []
    for p in catalogue:
        pe = effectives.get(p.id)
        result.append({
            "code": p.code, "module": p.module, "description": p.description,
            "granted": bool(pe and pe.accordee), "source": pe.source if pe else None,
        })
    return Response(result)


@api_view(["PUT"])
@permission_classes([IsSuperadmin])
def set_member_permission(request, pk, perm_code):
    target = User.objects.filter(pk=pk).first()
    if not target:
        return Response({"error": "Membre introuvable"}, status=status.HTTP_404_NOT_FOUND)
    if request.data.get("granted"):
        grant_permission(target, perm_code)
    else:
        revoke_permission(target, perm_code)
    return Response(UserSerializer(target).data)
