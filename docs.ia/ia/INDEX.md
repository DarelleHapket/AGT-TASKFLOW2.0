# INDEX DES SESSIONS — AGT TaskFlow

On AJOUTE une ligne par session terminée. On ne modifie jamais les lignes existantes.
Préfixe A- = poste backend, B- = poste frontend. Décisions D-xx numérotées en continu commun.

| Session | Date | Poste | Tâches traitées | Résumé | Rapport |
| ------- | ---- | ----- | --------------- | ------ | ------- |
| A-01 | 2026-07-16 | A — Josué | Lecture CDC, construction TODO.md, audit code, JWT guards `tasks.py`, inversion `isAdmin` dans `TasksView.jsx` | Schéma DB validé (migrations v2 OK). Admin = lecture seule implémenté back + front. Bugs B-01 (TaskModal) et B-02 (App.jsx cloche) ouverts. D-01 à D-03. | `docs/ia/reports/session_A-01.md` |
| A-02 | 2026-07-16 | A — Josué | Bug B-01 (`TaskModal.jsx` readOnly admin) · `pert.py` créé (4 tests OK) · PERT intégré dans `GET /tasks/` (D-05) · JWT guards `projects.py` + `activities.py` · `chef_name` dans `GET /projects/` | B-01 fermé. Moteur PERT backend validé. Étape 8.1 complète. D-04, D-05. Transversal : `useData.js` à mettre à jour (Étape 2.3). | `docs/ia/reports/session_A-02.md` |

| A-03 | 2026-07-17 | A — Josué | Étape 2.3 `useData.js` PERT backend · Audit UI/UX 8 bugs (B-03→B-10) tous fermés · AdminModal vue directeur (D-07) · `projects.py` chef_id POST + ownership PUT/DELETE (D-08) · `set_role.py` utilitaire | PERT branché sur backend. Bugs rôles corrigés (Chef/Membre/Admin). Vue admin refaite. Ownership projets backend + frontend. Transversal : `useData.js` et `App.jsx` modifiés — voir CHANGES_SHARED_to_B.md. D-06, D-07, D-08. | `docs/ia/reports/session_A-03.md` |

| A-04 | 2026-07-17 | A — Josué | Étape 3.1 guards `tasks.py` (puis refonte owner/chef/responsable, D-09) · migration `owner_id` (`database.py`) · `TasksView.jsx`/`TaskModal.jsx` réécrits (permission par tâche) · Bugfix D-07 session (token invalide 1er login + session expirée sans retour) | Modèle de permissions tâches remplacé par owner/chef_projet/responsable, calculé côté backend (`task.permission`). Session utilisateur fiabilisée : chargement conditionné à l'auth, déconnexion automatique sur 401. Transversal : `client.js`, `useData.js`, `App.jsx` modifiés — voir CHANGES_SHARED_to_B.md. D-09, D-10, D-11, D-12. | `docs/ia/reports/session_A-04.md` |