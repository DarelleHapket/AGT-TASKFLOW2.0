from django.utils.crypto import get_random_string
from rest_framework import serializers

from .models import Permission, Role, StatutCompte, User

# Port de backend/routes/members.py::COLORS — assignation cyclique à la création.
COLORS = [
    "#6366f1", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6",
    "#f97316", "#06b6d4", "#84cc16", "#ef4444", "#3b82f6",
]


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "module", "description"]


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(), many=True, write_only=True,
        source="permissions", required=False,
    )

    class Meta:
        model = Role
        fields = ["id", "code", "description", "permissions", "permission_ids"]


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    permissions_effectives = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "name", "first_name", "last_name", "email",
            "is_superuser", "is_active", "statut", "doit_changer_mdp", "color",
            "roles", "permissions_effectives", "deleted_at",
        ]
        read_only_fields = ["is_superuser", "doit_changer_mdp", "statut", "deleted_at"]

    def get_name(self, obj):
        return obj.display_name()

    def get_roles(self, obj):
        return obj.roles_codes()

    def get_permissions_effectives(self, obj):
        if obj.is_superadmin():
            return ["*"]
        return [p.code for p in obj.permissions_effectives()]


class RegisterSerializer(serializers.ModelSerializer):
    """Demande de compte (BF-01) : statut EN_ATTENTE jusqu'à validation Superadmin.
    Connexion par email (CDC) — username reste l'identifiant technique Django,
    dérivé de l'email pour ne pas demander un champ de plus au formulaire."""
    password = serializers.CharField(write_only=True, min_length=6)
    name = serializers.CharField(source="first_name")

    class Meta:
        model = User
        fields = ["name", "email", "password"]

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet email.")
        return value

    def create(self, validated):
        password = validated.pop("password")
        email = validated["email"]
        username = email.split("@")[0] + "-" + get_random_string(4)
        color = COLORS[User.objects.count() % len(COLORS)]
        user = User(username=username, **validated, statut=StatutCompte.EN_ATTENTE, is_active=False, color=color)
        user.set_password(password)
        user.save()
        return user
