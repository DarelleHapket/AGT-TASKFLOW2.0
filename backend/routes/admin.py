# backend/routes/admin.py
#
# Export / import de la base SQLite — réservé aux permissions
# database.export / database.import (superadmin par défaut, extensible).
#
# Sécurité : avant tout import, l'ancienne base est sauvegardée
# automatiquement (taskflow_backup_<timestamp>.db) dans le même dossier
# que DB_PATH, pour permettre un retour arrière manuel en cas de problème.

import os
import shutil
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, send_file
from database import DB_PATH
from utils.auth import require_auth
from utils.rbac import has_permission

admin_bp = Blueprint("admin", __name__)


def _require_permission(current_user, code):
    """Retourne un tuple (ok, error_response)."""
    if has_permission(current_user["id"], code):
        return True, None
    return False, (jsonify({"error": "Permission refusée"}), 403)


@admin_bp.route("/export-db", methods=["GET"])
@require_auth
def export_db(current_user):
    ok, err = _require_permission(current_user, "database.export")
    if not ok:
        return err

    if not os.path.exists(DB_PATH):
        return jsonify({"error": "Base de données introuvable"}), 404

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    download_name = f"taskflow_export_{stamp}.db"
    return send_file(DB_PATH, as_attachment=True, download_name=download_name)


@admin_bp.route("/import-db", methods=["POST"])
@require_auth
def import_db(current_user):
    ok, err = _require_permission(current_user, "database.import")
    if not ok:
        return err

    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu (champ 'file' requis)"}), 400

    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({"error": "Nom de fichier vide"}), 400
    if not uploaded.filename.lower().endswith(".db"):
        return jsonify({"error": "Le fichier doit avoir l'extension .db"}), 400

    db_dir = os.path.dirname(os.path.abspath(DB_PATH)) or "."
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    backup_path = os.path.join(db_dir, f"taskflow_backup_{stamp}.db")

    try:
        # 1. Sauvegarde de l'ancienne base avant tout remplacement.
        if os.path.exists(DB_PATH):
            shutil.copy2(DB_PATH, backup_path)

        # 2. Écriture de la nouvelle base à un emplacement temporaire,
        #    puis remplacement atomique (os.replace) pour éviter une base
        #    corrompue si l'écriture est interrompue en cours de route.
        tmp_path = DB_PATH + ".importing"
        uploaded.save(tmp_path)
        os.replace(tmp_path, DB_PATH)

    except Exception as e:
        return jsonify({"error": f"Échec de l'import : {e}"}), 500

    return jsonify({
        "message": "Base importée avec succès.",
        "backup_created": os.path.basename(backup_path) if os.path.exists(backup_path) else None,
    })


@admin_bp.route("/backups", methods=["GET"])
@require_auth
def list_backups(current_user):
    """Liste les sauvegardes automatiques disponibles (nom + date + taille)."""
    ok, err = _require_permission(current_user, "database.export")
    if not ok:
        return err

    db_dir = os.path.dirname(os.path.abspath(DB_PATH)) or "."
    backups = []
    try:
        for fname in os.listdir(db_dir):
            if fname.startswith("taskflow_backup_") and fname.endswith(".db"):
                full = os.path.join(db_dir, fname)
                stat = os.stat(full)
                backups.append({
                    "name": fname,
                    "size_bytes": stat.st_size,
                    "modified_at": datetime.fromtimestamp(
                        stat.st_mtime, tz=timezone.utc
                    ).isoformat(),
                })
    except FileNotFoundError:
        pass

    backups.sort(key=lambda b: b["modified_at"], reverse=True)
    return jsonify(backups)
