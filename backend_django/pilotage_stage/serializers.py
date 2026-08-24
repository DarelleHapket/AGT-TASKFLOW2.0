from rest_framework import serializers

from .models import Branch, Edge, Node, PertStatut, PertTask, Sollicitation, SousTache, Tache, Transition


class NodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Node
        fields = ["num", "kind", "titre", "x", "y", "blocking", "detail"]


class EdgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Edge
        fields = ["from_num", "to_num", "label"]


class BranchSerializer(serializers.ModelSerializer):
    nodes = NodeSerializer(many=True, read_only=True)
    edges = EdgeSerializer(many=True, read_only=True)

    class Meta:
        model = Branch
        fields = ["slug", "nom", "nodes", "edges"]


class TransitionSerializer(serializers.ModelSerializer):
    par = serializers.SerializerMethodField()
    de = serializers.CharField(source="from_node.titre", read_only=True)
    vers = serializers.CharField(source="to_node.titre", read_only=True)

    class Meta:
        model = Transition
        fields = ["id", "de", "vers", "par", "commentaire", "created_at"]

    def get_par(self, obj):
        return obj.par.display_name() if obj.par else None


class SollicitationSerializer(serializers.ModelSerializer):
    de = serializers.SerializerMethodField()
    vers = serializers.SerializerMethodField()

    class Meta:
        model = Sollicitation
        fields = ["id", "de", "vers", "message", "created_at"]

    def get_de(self, obj):
        return obj.de.display_name() if obj.de else None

    def get_vers(self, obj):
        return obj.vers.display_name() if obj.vers else None


class SousTacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = SousTache
        fields = ["id", "tache", "titre", "statut", "ordre"]


class TacheSerializer(serializers.ModelSerializer):
    """ref_name distinct de projets.TacheSerializer pour éviter une collision
    de nom de composant dans le schéma OpenAPI (deux modèles 'Tache' différents)."""
    assignee_nom = serializers.SerializerMethodField()
    created_by_nom = serializers.SerializerMethodField()
    validateur_nom = serializers.SerializerMethodField()
    pert_task_nom = serializers.CharField(source="pert_task.name", read_only=True, default="")
    node = NodeSerializer(source="current_node", read_only=True)
    statut = serializers.CharField(read_only=True)
    sous_taches = SousTacheSerializer(many=True, read_only=True)
    transitions = TransitionSerializer(many=True, read_only=True)
    sollicitations = SollicitationSerializer(many=True, read_only=True)

    class Meta:
        model = Tache
        ref_name = "PilotageTache"
        fields = ["id", "titre", "description", "branch", "assignee", "assignee_nom",
                  "created_by_nom", "validateur", "validateur_nom", "pert_task",
                  "pert_task_nom", "node", "statut", "jour", "bloc", "benef", "note",
                  "ordre", "clos", "created_at", "sous_taches", "transitions", "sollicitations"]
        read_only_fields = ["clos"]

    def get_assignee_nom(self, obj):
        return obj.assignee.display_name() if obj.assignee else None

    def get_created_by_nom(self, obj):
        return obj.created_by.display_name() if obj.created_by else None

    def get_validateur_nom(self, obj):
        return obj.validateur.display_name() if obj.validateur else ""


class PertStatutSerializer(serializers.ModelSerializer):
    class Meta:
        model = PertStatut
        fields = ["id", "cle", "label", "couleur", "ordre"]


class PertTaskSerializer(serializers.ModelSerializer):
    statut_detail = PertStatutSerializer(source="statut", read_only=True)
    taches_total = serializers.SerializerMethodField()
    taches_faites = serializers.SerializerMethodField()

    class Meta:
        model = PertTask
        fields = ["id", "num", "name", "preds", "dur", "statut", "statut_detail",
                  "taches_total", "taches_faites"]

    def get_taches_total(self, obj):
        return obj.taches.count()

    def get_taches_faites(self, obj):
        return sum(1 for t in obj.taches.all() if t.statut == "fait")

    def validate_preds(self, value):
        if not isinstance(value, list) or not all(isinstance(v, int) for v in value):
            raise serializers.ValidationError("preds doit être une liste d'entiers.")
        return value

    def validate(self, data):
        preds = data.get("preds", getattr(self.instance, "preds", []))
        num = data.get("num", getattr(self.instance, "num", None))
        if num is not None and num in preds:
            raise serializers.ValidationError("Une tâche ne peut pas se précéder elle-même.")
        existants = set(PertTask.objects.exclude(pk=getattr(self.instance, "pk", None)).values_list("num", flat=True))
        if num is not None:
            existants.add(num)
        manquants = [p for p in preds if p not in existants]
        if manquants:
            raise serializers.ValidationError(f"Prédécesseurs inconnus : {manquants}")
        return data
