"""Sauvegardes — port de team-tool/backend/backups/services.py, adapté au
nom de projet AGT ERP. Remplace le mécanisme Flask de copie brute du fichier
SQLite (backend/routes/admin.py) : avec Postgres, on sauvegarde/restaure via
pg_dump/psql, pas via une copie de fichier.

En SQLite (dev/tests, comme côté team-tool), les commandes shell sont
neutralisées et un fichier vide fait office de sauvegarde — la vraie logique
(pg_dump/psql) n'est exercée qu'en production Postgres."""
import gzip
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings


def est_postgres():
    return "postgresql" in settings.DATABASES["default"]["ENGINE"]


def _backup_dir():
    d = Path(settings.BACKUP_DIR)
    d.mkdir(parents=True, exist_ok=True)
    return d


def lister():
    fichiers = sorted(_backup_dir().glob("*.sql.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        {"name": f.name, "size_bytes": f.stat().st_size,
         "modified_at": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat()}
        for f in fichiers
    ]


def creer(prefixe="backup"):
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    dest = _backup_dir() / f"{prefixe}_{stamp}.sql.gz"
    db = settings.DATABASES["default"]
    if est_postgres():
        dump = subprocess.run(
            ["pg_dump", "--clean", "--if-exists", "-h", db["HOST"], "-U", db["USER"], db["NAME"]],
            capture_output=True, check=True,
            env={"PGPASSWORD": db["PASSWORD"]},
        ).stdout
        with gzip.open(dest, "wb") as f:
            f.write(dump)
    else:
        # SQLite (dev/tests) : pas de pg_dump, on écrit un fichier placeholder.
        with gzip.open(dest, "wb") as f:
            f.write(b"-- placeholder (SQLite dev/test, pas de dump reel) --\n")
    return dest.name


def restaurer(fichier_upload):
    """Remplacement destructif : sauvegarde 'pre-import' d'abord (abandonne si
    elle échoue), puis restauration psql -v ON_ERROR_STOP=1."""
    creer(prefixe="pre-import")

    tmp = _backup_dir() / "_import_tmp.sql.gz"
    with open(tmp, "wb") as f:
        for chunk in fichier_upload.chunks():
            f.write(chunk)

    try:
        if est_postgres():
            db = settings.DATABASES["default"]
            with gzip.open(tmp, "rb") as f:
                sql = f.read()
            subprocess.run(
                ["psql", "-v", "ON_ERROR_STOP=1", "-h", db["HOST"], "-U", db["USER"], db["NAME"]],
                input=sql, check=True, env={"PGPASSWORD": db["PASSWORD"]},
            )
    finally:
        tmp.unlink(missing_ok=True)


def telecharger(nom):
    if ".." in nom:
        return None
    chemin = _backup_dir() / nom
    return chemin if chemin.exists() else None


def supprimer(nom):
    if ".." in nom:
        return False
    chemin = _backup_dir() / nom
    if chemin.exists():
        chemin.unlink()
        return True
    return False
