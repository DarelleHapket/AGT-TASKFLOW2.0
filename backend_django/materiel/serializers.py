from rest_framework import serializers

from .models import Materiel, MouvementMateriel, TypeMateriel


class TypeMaterielSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeMateriel
        fields = ["id", "nom", "description"]


class MaterielSerializer(serializers.ModelSerializer):
    type_nom = serializers.CharField(source="type.nom", read_only=True)
    projet_nom = serializers.CharField(source="projet.nom", read_only=True, default=None)

    class Meta:
        model = Materiel
        fields = ["id", "nom", "description", "type", "type_nom", "quantite", "date_achat", "projet", "projet_nom"]
        read_only_fields = ["quantite"]  # tenu à jour par les mouvements (achat/rebut), pas saisi à la main


class MouvementMaterielSerializer(serializers.ModelSerializer):
    materiel_nom = serializers.CharField(source="materiel.nom", read_only=True)
    projet_nom = serializers.CharField(source="projet.nom", read_only=True, default=None)
    employe_nom = serializers.SerializerMethodField()

    class Meta:
        model = MouvementMateriel
        fields = [
            "id", "materiel", "materiel_nom", "type_mouvement", "quantite", "date_mouvement",
            "projet", "projet_nom", "employe", "employe_nom", "commentaire",
        ]
        read_only_fields = ["date_mouvement"]

    def get_employe_nom(self, obj):
        return obj.employe.profil.utilisateur.display_name() if obj.employe else None

    def validate(self, data):
        if data.get("projet") and data.get("employe"):
            raise serializers.ValidationError("Une affectation cible un projet OU un employé, pas les deux.")
        return data
