# TODO.md — Poste A (Josué) | AGT TaskFlow
**Périmètre :** Tâches · PERT · Gantt · Projets · Activités · Équipe  
**Mis à jour :** Session A-07 — 22 juillet 2026  
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
- [x] Lire `frontend/src/components/tasks/TaskModal.jsx`
- [x] Lire `frontend/src/api/client.js`
- [x] Lire `backend/routes/projects.py`
- [x] Lire `frontend/src/hooks/useAuth.js`
- [x] Lire `frontend/src/App.jsx` en entier

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
- [x] Renseigné automatiquement à la création (`POST /tasks/`)

### 1.5 Table `project_members` [P1] ✅ (A-07)
- [x] Bloc 6 database.py : `(project_id, member_id, role, joined_at)`
- [x] Seed rattrapage idempotent depuis données existantes

---

## Étape 2 — PERT côté backend [P1] ✅ Backend complet

### 2.1 Moteur PERT backend [P1] ✅
- [x] `backend/utils/pert.py` créé (A-02)
- [x] `compute_pert()` appelé dans `GET /tasks/` (A-02)
- [x] Champs PERT dans la réponse : `es`, `ef`, `ls`, `lf`, `slack`, `critical` (D-05)
- [x] PERT calculé sur graphe complet avant filtre P3 (A-07)

### 2.2 Contrat API — 🔗 coordination Poste B [P1]
- [~] D-05 défini (format champs plats + cas cycle)
- [ ] Documenter dans `docs/ia/PERT_CONTRACT.md` et transmettre à Darelle
- [ ] Documenter le champ `permission` (`full`/`status_only`/`read_only`) et `can_edit`

### 2.3 Frontend : branché sur le PERT backend [P1] ✅ (A-03)
- [x] `useData.js` ⚠️ : `computePERT` retiré, `buildPertFromTasks()` lit les champs backend

### 2.4 Tests PERT [P1] ✅

---

## Étape 3 — Tâches : contrôle d'accès par rôle [P1] ✅ Complété (A-07)

### 3.1 Backend `routes/tasks.py` [P1] ✅
- [x] Modèle owner / chef_projet / responsable (A-04)
- [x] Champ `permission` calculé et renvoyé sur chaque tâche
- [x] Filtre P3 : visibilité selon membership projet (A-07)
- [x] `validate_task_creation` : 4 vérifications cascade (A-07)
- [x] Notify `task_assigned` à la création ET si responsible change en PUT (A-07)

### 3.2 Frontend `TaskModal.jsx` [P1] ✅
- [x] Formulaire unique piloté par `task.permission`
- [x] `saveError` inline — modal reste ouvert en cas de 403/400 (A-07)
- [x] Mode add : sélecteur projet filtré sur `creatableProjects` (A-07)

### 3.3 Frontend `TasksView.jsx` [P1] ✅
- [x] UI pilotée entièrement par `task.permission`

---

## Étape 4 — Gantt : conformité CDC [P1 / P2]

### 4.1 Vérification de l'existant [P1] ✅
- [x] `GanttView.jsx` lu — barres ES/EF, critique rouge, couleur responsable : OK

### 4.2 Améliorations manquantes [P1 / P2]
- [ ] Flèches de dépendances entre barres [P2]
- [ ] Filtre par membre [P1]
- [ ] Filtre par projet si absent [P1]

### 4.3 Étiquettes et légende [P2]
- [ ] ID tâche sur chaque barre ou tooltip
- [ ] Marge (`slack`) en info-bulle
- [ ] Légende : rouge = critique, couleur = responsable

---

## Étape 5 — Projets : RBAC complet [P1] ✅ Complété (A-07)

- [x] Ownership + chef_name + guards (A-03/A-06)
- [x] Table `project_members` (owner/manager/contributor) (A-07)
- [x] `GET /projects/` enrichi : `user_role`, `member_count` (A-07)
- [x] `POST /projects/` → auto-insert owner dans `project_members` (A-07)
- [x] `PUT/DELETE /<id>` → guard via `project_members.role` (A-07)
- [x] `PUT /<id>/chef` → synchro bidirectionnelle `project_members` + `_demote_if_orphan` (A-07)
- [x] `ProjectMembersPanel.jsx` : panel inline lazy, gestion équipe owner (A-07)
- [x] `ProjectsView.jsx` : badges `user_role`, bouton Équipe conditionnel (A-07)

---

## Étape 6 — Activités : guard rôle [P1] ✅ Complété (A-07)

- [x] Ownership créateur implémenté (D-13, A-05)
- [x] P4 : managers du projet peuvent modifier les activités (A-07)
- [x] Champ `can_edit` remplace `is_owner` (backend + frontend synchronisés) (A-07)
- [x] Filtre P3 : visibilité selon membership projet (A-07)
- [ ] Vérifier cascade suppression via `ON DELETE CASCADE`

---

## Étape 7 — Filtres & recherche avancée [P1]

- [x] Filtre `priority`, dates, `show_archived`, recherche texte
- [~] Filtre `show_critical` → vérifier côté frontend
- [ ] Vérifier filtre `show_overdue`
- [ ] Ajouter filtre `priority` dans Gantt si absent

---

## Étape 8 — Performance & qualité [P1 / P2]

### 8.1 Protection JWT [P1] ✅
- [x] Toutes les routes protégées
- [x] Déconnexion automatique sur 401 (A-04)

### 8.2 Performance PERT [P1]
- [ ] Mesurer temps de calcul PERT backend (cible < 100 ms pour 100 tâches)
- [ ] Si dépassé : cache par projet

### 8.3 Messages d'erreur en français [P2] ✅

### 8.4 Gestion de session [P1] ✅ (A-04)

### 8.5 Ownership activités [P1] ✅ (A-05 / A-07)

### 8.6 Sécurité API membres [P1] ✅ (A-07)
- [x] `password_hash` exclu de tous les `SELECT` exposés
- [x] Guards auto-suppression et suppression admin

---

## Étape 9 — Notifications [P1] ✅ Complété (A-06/A-07)

- [x] Table `notifications` en base (D-20) — purge 7 jours automatique
- [x] Helper `backend/utils/notif.py`
- [x] Blueprint `backend/routes/notifications.py` (GET, PATCH read, PATCH read-all)
- [x] Déclencheur `register` → admins
- [x] Déclencheur `task_assigned` → responsable (création ET changement de responsable en PUT) (A-07)
- [x] Déclencheur `difficulty_reported` → **tous owners et managers** du projet (A-07)
- [x] `can_access_task()` aligné sur `get_project_role()` (A-07)
- [x] Cloche visible pour tous les utilisateurs connectés
- [x] Badge unifié sur notifications backend uniquement (A-07 — suppression double-comptage localStorage)
- [x] Panneau `NotificationsPanel.jsx` : slide-in, filtres par type, groupement par jour (D-21)
- [x] Navigation contextuelle au clic (tâche ou onglet Équipe)
- [ ] `useSeenAssignments.js` à supprimer (créé en cours de session A-06, abandonné)

---

## Étape 10 — Gestion équipe / membres plateforme [P1] ✅ Complété (A-07)

- [x] `permissions.py` centralisateur RBAC (source de vérité unique)
- [x] `project_members.py` blueprint CRUD équipe projet
- [x] `members.py` : endpoint `suspended`, `toggle-active`, guards `delete`
- [x] `TeamView.jsx` : sections pending / suspendus / actifs · Suspendre / Réactiver / Supprimer
- [x] `RBAC.md` rédigé et mis à jour (9 règles invariantes, toutes matrices)

---

## Bugs

| ID | Fichier | Description | Priorité | Statut |
|---|---|---|---|---|
| B-01 | `TaskModal.jsx` | Admin formulaire lecture seule | Haute | ✅ Fermé (A-02) |
| B-02 | `App.jsx` ⚠️ | Cloche `<Bell>` gatée `isAdmin=true` | Moyenne | ✅ Fermé (A-06) |
| B-03→B-10 | divers | Bugs rôles UI | Bloquant→Moyenne | ✅ Fermé (A-03) |
| D-07 | `App.jsx`, `useData.js`, `client.js` | Session défaillante | Bloquant | ✅ Fermé (A-04) |
| D-13 | `activities.py`, `ActivitiesView.jsx` | Bouton "Nouvelle activité" absent | Haute | ✅ Fermé (A-05) |
| D-14 | `difficulties.py` ⚠️ | Responsable bloqué pour signaler | Bloquant | ✅ Fermé (A-05) |
| — | `ProjectsView` | Boutons ✏️/🗑️ invisibles pour chef | Haute | ✅ Fermé (A-06) |
| — | `projects.py` | `old_chef` NameError → 500 | Bloquant | ✅ Fermé (A-06) |
| — | `ProjectMembersPanel` | Noms membres tronqués par le badge rôle | Moyenne | ✅ Fermé (A-07) |
| — | `difficulties.py` | Notif difficulty envoyée uniquement au chef_id | Haute | ✅ Fermé (A-07) |
| — | `App.jsx` | Badge cloche double-comptage localStorage | Moyenne | ✅ Fermé (A-07) |

---

## Prochaines sessions recommandées

```
A-08 : Tests end-to-end RBAC
       — Vérifier toute la chaîne : inscription → validation → projet → tâche → difficulté → notif
       — Responsable : filtre membres du projet dans TaskModal (D-33 candidat)
       — Supprimer useSeenAssignments.js

       Reste en attente (non-RBAC) :
       Étape 2.2 — PERT_CONTRACT.md [P1]
       Étape 4   — Gantt : flèches + filtres [P1/P2]
       Étape 7   — show_critical / show_overdue frontend [P1]
       Étape 8.2 — Mesure perf PERT [P1]
```

---

*Ce fichier ne doit pas être réorganisé sans accord explicite de Josué.*  
*Décisions numérotées D-xx en continu commun avec le Poste B (dernière en date : D-32).*