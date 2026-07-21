#!/usr/bin/env python3
"""
reset_db_keep_admin.py — AGT TaskFlow

Vide TOUTES les données de la base SQLite, sauf le compte admin (Gabriel)
dans la table `members`. Utile pour repartir sur un environnement de test
propre sans avoir à reconstruire tout le schéma.

⚠️ DESTRUCTIF ET IRRÉVERSIBLE. Aucune sauvegarde n'est faite par ce script.
Si tu veux conserver les données actuelles, fais un dump avant de lancer ceci :
    sqlite3 taskflow.db .dump > backup_avant_reset.sql

Fonctionnement :
  1. Se connecte à la base SQLite pointée par la variable d'env DB_PATH
     (même mécanisme que backend/database.py — donc pas de désynchronisation
     possible avec la vraie configuration de l'app).
  2. Liste dynamiquement TOUTES les tables présentes (via sqlite_master),
     sans les coder en dur — donc robuste même si le schéma a évolué depuis
     la dernière fois que ce script a été écrit (ex: tables ajoutées par
     un autre développeur).
  3. Désactive temporairement les contraintes FOREIGN KEY pour pouvoir vider
     les tables dans n'importe quel ordre sans erreur de cascade.
  4. Vide toutes les tables SAUF `members`.
  5. Dans `members` : supprime tout SAUF la ligne dont l'email correspond
     à celui de Gabriel (identifiant fiable, contrairement au nom qui
     pourrait théoriquement varier).
  6. Réinitialise les compteurs AUTOINCREMENT (table sqlite_sequence) pour
     que les prochains inserts repartent d'IDs bas et lisibles.
  7. Réactive les contraintes FOREIGN KEY.
  8. Affiche un résumé de ce qui a été fait.

Une confirmation explicite est demandée avant toute suppression.
"""

import sqlite3
import os
import sys

DB_PATH = os.environ.get("DB_PATH", "taskflow.db")
ADMIN_EMAIL = "gabriel@ag-technologies.tech"


def get_all_tables(conn):
    """Liste toutes les tables utilisateur (exclut les tables système SQLite)."""
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    return [r[0] for r in rows]


def main():
    if not os.path.exists(DB_PATH):
        print(f"❌ Base introuvable : {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    tables = get_all_tables(conn)
    if "members" not in tables:
        print("❌ Table 'members' introuvable — le script ne peut pas garantir la préservation de l'admin. Abandon.")
        conn.close()
        sys.exit(1)

    admin = conn.execute(
        "SELECT id, name, email FROM members WHERE email = ?", (ADMIN_EMAIL,)
    ).fetchone()

    if not admin:
        print(f"❌ Aucun compte trouvé avec l'email {ADMIN_EMAIL} — abandon pour éviter de tout supprimer sans admin restant.")
        conn.close()
        sys.exit(1)

    # ── Confirmation explicite ───────────────────────────────────────────────
    print("=" * 60)
    print("⚠️  PURGE COMPLÈTE DE LA BASE — ACTION IRRÉVERSIBLE")
    print("=" * 60)
    print(f"Base ciblée : {DB_PATH}")
    print(f"Tables trouvées ({len(tables)}) : {', '.join(sorted(tables))}")
    print(f"Compte conservé : {admin['name']} ({admin['email']}, id={admin['id']})")
    print("Toutes les autres données seront définitivement supprimées.")
    print("=" * 60)

    confirm = input("Tape EXACTEMENT 'RESET' pour confirmer : ").strip()
    if confirm != "RESET":
        print("Annulé — aucune donnée n'a été modifiée.")
        conn.close()
        sys.exit(0)

    # ── Purge ─────────────────────────────────────────────────────────────
    conn.execute("PRAGMA foreign_keys = OFF")

    summary = []
    for table in tables:
        if table == "members":
            deleted = conn.execute(
                "DELETE FROM members WHERE email != ?", (ADMIN_EMAIL,)
            ).rowcount
            summary.append(f"  members       : {deleted} ligne(s) supprimée(s), 1 conservée (admin)")
        elif table == "sqlite_sequence":
            continue  # gérée séparément plus bas
        else:
            deleted = conn.execute(f"DELETE FROM {table}").rowcount
            summary.append(f"  {table:<14}: {deleted} ligne(s) supprimée(s)")

    # Réinitialise les compteurs AUTOINCREMENT pour toutes les tables vidées
    if "sqlite_sequence" in tables:
        conn.execute("DELETE FROM sqlite_sequence WHERE name != 'members'")
        # Remet le compteur members au niveau de l'id de l'admin conservé
        conn.execute(
            "UPDATE sqlite_sequence SET seq = ? WHERE name = 'members'",
            (admin["id"],)
        )

    conn.execute("PRAGMA foreign_keys = ON")
    conn.commit()
    conn.close()

    print("\n✅ Purge terminée.\n")
    print("Résumé :")
    for line in summary:
        print(line)
    print(f"\nSeul compte restant : {admin['name']} ({admin['email']})")


if __name__ == "__main__":
    main()
