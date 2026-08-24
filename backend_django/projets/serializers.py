from rest_framework import serializers

from .acces import can_edit_activity, get_project_role, get_task_permission_level
from .models import Activite, Difficulte, MembreProjet, Projet, Tache


class ProjetSerializer(serializers.ModelSerializer):
    chef_name = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = Projet
        fields = ["id", "nom", "description", "date_creation", "chef_name", "member_count", "user_role"]

    def get_chef_name(self, obj):
        owner = obj.membres.filter(role=MembreProjet.OWNER).select_related("utilisateur").first()
        return owner.utilisateur.display_name() if owner else None

    def get_member_count(self, obj):
        return obj.membres.count()

    def get_user_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return get_project_role(request.user, obj.pk)


class MembreProjetSerializer(serializers.ModelSerializer):
    nom = serializers.SerializerMethodField()

    def get_nom(self, obj):
        return obj.utilisateur.display_name()

    class Meta:
        model = MembreProjet
        fields = ["id", "utilisateur", "nom", "role", "rejoint_le"]


class ActiviteSerializer(serializers.ModelSerializer):
    can_edit = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="projet.nom", read_only=True)

    class Meta:
        model = Activite
        fields = ["id", "nom", "description", "projet", "project_name", "createur", "can_edit"]

    def get_can_edit(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return can_edit_activity(request.user, obj)


class TacheSerializer(serializers.ModelSerializer):
    dependances = serializers.PrimaryKeyRelatedField(many=True, queryset=Tache.objects.all(), required=False)
    permission = serializers.SerializerMethodField()
    es = serializers.SerializerMethodField()
    ef = serializers.SerializerMethodField()
    ls = serializers.SerializerMethodField()
    lf = serializers.SerializerMethodField()
    slack = serializers.SerializerMethodField()
    critical = serializers.SerializerMethodField()

    class Meta:
        model = Tache
        fields = [
            "id", "description", "projet", "activite", "responsable", "createur",
            "duree", "statut", "priorite", "date_creation", "date_completion",
            "date_debut", "date_fin", "date_echeance", "est_archivee", "archivee_le",
            "dependances", "permission", "es", "ef", "ls", "lf", "slack", "critical",
        ]
        read_only_fields = ["date_creation", "createur"]

    def _pert(self, obj):
        return (self.context.get("pert_map") or {}).get(obj.id, {})

    def get_permission(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return get_task_permission_level(request.user, obj)

    def get_es(self, obj): return self._pert(obj).get("es")
    def get_ef(self, obj): return self._pert(obj).get("ef")
    def get_ls(self, obj): return self._pert(obj).get("ls")
    def get_lf(self, obj): return self._pert(obj).get("lf")
    def get_slack(self, obj): return self._pert(obj).get("slack")
    def get_critical(self, obj): return self._pert(obj).get("critical")


class DifficulteSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    def get_member_name(self, obj):
        return obj.membre.display_name()

    class Meta:
        model = Difficulte
        fields = ["id", "tache", "membre", "member_name", "contenu", "cree_le"]
        read_only_fields = ["membre"]
