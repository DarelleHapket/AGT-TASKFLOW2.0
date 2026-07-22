# Session A-07 — Refonte architecturale RBAC complète
**Date :** 2026-07-22 · **Poste :** A — Josué

---

## Objectif

Implémenter le système RBAC `project_members` (rôles par projet), finaliser la gestion admin des membres de la plateforme, aligner les notifications avec la nouvelle logique de permissions, et documenter l'ensemble.

---

## Réalisations

### Lot 1 — Backend RBAC (7 fichiers)

**`database.py`** — Bloc 6 :
- Table `project_members (project_id, member_id, role CHECK IN ('owner','manager','contributor'), joined_at)`
- Seed rattrapage idempotent (`INSERT OR IGNORE`) depuis `chef_id`, `tasks.owner_id`, `tasks.responsible`, `activities.owner_id`

**`utils/permissions.py`** — nouveau centralisateur :
- `get_project_role`, `is_project_member`, `get_user_project_ids`
- `is_task_visible` (filtre P3), `get_task_permission_level` (full/status_only/read_only)
- `can_edit_activity` (P4), `can_create_activity`, `validate_task_creation` (4 vérifications)

**`routes/project_members.py`** — nouveau blueprint :
- `GET /<pid>/members` · `POST` (owner only) · `PUT /<mid>` (owner only) · `DELETE /<mid>` (owner only)
- Guards : owner ne peut pas modifier son propre rôle ni se retirer · rôle `owner` non attribuable via ces endpoints

**`routes/projects.py`** :
- `GET /` → + `member_count` (COUNT DISTINCT) + `user_role` (subquery)
- `POST /` → auto-insert créateur comme `owner` dans `project_members`
- `PUT/DELETE /<id>` → guard via `project_members.role = 'owner'` (plus `chef_id`)
- `PUT /<id>/chef` (admin) → old owner → `contributor` + `_demote_if_orphan` · new → `owner` (upsert)

**`routes/tasks.py`** :
- Filtre P3 : pré-calcul `get_user_project_ids` → `is_task_visible` par tâche
- PERT calculé sur graphe complet **avant** le filtre P3
- `POST /` → `validate_task_creation` (4 vérifications cascade)
- `PUT /<id>` → notify `task_assigned` si `responsible` change

**`routes/activities.py`** :
- Filtre P3 sur `get_user_project_ids`
- `POST /` → `can_create_activity` (owner/manager)
- `PUT/DELETE` → `can_edit_activity` (P4 : owner_id OU role in owner/manager)
- Champ `can_edit` (remplace `is_owner`)

**`app.py`** → register `project_members_bp` sous `/api/projects`

---

### Lot 2 — Frontend RBAC (5 fichiers)

**`ProjectMembersPanel.jsx`** (nouveau) :
- Panel inline slide-down, chargement lazy au premier affichage
- Badges PROPRIÉTAIRE (indigo) / MANAGER (bleu) / CONTRIBUTEUR (vert)
- Owner : select rôle inline + bouton Retirer par membre · Formulaire d'ajout en bas
- Layout : nom `flex:1` + groupe rôle/actions `flexShrink:0 marginLeft:auto` (fix noms tronqués)

**`ProjectsView.jsx`** :
- Cards enrichies : `user_role` badge + `member_count` + `chef_name`
- Bouton Équipe (chevron) : tous membres du projet → ouvre ProjectMembersPanel
- Boutons ✏️/🗑️ : owner uniquement via `user_role === 'owner'`
- Un seul panel ouvert à la fois (`openPanel` state)

**`ActivitiesView.jsx`** : `a.is_owner` → `a.can_edit` + affichage erreur inline

**`TaskModal.jsx`** :
- `saveError` state + `saving` state → erreur backend affichée dans le modal sans fermeture
- Mode add : sélecteur projet filtré sur `creatableProjects` (user_role owner|manager)

**`App.jsx`** : +4 handlers project_members · `onSaveTask` ne ferme le modal qu'en cas de succès

---

### Lot 3 — Transversaux (2 fichiers)

**`client.js`** : +8 fonctions (`getProjectMembers`, `addProjectMember`, `updateProjectMember`, `removeProjectMember`, `getSuspendedMembers`, `toggleMemberActive`, et refonte explicite de toutes les fonctions membres)

---

### Gestion équipe — Finalisation admin (4 fichiers)

**`members.py`** :
- `GET /` → `SELECT` explicite : `password_hash` exclu de toutes les réponses
- `GET /suspended` → nouveau endpoint admin
- `PUT /<id>/toggle-active` → nouveau : bascule `is_active` + `status` (`active` ↔ `suspended`)
- `DELETE /<id>` → guards : interdit sur soi-même et sur un autre admin

**`TeamView.jsx`** :
- Section **COMPTES SUSPENDUS** (admin, lazy load)
- Bouton **Suspendre** par membre actif + **Réactiver** dans section suspendue
- Bouton **Supprimer** + ConfirmDialog
- Dot de statut : vert = actif · orange = suspendu
- `canActOn(m)` : logique centralisée (non-soi, non-admin)

**`App.jsx`** : `onToggleActive` handler bidirectionnel · retire `onAdd` (prop mort depuis A-03) · passe `currentUser` à TeamView

---

### Audit et alignement notifications (3 fichiers)

**`difficulties.py`** :
- `can_access_task()` : remplace `chef_id == user.id` par `get_project_role in ('owner','manager')` — aligne sur permissions.py
- `create_difficulty()` : notifie **tous** les owners ET managers du projet (plus uniquement `chef_id`)

**`tasks.py`** : `update_task` notifie `task_assigned` si `responsible` change

**`App.jsx`** :
- Supprime `useSeenDifficulties`, `diffCounts`, `canSeeNotifications`, et le `useEffect` qui faisait N appels `getDifficulties()` en parallèle
- Badge unifié : `unseenTotal = unreadNotifs.length` (source de vérité unique : notifications backend)

---

### Documentation

**`RBAC.md`** — rédigé puis mis à jour avec :
- Matrice complète gestion membres (pending/active/suspended/deleted)
- Matrice difficultés alignée A-07
- Section notifications (4 déclencheurs, destinataires corrects, règle badge)
- 9 règles de sécurité invariantes
- Référence API complète (project_members + members admin)

---

## Décisions

| ID | Décision |
|----|----------|
| D-22 | Table `project_members` avec rôles `owner/manager/contributor` |
| D-23 | `permissions.py` centralisateur unique de toute la logique RBAC |
| D-24 | Champ `can_edit` (activités) remplace `is_owner` |
| D-25 | `GET /projects/` enrichi avec `user_role` et `member_count` |
| D-26 | Filtre P3 backend sur tasks et activities (pré-calcul `get_user_project_ids`) |
| D-27 | `ProjectMembersPanel` inline (slide-down), chargement lazy |
| D-28 | Layout fix membres : groupe rôle+actions `flexShrink:0 marginLeft:auto` |
| D-29 | `members.py` : toggle-active · suspended endpoint · guards delete · exclure password_hash |
| D-30 | Badge unifié sur notifications backend uniquement (suppression double-comptage) |
| D-31 | `difficulties.py` : `can_access_task` via `get_project_role` · notify owners+managers |
| D-32 | `tasks.py` `update_task` : notify `task_assigned` si responsible change |

Prochaine décision : **D-33**

---

## Fichiers touchés

| Fichier | Nature | ⚠️ |
|---------|--------|-----|
| `backend/database.py` | Bloc 6 project_members + seed | |
| `backend/utils/permissions.py` | **Nouveau** | |
| `backend/routes/project_members.py` | **Nouveau** | |
| `backend/routes/projects.py` | Sync project_members | |
| `backend/routes/tasks.py` | P3 + validations + notify PUT | |
| `backend/routes/activities.py` | P3 + P4 + can_edit | |
| `backend/routes/difficulties.py` | RBAC A-07 + notify | ⚠️ Poste B |
| `backend/routes/members.py` | toggle-active + guards | |
| `backend/app.py` | Register project_members_bp | |
| `frontend/src/api/client.js` | +8 fonctions | ⚠️ Transversal |
| `frontend/src/App.jsx` | Handlers + badge unifié | ⚠️ Transversal |
| `frontend/src/components/projects/ProjectMembersPanel.jsx` | **Nouveau** | |
| `frontend/src/components/projects/ProjectsView.jsx` | Refonte RBAC | |
| `frontend/src/components/activities/ActivitiesView.jsx` | can_edit | |
| `frontend/src/components/tasks/TaskModal.jsx` | saveError + filtre projets | |
| `frontend/src/components/team/TeamView.jsx` | Actions admin | |
| `docs/RBAC.md` | **Nouveau** | |

---

## Changements transversaux à transmettre à Darelle

- **`difficulties.py`** ⚠️ (hors périmètre A) : `can_access_task()` réécrit avec `get_project_role`. La notification `difficulty_reported` notifie maintenant tous les owners ET managers du projet. À relire si Darelle a modifié ce fichier.
- **`client.js`** : +8 fonctions, aucune signature existante modifiée.
- **`App.jsx`** : `useSeenDifficulties` retiré · badge simplifié · 4 handlers project_members ajoutés · `onAdd` retiré de `<TeamView>` (était un prop mort depuis A-03).

---

## Prochaine session recommandée

- Tests end-to-end de la chaîne RBAC complète
- Vérification du `register_request` dans `routes/auth.py` (Poste B) — notification confirmée fonctionnelle en pratique
- Revue UI : filtrage des responsables dans TaskModal sur les membres du projet sélectionné
