# Session A-04 — 17 juillet 2026

**Poste :** A — Josué
**Périmètre :** Tâches · PERT · Gantt · Projets · Activités

---

## Tâches traitées

### 1. Étape 3.1 — Guards `is_chef_of_project()` dans `tasks.py`

Ajout d'un contrôle d'accès fin sur les routes d'écriture des tâches, remplaçant le guard `admin 403` seul (insuffisant : n'importe quel Chef pouvait modifier les tâches d'un projet qu'il ne dirigeait pas).

Modèle initial retenu (première itération) :
- `is_chef_of_project(conn, user_id, project_id)` : vérifie que l'utilisateur est le `chef_id` du projet
- `can_write_task()` : chef du projet **OU** responsable assigné (`task.responsible`)
- `DELETE` / `unarchive` réservés au chef du projet uniquement (le responsable ne peut pas supprimer/désarchiver)

### 2. Refonte du modèle de permissions — owner / chef / responsable (demande utilisateur, en cours de session)

Le modèle initial de l'Étape 3.1 a été remplacé suite à un nouveau besoin exprimé par l'utilisateur : permettre à **tout membre non-admin** de créer une tâche, y compris sans projet associé, et introduire la notion de **propriétaire (owner)**.

**Nouveau modèle de permissions (remplace l'Étape 3.1 initiale) :**

| Rôle sur une tâche | Droit |
|---|---|
| `owner` (créateur) | Édition complète, suppression, archive, désarchive |
| `chef_projet` (chef du projet lié) | Idem owner |
| `responsible` (assigné, ni owner ni chef) | Modification du champ **statut** uniquement |
| Aucun des trois | Lecture seule |

**Décisions actées avec l'utilisateur :**
- Pas de rattrapage automatique d'`owner_id` sur les tâches existantes (restent `NULL`, gérables seulement par chef de projet/admin jusqu'à reprise naturelle)
- Sécurité appliquée **à la fois** côté frontend (UI grisée) et côté backend (guard serveur), pour empêcher tout bypass via appel API direct

**Backend (`tasks.py`, réécrit) :**
- `is_owner()`, `is_chef_of_project()`, `is_responsible()`, `can_full_edit()`, `get_permission_level()`
- `POST /tasks/` : ouvert à tout non-admin, `owner_id` = créateur automatiquement
- `PUT /tasks/<id>` : `full` → tous champs ; `status_only` → seul `status` appliqué (autres champs ignorés silencieusement, sécurité anti-bypass) ; `read_only` → 403
- `DELETE`, `archive`, `unarchive` : `can_full_edit` uniquement
- Chaque tâche renvoyée par `GET /tasks/` embarque désormais un champ `permission` (`"full" | "status_only" | "read_only"`) calculé côté serveur, pour éviter toute divergence de logique avec le frontend

**Base de données (`database.py`) :**
- Migration Bloc 3 (non destructive) : `tasks.owner_id INTEGER DEFAULT NULL REFERENCES members(id)`

**Frontend :**
- `TasksView.jsx` : UI pilotée entièrement par `task.permission` reçu du backend (plus de recalcul de droits côté client) ; select statut inline pour `status_only` ; boutons Archive/Désarchive/Supprimer conditionnés à `full`
- `TaskModal.jsx` : suppression de `MemberModal` — un seul formulaire, tous les champs toujours visibles, `disabled` selon la permission ; en création, tous les projets sont proposés (tout membre peut créer une tâche liée à n'importe quel projet ou sans projet)
- `App.jsx` ⚠️ : ajout du handler `onStatusChange`, suppression de la prop `isChef` sur `TasksView`/`TaskModal` (obsolète avec le nouveau modèle)

### 3. Bugfix D-07 — Gestion de session défaillante

Deux symptômes rapportés par l'utilisateur, tous deux liés à `App.jsx` ne câblant pas les fonctions nécessaires (et non à une erreur de logique dans les hooks) :

**Symptôme 1 :** message "token invalide" au tout premier login, résolu seulement par un rafraîchissement manuel de page.
**Cause :** `useData()` déclenchait ses appels API dès le montage de `App`, avant même l'évaluation du guard `isLogged` (les hooks React s'exécutent dans l'ordre, indépendamment des `return` anticipés qui les suivent).

**Symptôme 2 :** après expiration de session (plusieurs heures d'inactivité), retour impossible à l'application — blocage sur "token invalide" en boucle.
**Cause :** aucun mécanisme ne détectait un `401` pour déclencher une déconnexion propre ; le token expiré restait indéfiniment en `localStorage`, et `isLogged` (basé uniquement sur la présence du token) restait `true`.

**Corrections apportées :**
- `client.js` : ajout de `setUnauthorizedHandler(fn)` — tout `401` reçu par `req()` déclenche ce callback avant de propager l'erreur
- `useData.js` : le hook accepte désormais un paramètre `isLogged` ; le chargement ne se déclenche que si `isLogged === true` ; reset complet de l'état (`error`, `tasks`, `pert`) quand `isLogged` repasse à `false` ; garde anti race-condition (jeton `_activeToken`) pour ignorer le résultat d'un appel en vol si un logout survient entre-temps
- `App.jsx` ⚠️ : `useData(isLogged)` (au lieu de `useData()`) + enregistrement de `api.setUnauthorizedHandler(() => logout())` au montage

**Note de correction en cours de session :** un premier round de correctifs sur `client.js`/`useAuth.js`/`useData.js` seul n'a pas suffi — le bug persistait car `App.jsx` n'avait pas reçu les deux branchements nécessaires (`useData(isLogged)` et l'enregistrement du handler). Corrigé et validé par l'utilisateur après audit complet du fichier.

---

## Fichiers touchés

| Fichier | Statut |
|---|---|
| `backend/database.py` | ✅ Migration Bloc 3 (`owner_id`) |
| `backend/routes/tasks.py` | ✅ Réécrit (modèle owner/chef/responsable) |
| `frontend/src/components/tasks/TasksView.jsx` | ✅ Réécrit (UI pilotée par `permission`) |
| `frontend/src/components/tasks/TaskModal.jsx` | ✅ Réécrit (formulaire unique) |
| `frontend/src/api/client.js` ⚠️ transversal | ✅ `setUnauthorizedHandler` ajouté |
| `frontend/src/hooks/useData.js` ⚠️ transversal | ✅ `isLogged` en paramètre, reset propre |
| `frontend/src/hooks/useAuth.js` ⚠️ transversal | ➖ Inchangé (déjà correct) |
| `frontend/src/App.jsx` ⚠️ transversal | ✅ Branchements `useData(isLogged)` + handler 401 |

---

## Décisions (D-xx, continu commun avec Poste B)

- **D-09** : Le modèle de permissions sur les tâches devient owner/chef_projet/responsable (remplace le modèle chef-seul de l'Étape 3.1 initiale). `owner_id` ajouté au schéma `tasks`.
- **D-10** : Pas de rattrapage automatique d'`owner_id` sur les tâches existantes créées avant la migration — restent `NULL`.
- **D-11** : La permission sur une tâche (`full`/`status_only`/`read_only`) est calculée côté backend et transmise au frontend via le champ `permission` de chaque tâche, plutôt que recalculée côté client.
- **D-12** : Gestion de session (D-07) corrigée : `useData` ne charge qu'après authentification confirmée ; tout 401 déclenche une déconnexion automatique propre via un handler enregistré dans `client.js`.

---

## Bugs

| ID | Fichier | Description | Priorité | Statut |
|---|---|---|---|---|
| D-07 | `App.jsx`, `useData.js`, `client.js` ⚠️ | Gestion de session défaillante (token invalide au 1er login + session expirée sans retour possible) | Bloquant | ✅ Fermé (A-04) |

---

## Changements transversaux à transmettre au Poste B

Voir `CHANGES_SHARED_to_B.md` — entrées ajoutées pour `client.js`, `useData.js`, `App.jsx`.

Résumé rapide pour Darelle :
- `useData()` prend maintenant un argument obligatoire en pratique : `useData(isLogged)`. Si Darelle appelle `useData()` ailleurs sans argument, le comportement par défaut (`isLogged = true`) préserve la rétrocompatibilité, mais il vaut mieux passer la vraie valeur.
- `client.js` expose une nouvelle fonction `setUnauthorizedHandler(fn)` — aucune fonction existante n'a changé de signature.
- `App.jsx` : les props `isChef` sur `<TasksView>` et `<TaskModal>` ont été retirées (le modèle de permissions ne s'appuie plus sur le rôle chef seul, mais sur `task.permission` calculé par tâche). Si Darelle s'appuyait sur `isChef` reçu par ces deux composants, il faut migrer vers la nouvelle logique de permission par tâche.

---

## Tâche suivante recommandée

```
A-05 :
  Étape 6.1 — guard modèle owner/chef sur activities.py (même logique que tasks.py)
  Étape 2.2 — PERT_CONTRACT.md (rapide, toujours en attente depuis A-02)
  Étape 4    — Gantt : flèches de dépendances, filtres membre/projet
  Étape 7    — Vérifier show_critical / show_overdue côté frontend
  Étape 8.2  — Mesure perf PERT (< 100 ms / 100 tâches)
```

Priorité suggérée : **Étape 6.1** en premier — `activities.py` a probablement le même défaut de guard que `tasks.py` avait avant l'Étape 3.1, et le nouveau modèle owner/chef doit y être répliqué pour rester cohérent.
