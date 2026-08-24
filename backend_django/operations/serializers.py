from rest_framework import serializers

from .models import Besoin, Note, OrdreJournalier


class BesoinSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="projet.nom", read_only=True, default=None)
    activity_name = serializers.CharField(source="activite.nom", read_only=True, default=None)

    class Meta:
        model = Besoin
        fields = ["id", "titre", "description", "type", "statut", "projet", "activite",
                  "project_name", "activity_name", "cree_le"]


class NoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="projet.nom", read_only=True, default=None)
    activity_name = serializers.CharField(source="activite.nom", read_only=True, default=None)

    class Meta:
        model = Note
        fields = ["id", "titre", "contenu", "projet", "activite", "tache", "auteur",
                  "author_name", "project_name", "activity_name", "cree_le", "mis_a_jour_le"]
        read_only_fields = ["auteur"]

    def get_author_name(self, obj):
        return obj.auteur.display_name() if obj.auteur else None


class OrdreJournalierSerializer(serializers.ModelSerializer):
    description = serializers.CharField(source="tache.description", read_only=True)
    status = serializers.CharField(source="tache.statut", read_only=True)
    priority = serializers.CharField(source="tache.priorite", read_only=True)
    project_name = serializers.CharField(source="tache.projet.nom", read_only=True, default=None)

    class Meta:
        model = OrdreJournalier
        fields = ["id", "membre", "tache", "date", "ordre", "note", "heure_debut", "duree_min",
                  "description", "status", "priority", "project_name"]
