"""Export/import BD + sauvegardes — fusion de backend/routes/admin.py (Flask)
et team-tool/backend/backups (Postgres). Gardé derrière les permissions
database.export/database.import déjà seedées côté AGT (superadmin par défaut,
extensible via IBAC) plutôt qu'un rôle superadmin en dur."""
from django.http import FileResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from authentification.services import HasPerm

from . import services


@api_view(["GET"])
@permission_classes([HasPerm("database.export")])
def list_backups(request):
    return Response({"is_postgres": services.est_postgres(), "backups": services.lister()})


@api_view(["POST"])
@permission_classes([HasPerm("database.export")])
def create_backup(request):
    nom = services.creer()
    return Response({"created": nom}, status=201)


@api_view(["GET"])
@permission_classes([HasPerm("database.export")])
def download_backup(request, nom):
    chemin = services.telecharger(nom)
    if not chemin:
        return Response({"error": "Sauvegarde introuvable"}, status=404)
    return FileResponse(open(chemin, "rb"), as_attachment=True, filename=nom)


@api_view(["DELETE"])
@permission_classes([HasPerm("database.export")])
def delete_backup(request, nom):
    if not services.supprimer(nom):
        return Response({"error": "Sauvegarde introuvable"}, status=404)
    return Response({"deleted": nom})


@api_view(["POST"])
@permission_classes([HasPerm("database.import")])
def import_backup(request):
    if request.data.get("confirmation") != "REMPLACER":
        return Response({"error": "Confirmation requise : envoyer confirmation=\"REMPLACER\"."}, status=400)
    fichier = request.FILES.get("file")
    if not fichier:
        return Response({"error": "Aucun fichier reçu (champ 'file' requis)."}, status=400)
    try:
        services.restaurer(fichier)
    except Exception as e:
        return Response({"error": f"Import refusé : {e}"}, status=400)
    return Response({"message": "Base restaurée avec succès."})
