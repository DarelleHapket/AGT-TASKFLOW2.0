# TODO.md — Poste A (Josué) | AGT TaskFlow
**Périmètre :** Tâches · PERT · Gantt · Projets · Activités  
**Mis à jour :** Session A-05 — 21 juillet 2026  
**Référence CDC :** version 1.0 BROUILLON, 14 juillet 2026

> **Légende**
> - `[ ]` À faire
> - `[~]` Partiel / à corriger
> - `[x]` Terminé
> - **P1** Indispensable au lancement · **P2** Version 1.0 · **P3** Futur
> - 🔗 Dépend du Poste B (Darelle)
> - ⚠️ Fichier transversal — signaler au Poste B

---

## Étape 0 — Audit du code réel ✅ Complété

- [x] Lire `backend/database.py`
- [x] Lire `backend/routes/tasks.py`
- [x] Lire `frontend/src/utils/pert.js`
- [x] Lire `frontend/src/hooks/useData.js`
- [x] Lire `frontend/src/components/tasks/TasksView.jsx`
- [x] Lire `backend/utils/auth.py`
- [x] Lire `frontend/src/components/tasks/TaskModal.jsx` — B-01 (A-02), B-03/09/10 (A-03)
- [x] Lire `frontend/src/api/client.js`
- [x] Lire `backend/routes/projects.py` (A-03)
- [x] Lire `frontend/src/hooks/useAuth.js` (A-04)
- [x] Lire `frontend/src/App.jsx` en entier (A-04)

---

## Étape 1 — Stabilisation BDD ✅ Validée

### 1.1 Champ `priority` [P1]
- [x] Présent dans schéma `tasks`
- [x] Lu/écrit dans `tasks.py`
- [x] Exposé en saisie dans `TaskModal.jsx`

### 1.2 Champ `is_archived` + `archived_at` [P2]
- [x] Présents via migrations v2
- [x] Endpoints `PATCH /archive` et `PATCH /unarchive` protégés

### 1.3 Champs de dates [P2]
- [x] Présents via migrations v2
- [x] Lus/écrits dans `tasks.py`
- [x] Exposés en saisie dans `TaskModal.jsx`

### 1.4 Champ `owner_id` [P1] ✅ (A-04)
- [x] Migration Bloc 3 non destructive dans `database.py`
- [x] `NULL` pour les tâches existantes (pas de rattrapage automatique, D-10)
- [x] Renseigné automatiquement à la création (`POST /tasks/`)

---

## Étape 2 — PERT côté backend [P1] ✅ Backend complet

### 2.1 Moteur PERT backend [P1] ✅
- [x] `backend/utils/pert.py` créé (A-02)
- [x] `compute_pert()` appelé dans `GET /tasks/` (A-02)
- [x] Champs PERT dans la réponse : `es`, `ef`, `ls`, `lf`, `slack`, `critical` (D-05, A-02)

### 2.2 Contrat API — 🔗 coordination Poste B [P1]
- [~] D-05 défini (format champs plats + cas cycle)
- [ ] Documenter dans `docs/ia/PERT_CONTRACT.md` et transmettre à Darelle
- [ ] **Ajout A-04 :** documenter aussi le nouveau champ `permission` (`full`/`status_only`/`read_only`) désormais présent sur chaque tâche de `GET /tasks/`, utile si Darelle l'exploite dans ses rapports

### 2.3 Frontend : branché sur le PERT backend [P1] ✅ (A-03)
- [x] `useData.js` ⚠️ : `computePERT` retiré, `buildPertFromTasks()` lit les champs backend (A-03)
- [x] Double format D-05 géré : tableau plat + `{tasks, pert_cycle_ids}` (A-03)
- [x] `pert` migré en état explicite `useState` (A-03)
- [x] `PERTView.jsx` et `GanttView.jsx` : aucune modification requise (A-03)
- [x] **D-06** : PERT post-mutation figé jusqu'à `reload()` — non bloquant, laissé en l'état ; `setTasks` locaux suffisent pour l'usage courant (réévaluer en A-05 si signalé par les utilisateurs)

### 2.4 Tests PERT [P1] ✅
- [x] Cas 1 : graphe linéaire A→B→C → slack = 0 partout ✅
- [x] Cas 2 : deux chemins parallèles → seul le plus long est critique ✅
- [x] Cas 3 : pas de dépendances → ES=0 partout ✅
- [x] Cas 4 : cycle détecté → CycleError avec liste des IDs ✅

---

## Étape 3 — Tâches : contrôle d'accès par rôle [P1] ✅ Complété (A-04, modèle étendu)

> D-01 : Admin 403 sur écritures ✅ (A-01).
> D-08 : ownership projets implémenté (A-03).
> **D-09 (A-04) : le modèle initial "Chef uniquement" est remplacé par owner / chef_projet / responsable.**
> 🔗 Dépend du Poste B : `members.role` opérationnel.

### 3.1 Backend : guards dans `routes/tasks.py` [P1] ✅ (A-04)
- [x] `@require_auth` + admin 403 fait (A-01)
- [x] Helpers `is_owner()`, `is_chef_of_project()`, `is_responsible()`, `can_full_edit()`, `get_permission_level()`
- [x] `POST /tasks/` → ouvert à tout non-admin, `owner_id` = créateur automatique
- [x] `PUT /tasks/<id>` → `full` : tous champs ; `status_only` : `status` uniquement (autres champs ignorés, sécurité anti-bypass) ; `read_only` : 403
- [x] `DELETE`, `PATCH archive/unarchive` → `can_full_edit` uniquement (owner ou chef du projet)
- [x] Champ `permission` calculé et renvoyé sur chaque tâche de `GET /tasks/`

### 3.2 Frontend : `TaskModal.jsx` [P1] ✅ (A-04, réécrit)
- [x] Admin → AdminModal (vue directeur, D-07 A-03) ✅ inchangé
- [x] `MemberModal` séparé supprimé — formulaire unique piloté par `task.permission`
- [x] `full` → tous les champs actifs
- [x] `status_only` → seul le champ statut actif, reste grisé
- [x] `read_only` → tout grisé, bandeau explicatif affiché
- [x] Mode création : projets non filtrés (tout membre peut créer une tâche liée à n'importe quel projet ou sans projet)

### 3.3 Frontend : `TasksView.jsx` [P1] ✅ (A-04, réécrit)
- [x] UI pilotée entièrement par `task.permission` reçu du backend
- [x] Bouton ouvrir : Pencil (full) / Eye (status_only, read_only)
- [x] Select statut inline pour `status_only`
- [x] Boutons Archive/Désarchive/Supprimer conditionnés à `full`
- [x] "Nouvelle tâche" visible pour tout non-admin

---

## Étape 4 — Gantt : conformité CDC [P1 / P2]

### 4.1 Vérification de l'existant [P1]
- [x] `GanttView.jsx` lu (A-03) — barres ES/EF, critique rouge, couleur responsable : OK

### 4.2 Améliorations manquantes [P1 / P2]
- [ ] Flèches de dépendances entre barres [P2]
- [ ] Filtre par membre [P1]
- [ ] Filtre par projet si absent [P1]

### 4.3 Étiquettes et légende [P2]
- [ ] ID tâche sur chaque barre ou tooltip
- [ ] Marge (`slack`) en info-bulle
- [ ] Légende : rouge = critique, couleur = responsable

---

## Étape 5 — Projets : Chef de projet [P1]

### 5.1 Backend [P1] ✅
- [x] Colonne `projects.chef_id` présente (migration v2)
- [x] `GET /projects/` retourne `chef_id` + `chef_name` (A-02)
- [x] `PUT /<id>/chef` → Admin uniquement (Darelle, A-02)
- [x] `POST /projects/` stocke `chef_id = current_user["id"]` (A-03, D-08)
- [x] `PUT/DELETE` : garde ownership `_is_owner()` (A-03, D-08)

### 5.2 Frontend `ProjectsView.jsx` [P1] ✅ (A-03)
- [x] Chef affiché sur chaque ligne (chef_name) (A-03)
- [x] Boutons ✏️/🗑️ visibles uniquement pour le chef propriétaire (A-03, D-08)
- [x] "Nouveau projet" réservé au Chef (A-03)

### 5.3 Guard modèle owner/chef dans `tasks.py` et `activities.py` [P1]
- [x] `tasks.py` : fait (Étape 3.1, A-04)
- [ ] `activities.py` : reste à faire (Étape 6.1)

---

## Étape 6 — Activités : guard rôle [P1]

### 6.1 Backend `routes/activities.py` [P1] ✅ Fermé (A-05, modèle étendu)
- [x] `@require_auth` + admin 403 + messages FR (A-02)
- [x] **Ownership créateur implémenté (D-13, A-05)** — remplace le guard `is_chef_of_project()` initialement prévu
- [x] `POST /activities/` → ouvert à tout non-admin, `owner_id` = créateur automatique
- [x] `PUT`/`DELETE` → réservés au owner de l'activité
- [x] `GET /activities/` → embarque `is_owner` (bool) par activité
- [ ] Vérifier cascade suppression via `ON DELETE CASCADE` (non testé explicitement en A-05)
- [ ] Décision D-10-like : pas de rattrapage automatique sur les activités existantes (`owner_id = NULL`) — acté avec l'utilisateur, cohérent avec les tâches

### 6.2 Frontend `ActivitiesView.jsx` [P1] ✅ Fermé (A-05, réécrit)
- [x] Boutons créer/modifier/supprimer masqués si `!isChef` (A-03, B-05 fermé) — **modèle abandonné**
- [x] **Remplacé par le modèle ownership (A-05)** : "Nouvelle activité" visible pour tout non-admin ; ✏️/🗑️ conditionnés à `activity.is_owner`
- [x] Prop `isChef` retirée de `ActivitiesView` (et de son appel dans `App.jsx` ⚠️)

---

## Étape 7 — Filtres & recherche avancée [P1]

- [x] Filtre `priority` : DB ✅, API ✅
- [x] Filtres dates fonctionnels
- [x] Filtre `show_archived` fonctionnel
- [x] Recherche texte fonctionnelle
- [~] Filtre `show_critical` → champ `critical` présent côté backend (A-02) ; vérifier côté frontend
- [ ] Vérifier filtre `show_overdue`
- [ ] Ajouter filtre `priority` dans Gantt si absent

---

## Étape 8 — Performance & qualité [P1 / P2]

### 8.1 Protection JWT [P1]
- [x] `tasks.py` — toutes les routes protégées (A-01)
- [x] `projects.py` — toutes les routes protégées (A-02)
- [x] `activities.py` — toutes les routes protégées (A-02)
- [x] **Tester token expiré → `401` propre (CDC BF-06)** ✅ Fermé (A-04, D-07) : déconnexion automatique via `setUnauthorizedHandler`

### 8.2 Performance PERT [P1]
- [ ] Mesurer temps de calcul PERT backend (cible < 100 ms pour 100 tâches)
- [ ] Si dépassé : cache par projet

### 8.3 Messages d'erreur en français [P2]
- [x] `tasks.py` (A-01)
- [x] `projects.py` (A-02)
- [x] `activities.py` (A-02)

### 8.4 Gestion de session [P1] ✅ Fermé (A-04)
- [x] `client.js` ⚠️ : `setUnauthorizedHandler` — intercepte tout 401
- [x] `useData.js` ⚠️ : chargement conditionné à `isLogged`, reset propre au logout, garde anti race-condition
- [x] `App.jsx` ⚠️ : branchements `useData(isLogged)` + enregistrement du handler
- [x] Validé par l'utilisateur : premier login sans erreur + retour propre au login après expiration de session

### 8.5 Ownership activités — cohérence transversale [P1] ✅ Fermé (A-05)
- [x] `difficulties.py` ⚠️ hors périmètre Poste A : `can_access_task()` réécrite pour être cohérente avec le modèle owner/chef/responsable (D-14) — corrigé avec accord explicite de l'utilisateur, à faire relire par Darelle
- [x] `database.py` ⚠️ : boucle `for` cassée suite à fusion avec Poste B, corrigée et vérifiée par compilation

---

## Bugs

| ID | Fichier | Description | Priorité | Statut |
|---|---|---|---|---|
| B-01 | `TaskModal.jsx` | Admin formulaire lecture seule | Haute | ✅ Fermé (A-02) |
| B-02 | `App.jsx` ⚠️ transversal | Cloche `<Bell>` gatée `isAdmin=true` | Moyenne | 🔴 Ouvert — Poste B |
| B-03 | `TaskModal.jsx` | Chef voit MemberModal au lieu du formulaire | Bloquant | ✅ Fermé (A-03) |
| B-04 | `App.jsx` ⚠️ | `isChef` non transmis à `TaskModal` | Bloquant | ✅ Fermé (A-03) |
| B-05 | `ActivitiesView.jsx` | CRUD visible pour tous | Haute | ✅ Fermé (A-03) |
| B-06 | `ProjectsView.jsx` | CRUD visible pour tous | Haute | ✅ Fermé (A-03) |
| B-07 | `TeamView.jsx` | Ajout membre accessible + 🗑️ non restreint | Haute | ✅ Fermé (A-03) |
| B-08 | `TasksView.jsx` | "Nouvelle tâche" visible pour Membre | Moyenne | ✅ Fermé (A-03) |
| B-09 | `TaskModal.jsx` | `disabled` HTML manquant sur Enregistrer | Moyenne | ✅ Fermé (A-03) |
| B-10 | `TaskModal.jsx` | Cast `String()` manquant sur `member_id` | Moyenne | ✅ Fermé (A-03) |
| D-07 | `App.jsx`, `useData.js`, `client.js` ⚠️ | Session défaillante : token invalide au 1er login + session expirée sans retour possible | Bloquant | ✅ Fermé (A-04) |
| D-13 | `database.py`, `activities.py`, `ActivitiesView.jsx` | Bouton "Nouvelle activité" absent malgré backend permissif | Haute | ✅ Fermé (A-05) |
| D-14 | `difficulties.py` ⚠️ hors périmètre | Responsable bloqué pour signaler une difficulté ("Vous n'avez pas accès à cette tâche") | Bloquant | ✅ Fermé (A-05) |
| — | `database.py` ⚠️ | Boucle `for` cassée + doublon `migrations_b4` (résidu de fusion) | Bloquant | ✅ Fermé (A-05) |

---

## Résumé dépendances inter-postes

| Sujet | Poste A | Poste B | Statut |
|---|---|---|---|
| `@require_auth` / JWT | Consomme | Crée et maintient | ✅ Opérationnel |
| `@require_role` | Consomme (projects.py) | Crée et maintient | ✅ Opérationnel |
| `projects.chef_id` | GET + ownership ✅ | Lit pour rapports | ✅ Complet |
| Contrat JSON PERT | Produit ✅ (D-05) | Consomme dans rapports | À documenter (A-05) |
| `useData.js` ⚠️ | PERT backend branché ✅ (A-03) ; `isLogged` ajouté (A-04) | Hook partagé | ✅ Fait — informer Darelle |
| `App.jsx` ⚠️ | Props isChef/currentUser ajoutés (A-03) ; isChef retiré de TasksView/TaskModal, handler 401 ajouté (A-04) | Bug B-02 cloche | Informer Darelle |
| `client.js` ⚠️ | `setUnauthorizedHandler` ajouté (A-04) | Consomme les fonctions existantes, aucune signature changée | ✅ Rétrocompatible |
| Modèle permissions tâches (D-09) | Owner/chef/responsable implémenté (A-04) | À répliquer si Darelle a des vues similaires (difficultés, notifications) | Informer Darelle |
| Modèle ownership activités (D-13) | Implémenté (A-05) | — | Informer Darelle |
| `difficulties.py` ⚠️ hors périmètre | `can_access_task()` réécrite (D-14, A-05) | Fichier de son périmètre, modifié avec accord utilisateur | **À faire relire par Darelle en priorité** |

---

## Ordre de traitement recommandé

```
A-06 : Refonte de l'UI (décidé en clôture A-05 — périmètre à cadrer en début de session)
       Probable AUDIT préalable des vues existantes avant plan de refonte :
       TasksView, GanttView, PERTView, ProjectsView, ActivitiesView

Reste en attente (reporté depuis A-02/A-03) :
       Étape 2.2 — PERT_CONTRACT.md + documenter le champ `permission`/`is_owner` [P1]
       Étape 4   — Gantt : flèches de dépendances, filtres membre/projet [P1/P2]
       Étape 7   — Vérifier show_critical / show_overdue côté frontend [P1]
       Étape 8.2 — Mesure perf PERT (< 100 ms / 100 tâches) [P1]
```

---

*Ce fichier ne doit pas être réorganisé sans accord explicite de Josué.*  
*Décisions numérotées D-xx en continu commun avec le Poste B (dernière en date : D-14).*