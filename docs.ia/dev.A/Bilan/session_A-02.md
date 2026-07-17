# Rapport de session A-02 — AGT TaskFlow (Poste A — Josué)

**Date :** 2026-07-16
**Durée estimée :** 2 coupons
**Objectifs :** Bug B-01 (TaskModal) · Étape 2 PERT backend · Étape 8.1 JWT guards

---

## 1. Tâches traitées

### 1.1 Bug B-01 — `TaskModal.jsx` : admin en lecture seule ✅ Résolu

**Audit :** condition `if (!isAdmin && initial)` routait non-admins vers `MemberModal`
mais laissait l'admin tomber sur le formulaire complet éditable — contraire à D-01.

**Correction :**

| Zone | Avant | Après |
|---|---|---|
| Routing | Formulaire éditable pour admin | `readOnly = !!isAdmin` |
| Titre | "Modifier la tâche" | "Détail de la tâche" + sous-titre *Vue superviseur* |
| Champs | Toujours éditables | `disabled={readOnly}` + style `inpRO` |
| Bouton Enregistrer | Toujours visible | Masqué si `readOnly` |
| Difficultés admin | Formulaire + corbeilles | Lecture seule, masqués (D-04) |

**Constats bonus (items TODO cochés) :** champs `priority`, `start_date`, `end_date`, `due_date`
tous présents et exposés en saisie dans `TaskModal.jsx` — items 1.1 et 1.3 fermés.

---

### 1.2 Étape 2.1 — Moteur PERT backend `backend/utils/pert.py` ✅ Créé

Algorithme complet : Kahn (tri topologique + détection de cycles) → passe avant → passe arrière.

| Fonction | Rôle |
|---|---|
| `_build_graph(tasks)` | Index predecessors / successors ; ignore les dépendances vers IDs inconnus |
| `_topological_sort(...)` | Kahn — lève `CycleError(cycle_ids)` si cycle |
| `_forward_pass(...)` | ES, EF |
| `_backward_pass(...)` | LS, LF |
| `compute_pert(tasks)` | API publique — `{id: {es, ef, ls, lf, slack, critical}}` |

**Tests unitaires (4/4 passés) :**
- Cas 1 : graphe linéaire A→B→C — slack = 0 partout ✅
- Cas 2 : deux chemins parallèles — seul le plus long est critique ✅
- Cas 3 : aucune dépendance — ES = 0 partout ✅
- Cas 4 : cycle P→Q→R→P — `CycleError(['P','Q','R'])` ✅

---

### 1.3 Étape 2.1 (suite) — Intégration PERT dans `backend/routes/tasks.py` ✅

`list_tasks()` restructurée en 3 phases :
1. **Fetch complet** : toutes les tâches avec dépendances (non filtrées)
2. **PERT** : `compute_pert(all_tasks)` sur le graphe entier
3. **Filtre + fusion** : filtres existants conservés, champs PERT fusionnés dans chaque tâche

**Format de réponse (D-05) :**
- Cas normal : tableau JSON plat, chaque tâche porte `es, ef, ls, lf, slack, critical`
- Cas cycle : `{"tasks": [...], "pert_cycle_ids": ["P","Q","R"]}` (HTTP 200)

⚠️ **Note frontend :** format change en cas de cycle (objet au lieu de tableau).
`useData.js` devra gérer les deux formats — à traiter en Étape 2.3 (fichier transversal).

---

### 1.4 Étape 8.1 — JWT guards `backend/routes/projects.py` ✅

| Route | Avant | Après |
|---|---|---|
| `GET /` | Aucun guard | `@require_auth` · admin autorisé (lecture) |
| `POST /` | Aucun guard | `@require_auth` · admin 403 |
| `PUT /<id>` | Aucun guard | `@require_auth` · admin 403 |
| `DELETE /<id>` | Aucun guard | `@require_auth` · admin 403 |
| `PUT /<id>/chef` | `@require_role("admin")` (Darelle) | Conservé intact |

**Bonus Étape 5.1 (partiel) :** `GET /projects/` retourne `chef_id` + `chef_name`
via `LEFT JOIN members`. `_fetch_project()` mutualisé pour tous les retours.
Messages d'erreur traduits en français.

---

### 1.5 Étape 8.1 — JWT guards `backend/routes/activities.py` ✅

| Route | Avant | Après |
|---|---|---|
| `GET /` | Aucun guard | `@require_auth` · admin autorisé |
| `POST /` | Aucun guard | `@require_auth` · admin 403 |
| `PUT /<id>` | Aucun guard | `@require_auth` · admin 403 |
| `DELETE /<id>` | Aucun guard | `@require_auth` · admin 403 |

Messages d'erreur traduits en français. Guard `is_chef_of_project()` différé à l'Étape 6.

---

## 2. Fichiers touchés

| Fichier | Type | Nature |
|---|---|---|
| `frontend/src/components/tasks/TaskModal.jsx` | Périmètre A | Bug B-01 : readOnly admin + D-04 |
| `backend/utils/pert.py` | Périmètre A | **Création** — moteur PERT complet |
| `backend/routes/tasks.py` | Périmètre A | Intégration PERT dans `list_tasks()` |
| `backend/routes/projects.py` | Périmètre A | JWT guards + chef_name + messages FR |
| `backend/routes/activities.py` | Périmètre A | JWT guards + messages FR |

---

## 3. Décisions numérotées (suite de D-03)

| N° | Décision | Session |
|---|---|---|
| D-04 | Admin voit les difficultés en lecture seule — ni création ni suppression | A-02 |
| D-05 | Format PERT dans `GET /tasks/` : champs plats sur chaque tâche (`es`, `ef`, `ls`, `lf`, `slack`, `critical` en coupons). En cas de cycle : objet `{"tasks":[…], "pert_cycle_ids":[…]}` | A-02 |

---

## 4. Bugs

### Fermés
| ID | Fichier | |
|---|---|---|
| B-01 | `TaskModal.jsx` | ✅ Fermé — admin readOnly implémenté et testé |

### Toujours ouverts
| ID | Fichier | Description | Priorité |
|---|---|---|---|
| B-02 | `App.jsx` ⚠️ transversal | Cloche `<Bell>` gatée `isAdmin=true` au lieu de `!isAdmin` | Moyenne |

---

## 5. Fichiers transversaux — message au Poste B (Darelle)

### 5.1 `backend/utils/auth.py` — `require_role` détecté
`@require_role("admin")` trouvé dans `projects.py` (route `/chef`) — ajouté par Darelle.
Poste A a importé `require_role` en mutualisé avec `require_auth` sans le modifier.
**Action Poste B :** confirmer que `require_role` injecte bien `current_user` comme `require_auth`.

### 5.2 `frontend/src/hooks/useData.js` ⚠️ — à mettre à jour (Étape 2.3)
Actuellement `useData.js` appelle `computePERT(tasks)` sur la liste retournée par `GET /tasks/`.
Après D-05, le backend fournit les champs PERT directement.
**Deux changements nécessaires (coordination A+B) :**
1. Lire les champs PERT du payload au lieu d'appeler `computePERT()`
2. Gérer le cas cycle : détecter `data.pert_cycle_ids` et brancher sur `data.tasks`

### 5.3 Bug B-02 — `App.jsx` toujours ouvert
Condition `isAdmin` au lieu de `!isAdmin` sur la cloche et les compteurs.
À corriger côté Poste B (fichier shell transversal).

---

## 6. Tâche suivante recommandée (A-03)

```
A-03 : Étape 2.2 — Documenter contrat PERT (docs/ia/PERT_CONTRACT.md)
       Étape 2.3 — Mettre à jour useData.js (coordination Darelle ⚠️)
                   PERTView.jsx + GanttView.jsx : lire champs PERT du backend

       Étape 3.1 — Helper is_chef_of_project() dans tasks.py
                   + guards POST/PUT/DELETE chef uniquement

       Étape 6.1 — Audit + guard is_chef_of_project() dans activities.py
```