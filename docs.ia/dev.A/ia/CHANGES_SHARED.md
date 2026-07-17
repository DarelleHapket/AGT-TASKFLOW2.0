# JOURNAL DES CHANGEMENTS PARTAGÉS — AGT TaskFlow

Toute modification qui touche un fichier PARTAGÉ ou le périmètre de l'autre équipe
DOIT être déclarée ici AVANT le push. On n'ajoute qu'en bas. On ne modifie jamais
une entrée existante. On fait `git pull` avant d'écrire.

Fichiers considérés comme partagés / transversaux :

- backend/database.py (schéma commun)
- backend/utils/auth.py (auth & rôles)
- backend/app.py (enregistrement des blueprints)
- frontend/src/App.jsx (shell)
- frontend/src/hooks/useData.js (état global)
- frontend/src/api/client.js (contrat API)
- - tout fichier appartenant au périmètre de l'autre poste

Format d'une entrée :

- Date · Poste (A/B) · Fichier(s) · Nature du changement · Impact pour l'autre · Action requise

---

## Entrées

- 2026-07-16 · B (Darelle) · database.py · Ajout colonne `role` sur `members` (migration non-destructive, DEFAULT 'membre' + backfill depuis is_admin) · Impact A : le token et /api/auth/\* renvoient désormais un champ `role` (additif, rien de cassé) · Action A : aucune, sauf si tu veux lire `role` côté tasks/projects.

- 2026-07-16 · B (Darelle) · utils/auth.py · Ajout décorateur `require_role(*roles)` (require_auth et require_admin INCHANGÉS) · Impact A : nouveau décorateur disponible, l'existant ne change pas · Action A : aucune.

- 2026-07-16 · B (Darelle) · routes/auth.py · login + /me renvoient `role` dans user et dans le token JWT · Impact A : réponse API enrichie (additif) · Action A : aucune.

- 2026-07-16 · B (Darelle) · database.py · Ajout colonne `chef_id` sur `projects` (migration non-destructive, DEFAULT NULL, réf. members.id) · Impact A : ta table projects a une colonne en plus ; ton `SELECT *` la renverra automatiquement · Action A : PULL avant de retravailler projects.py, sinon conflit Git.

- 2026-07-16 · B (Darelle) · routes/projects.py · AJOUT d'une seule route `PUT /api/projects/<id>/chef` (désigner le chef, réservée admin) + imports auth. Tes 4 routes CRUD (GET/POST/PUT/DELETE) sont STRICTEMENT INCHANGÉES · Impact A : nouvelle route dans ton fichier · Action A : PULL avant d'éditer projects.py. NB : tes routes CRUD ne sont toujours pas protégées par auth — à sécuriser de ton côté quand tu veux.

- 2026-07-16 · B (Darelle) · frontend/src/App.jsx · Cloche de notifications ouverte aussi au chef_projet (avant : admin uniquement) · Impact A : condition d'affichage modifiée dans le shell · Action A : PULL avant d'éditer App.jsx.
