from rest_framework import serializers

from .models import (
    Candidat, Competence, Conge, Contrat, Disponibilite, Employe, Equipe, Formation,
    InscriptionFormation, NoteFrais, OffreEmploi, Poste, Profil, Remuneration,
    Responsabilite, Signalement, TypeContrat,
)


class CompetenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competence
        fields = ["id", "nom", "description"]


class ResponsabiliteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Responsabilite
        fields = ["id", "poste", "nom", "competences_requises"]


class PosteSerializer(serializers.ModelSerializer):
    responsabilites = ResponsabiliteSerializer(many=True, read_only=True)

    class Meta:
        model = Poste
        fields = ["id", "nom", "description", "responsabilites"]


class EquipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipe
        fields = ["id", "nom", "membres"]


class ProfilSerializer(serializers.ModelSerializer):
    nom = serializers.SerializerMethodField()
    poste_nom = serializers.CharField(source="poste.nom", read_only=True, default=None)
    est_employe = serializers.SerializerMethodField()
    employe_id = serializers.SerializerMethodField()

    class Meta:
        model = Profil
        fields = ["id", "utilisateur", "nom", "poste", "poste_nom", "competences", "est_employe", "employe_id"]
        read_only_fields = ["utilisateur"]

    def get_nom(self, obj):
        return obj.utilisateur.display_name()

    def get_est_employe(self, obj):
        return hasattr(obj, "employe")

    def get_employe_id(self, obj):
        return obj.employe.id if hasattr(obj, "employe") else None


class TypeContratSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeContrat
        fields = ["id", "nom", "description"]


class RemunerationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Remuneration
        fields = ["id", "contrat", "montant", "periodicite", "cree_le"]
        read_only_fields = ["cree_le"]


class ContratSerializer(serializers.ModelSerializer):
    remunerations = RemunerationSerializer(many=True, read_only=True)
    type_contrat_nom = serializers.CharField(source="type_contrat.nom", read_only=True)

    class Meta:
        model = Contrat
        fields = ["id", "employe", "type_contrat", "type_contrat_nom", "date_debut", "date_fin", "remunerations"]


class EmployeSerializer(serializers.ModelSerializer):
    nom = serializers.SerializerMethodField()
    contrats = ContratSerializer(many=True, read_only=True)

    class Meta:
        model = Employe
        fields = ["id", "profil", "nom", "date_embauche", "contrats"]

    def get_nom(self, obj):
        return obj.profil.utilisateur.display_name()


class DisponibiliteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Disponibilite
        fields = ["id", "employe", "statut", "periode_debut", "periode_fin"]


class OffreEmploiSerializer(serializers.ModelSerializer):
    poste_nom = serializers.CharField(source="poste.nom", read_only=True)

    class Meta:
        model = OffreEmploi
        fields = ["id", "poste", "poste_nom", "description", "statut"]


class CandidatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidat
        fields = ["id", "offre", "nom", "contact", "cv", "statut"]


class FormationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Formation
        fields = ["id", "nom", "description", "competences_visees"]


class InscriptionFormationSerializer(serializers.ModelSerializer):
    formation_nom = serializers.CharField(source="formation.nom", read_only=True)
    employe_nom = serializers.SerializerMethodField()

    class Meta:
        model = InscriptionFormation
        fields = ["id", "employe", "employe_nom", "formation", "formation_nom", "statut"]

    def get_employe_nom(self, obj):
        return obj.employe.profil.utilisateur.display_name()


class SignalementSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()

    class Meta:
        model = Signalement
        fields = ["id", "auteur", "auteur_nom", "description", "statut", "cree_le"]
        read_only_fields = ["auteur", "cree_le"]

    def get_auteur_nom(self, obj):
        return obj.auteur.display_name()


class CongeSerializer(serializers.ModelSerializer):
    employe_nom = serializers.SerializerMethodField()

    class Meta:
        model = Conge
        fields = ["id", "employe", "employe_nom", "date_debut", "date_fin", "motif", "statut", "commentaire_validation", "cree_le"]
        read_only_fields = ["employe", "cree_le"]

    def get_employe_nom(self, obj):
        return obj.employe.profil.utilisateur.display_name()


class NoteFraisSerializer(serializers.ModelSerializer):
    employe_nom = serializers.SerializerMethodField()

    class Meta:
        model = NoteFrais
        fields = ["id", "employe", "employe_nom", "montant", "motif", "date_depense", "statut", "commentaire_validation", "cree_le"]
        read_only_fields = ["employe", "cree_le"]

    def get_employe_nom(self, obj):
        return obj.employe.profil.utilisateur.display_name()
