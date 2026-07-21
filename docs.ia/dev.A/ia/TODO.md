# TODO.md — Poste A (Josué) | AGT TaskFlow
**Périmètre :** Tâches · PERT · Gantt · Projets · Activités  
**Mis à jour :** Session A-06 — 21 juillet 2026  
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
- [ ] Documenter aussi le champ `permission` (`full`/`status_only`/`read_only`) et `is_owner`

### 2.3 Frontend : branché sur le PERT backend [P1] ✅ (A-03)
- [x] `useData.js` ⚠️ : `computePERT` retiré, `buildPertFromTasks()` lit les champs backend
- [x] Double format D-05 géré
- [x] `pert` migré en état explicite `useState`

### 2.4 Tests PERT [P1] ✅
- [x] Cas 1→4 validés

---

## Étape 3 — Tâches : contrôle d'accès par rôle [P1] ✅ Complété (A-04)

### 3.1 Backend `routes/tasks.py` [P1] ✅
- [x] Modèle owner / chef_projet / responsable implémenté
- [x] Champ `permission` calculé et renvoyé sur chaque tâche

### 3.2 Frontend `TaskModal.jsx` [P1] ✅
- [x] Formulaire unique piloté par `task.permission`

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

## Étape 5 — Projets : Chef de projet [P1] ✅ Complété

- [x] Backend : ownership + chef_name + guards
- [x] Frontend : boutons ✏️/🗑️ visibles pour le chef propriétaire (fix A-06 : `currentUser` manquant)
- [x] Fix `delete_project` : `old_chef` NameError → database locked (A-06)

---

## Étape 6 — Activités : guard rôle [P1] ✅ Complété (A-05)

- [x] Ownership créateur implémenté (D-13)
- [x] `ActivitiesView.jsx` réécrit
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

### 8.5 Ownership activités [P1] ✅ (A-05)

---

## Étape 9 — Notifications [P1] ✅ Complété (A-06)

- [x] Table `notifications` en base (D-20) — purge 7 jours automatique
- [x] Helper `backend/utils/notif.py`
- [x] Blueprint `backend/routes/notifications.py` (GET, PATCH read, PATCH read-all)
- [x] Déclencheur `register` → admins (D-20)
- [x] Déclencheur `task_assigned` → responsable (D-20)
- [x] Déclencheur `difficulty_reported` → chef du projet (D-20)
- [x] Cloche visible pour tous les utilisateurs connectés
- [x] Badge unifié (notifs non lues + difficultés non vues pour chef/admin)
- [x] Panneau `NotificationsPanel.jsx` : slide-in, filtres par type, groupement par jour (D-21)
- [x] Navigation contextuelle au clic (tâche ou onglet Équipe)
- [ ] `useSeenAssignments.js` à supprimer (créé en cours de session, abandonné)

---

## Étape 10 — Révision logique métier ERP [P1] 🔜 A-07

- [ ] Audit des flux métier actuels (projets → activités → tâches → responsables)
- [ ] Identifier les incohérences avec le management de projet concret
- [ ] Proposer et valider un nouveau modèle avec l'utilisateur
- [ ] Implémenter les ajustements validés

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
| — | `App.jsx` cloche | `markAsSeen` non appelé au clic | Moyenne | ✅ Fermé (A-06) |

---

## Ordre de traitement recommandé

```
A-07 : Révision logique métier ERP (décidé en clôture A-06)
       Audit + proposition de nouveau modèle avant toute implémentation

Reste en attente :
       Étape 2.2 — PERT_CONTRACT.md [P1]
       Étape 4   — Gantt : flèches + filtres [P1/P2]
       Étape 7   — show_critical / show_overdue frontend [P1]
       Étape 8.2 — Mesure perf PERT [P1]
       Étape 9   — Supprimer useSeenAssignments.js
```

---

*Ce fichier ne doit pas être réorganisé sans accord explicite de Josué.*  
*Décisions numérotées D-xx en continu commun avec le Poste B (dernière en date : D-21).*