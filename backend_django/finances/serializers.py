from rest_framework import serializers

from .models import MouvementFinancier, Prevision, RapportFinancier, TypeMouvementFinancier


class TypeMouvementFinancierSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeMouvementFinancier
        fields = ["id", "nom", "description", "sens"]


class MouvementFinancierSerializer(serializers.ModelSerializer):
    type_nom = serializers.CharField(source="type_mouvement.nom", read_only=True)
    sens = serializers.CharField(source="type_mouvement.sens", read_only=True)
    projet_nom = serializers.CharField(source="projet.nom", read_only=True, default=None)
    employe_nom = serializers.SerializerMethodField()

    class Meta:
        model = MouvementFinancier
        fields = ["id", "type_mouvement", "type_nom", "sens", "montant", "date_mouvement",
                  "niveau", "projet", "projet_nom", "employe", "employe_nom", "remuneration"]
        read_only_fields = ["date_mouvement", "remuneration"]

    def get_employe_nom(self, obj):
        return obj.employe.profil.utilisateur.display_name() if obj.employe else None

    def validate(self, data):
        niveau = data.get("niveau")
        projet = data.get("projet")
        employe = data.get("employe")
        if niveau == "entreprise" and (projet or employe):
            raise serializers.ValidationError("Niveau 'entreprise' : ni projet ni employé ne doivent être renseignés.")
        if niveau == "projet" and not projet:
            raise serializers.ValidationError("Niveau 'projet' : un projet doit être renseigné.")
        if niveau == "employe" and not employe:
            raise serializers.ValidationError("Niveau 'employé' : un employé doit être renseigné.")
        return data


class PrevisionSerializer(serializers.ModelSerializer):
    projet_nom = serializers.CharField(source="projet.nom", read_only=True, default=None)
    employe_nom = serializers.SerializerMethodField()

    class Meta:
        model = Prevision
        fields = ["id", "periode_debut", "periode_fin", "montant_prevu", "niveau",
                  "projet", "projet_nom", "employe", "employe_nom"]

    def get_employe_nom(self, obj):
        return obj.employe.profil.utilisateur.display_name() if obj.employe else None


class RapportFinancierSerializer(serializers.ModelSerializer):
    genere_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = RapportFinancier
        fields = ["id", "genere_par", "genere_par_nom", "format", "periode_debut", "periode_fin", "genere_le"]
        read_only_fields = ["genere_par", "genere_le"]

    def get_genere_par_nom(self, obj):
        return obj.genere_par.display_name()
