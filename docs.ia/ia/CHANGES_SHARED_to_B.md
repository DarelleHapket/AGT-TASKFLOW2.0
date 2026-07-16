# JOURNAL DES CHANGEMENTS PARTAGÉS — AGT TaskFlow

Toute modification qui touche un fichier PARTAGÉ ou le périmètre de l'équipe B
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

 À signaler au Poste B : TasksView.jsx affiche actuellement <Pencil> pour admin et <Eye> pour membre — c'est l'inverse du CDC.

---