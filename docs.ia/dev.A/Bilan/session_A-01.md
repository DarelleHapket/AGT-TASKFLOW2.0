# Rapport de session A-01 — Poste A (Josué)
**Date :** 16 juillet 2026
**Durée estimée :** 1 coupon (3 h)
**Objectif de session :** Lire le CDC complet, construire le TODO.md, auditer le code réel, corriger les JWT guards sur `tasks.py` et la logique de rôle dans `TasksView.jsx`.

---

## 1. Tâches traitées

| # | Tâche | Résultat |
|---|---|---|
| T-01 | Lecture du CDC complet (30 pages, 27 BF, 9 BNF) | ✅ Terminé |
| T-02 | Construction du `TODO.md` du Poste A | ✅ Terminé |
| T-03 | Audit code réel : `database.py`, `tasks.py`, `auth.py`, `pert.js`, `useData.js`, `TasksView.jsx` | ✅ Terminé |
| T-04 | Ajout des JWT guards sur `backend/routes/tasks.py` | ✅ Livré + validé |
| T-05 | Inversion logique `isAdmin` dans `frontend/src/components/tasks/TasksView.jsx` | ✅ Livré + validé |

---

## 2. Fichiers touchés

| Fichier | Type | Nature de la modification |
|---|---|---|
| `backend/routes/tasks.py` | **Poste A** | `@require_auth` sur toutes les routes ; admin `403` sur POST / PUT / DELETE / PATCH archive / unarchive ; messages d'erreur en français (BNF-05) |
| `frontend/src/components/tasks/TasksView.jsx` | **Poste A** | 7 inversions `isAdmin → !isAdmin` : bouton "Nouvelle tâche", icône crayon/œil, boutons Archive et Supprimer, badge difficulté, `useEffect` guard, `handleOpen` markAsSeen |

---

## 3. Décisions (D-xx, numérotation commune aux deux postes)

**D-01** — L'Admin est en **lecture seule** sur les tâches (CDC BF-08). Implémenté en backend (`403` sur toutes les écritures pour `is_admin=1`) et en frontend (admin voit l'œil uniquement, pas de bouton créer/archiver/supprimer).

**D-02** — Le Chef de projet est stocké dans `projects.chef_id` (colonne `INTEGER REFERENCES members(id)` ajoutée via migration v2 dans `database.py`). **Pas de table `project_members`** : les membres d'un projet sont dérivés des `DISTINCT responsible` des tâches du projet.

**D-03** — La distinction **Chef vs Membre** pour les droits d'écriture est reportée à l'Étape 3 du TODO. Dans l'implémentation actuelle, tout non-admin peut écrire. La granularité chef/membre nécessite les guards `projects.chef_id` dans `tasks.py` et `projects.py`.

---

## 4. Bugs ouverts

**B-01 — `TaskModal.jsx` non audité** (priorité haute)
`TaskModal` reçoit le prop `isAdmin` depuis `App.jsx` et l'utilise probablement pour passer en mode lecture ou écriture. L'ancienne sémantique (`isAdmin = écriture complète`) est désormais incorrecte. À auditer et corriger à la prochaine session.

**B-02 — `App.jsx` : cloche notifications encore gatée sur `isAdmin`** (priorité moyenne)
Dans `App.jsx` (fichier transversal), le chargement des `diffCounts` et l'affichage de la cloche `<Bell>` sont conditionnés à `isAdmin=true`. Per CDC BF-24, c'est le **Chef de projet (non-admin)** qui doit voir les notifications de difficulté. Ce fichier n'a pas été modifié cette session — voir section 5.

---

## 5. Changements transversaux — à transmettre au Poste B (Darelle)

### 5.1 `TasksView.jsx` — sémantique `isAdmin` inversée
`TasksView.jsx` n'est pas un fichier transversal au sens strict, mais le changement de sémantique de `isAdmin` a un impact sur `App.jsx` (transversal).

**Ancienne sémantique :** `isAdmin = true` → accès complet (crayon, archive, suppression)
**Nouvelle sémantique :** `isAdmin = true` → lecture seule (œil uniquement)

### 5.2 `App.jsx` — bug B-02 à corriger conjointement
Le bloc suivant dans `App.jsx` doit être retravaillé :

```jsx
// AVANT (incorrect — CDC BF-24)
useEffect(() => {
  if (!isAdmin || !tasks.length) return;   // ← doit être !isAdmin
  ...
}, [tasks, isAdmin]);

const unseenTotal = isAdmin ? totalUnseen(diffCounts) : 0;  // ← inverser

{isAdmin && <Bell />}   // ← doit être {!isAdmin && <Bell />}
```

Ce changement **doit être coordonné** : Darelle gère l'Auth et le shell `App.jsx`. La correction est simple (même inversion `isAdmin → !isAdmin`) mais touche un fichier transversal.

---

## 6. Tâche suivante recommandée

**Priorité 1 — Bug B-01 : auditer et corriger `TaskModal.jsx`**
Envoyer le contenu de `TaskModal.jsx` pour audit. La correction suivra la même logique (inversion `isAdmin`). Sans ça, Gabriel (admin) voit le formulaire d'édition alors qu'il devrait voir une vue en lecture seule.

**Priorité 2 — Étape 2 : moteur PERT côté backend**
C'est l'écart architectural le plus structurant avec le CDC (§4.2.2). Le calcul ES/EF/LS/LF est aujourd'hui 100 % frontend. Un script `backend/utils/pert.py` doit être créé, puis branché dans `tasks.py` après chaque write.

---

## 7. Résumé des écarts CDC couverts cette session

| BF / BNF | Intitulé | Avant | Après |
|---|---|---|---|
| BF-08 | Admin = lecture seule tâches | ❌ Admin écrivait | ✅ Admin 403 sur écriture |
| BNF-03 | Endpoints protégés JWT | ❌ Routes ouvertes | ✅ `@require_auth` partout |
| BNF-05 | Messages d'erreur en français | ❌ Anglais technique | ✅ Français courant |