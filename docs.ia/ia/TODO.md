# TODO.md — Poste A (Josué) | AGT TaskFlow
**Périmètre :** Tâches · PERT · Gantt · Projets · Activités
**Mis à jour :** Session A-01 — 16 juillet 2026
**Référence CDC :** version 1.0 BROUILLON, 14 juillet 2026

> **Légende**
> - `[ ]` À faire
> - `[~]` Partiel / à corriger
> - `[x]` Terminé
> - **P1** Indispensable au lancement · **P2** Version 1.0 · **P3** Futur
> - 🔗 Dépend du Poste B (Darelle)
> - ⚠️ Fichier transversal — signaler au Poste B

---

## Étape 0 — Audit du code réel ✅ Complété en session A-01

- [x] Lire `backend/database.py` — migrations v2 confirmées : `priority`, `start_date`, `end_date`, `due_date`, `is_archived`, `archived_at`, `chef_id` dans `projects` tous présents
- [x] Lire `backend/routes/tasks.py` — tous les champs lus/écrits correctement, guards manquants confirmés
- [x] Lire `frontend/src/utils/pert.js` — calcul PERT 100 % frontend confirmé (robuste, détection de cycles DFS)
- [x] Lire `frontend/src/hooks/useData.js` — `pert = computePERT(tasks)` côté client confirmé
- [x] Lire `frontend/src/components/tasks/TasksView.jsx` — logique `isAdmin` inversée confirmée et corrigée
- [x] Lire `backend/utils/auth.py` — `@require_auth` et `@require_admin` disponibles, `current_user` injecté
- [ ] Lire `frontend/src/components/tasks/TaskModal.jsx` — **Bug B-01 ouvert** : sémantique `isAdmin` à vérifier
- [ ] Lire `frontend/src/api/client.js` — vérifier absence endpoint PERT backend et liste complète des appels

---

## Étape 1 — Stabilisation BDD : champs manquants dans `tasks` ✅ Validé en session A-01

> Tous les champs existent dans le code réel. Le dump était antérieur aux migrations v2.

### 1.1 Champ `priority` [P1]
- [x] Vérifié présent dans schéma initial `tasks` (valeur défaut `'normale'`)
- [x] Lu et écrit dans GET / POST / PUT de `tasks.py`
- [ ] Vérifier que `TaskModal.jsx` expose bien le champ `priority` en saisie

### 1.2 Champ `is_archived` + `archived_at` [P2]
- [x] Vérifié présent via migrations v2 Bloc 1 et 2
- [x] Endpoints `PATCH /archive` et `PATCH /unarchive` existants et protégés (session A-01)

### 1.3 Champs de dates : `start_date`, `end_date`, `due_date` [P2]
- [x] Vérifié présents via migrations v2 Bloc 1
- [x] Lus et écrits dans GET / POST / PUT de `tasks.py`
- [ ] Vérifier que `TaskModal.jsx` expose les dates en saisie optionnelle

---

## Étape 2 — PERT côté backend [P1] ← Priorité session A-02

> **CDC §4.2.2** : *"Le backend recalcule automatiquement le graphe PERT."*
> Actuellement 100 % frontend. Écart architectural le plus structurant.

### 2.1 Moteur PERT backend — `backend/utils/pert.py` [P1]
- [ ] Créer `backend/utils/pert.py` avec `compute_pert()`, `forward_pass()`, `backward_pass()`, détection de cycles
- [ ] Appeler `compute_pert()` après chaque POST / PUT / DELETE sur `/tasks/`
- [ ] Inclure les champs PERT dans la réponse JSON : `es`, `ef`, `ls`, `lf`, `slack`, `critical`

### 2.2 Contrat API — 🔗 coordination Poste B [P1]
- [ ] Définir avec Darelle le format exact des champs PERT dans le JSON
- [ ] Documenter dans `docs/ia/` le contrat arrêté

### 2.3 Frontend : brancher sur le PERT backend [P1]
- [ ] Modifier `useData.js` ⚠️ : ne plus appeler `computePERT()` si le backend fournit les valeurs
- [ ] Garder `utils/pert.js` comme fallback pour la vue DailyOrder
- [ ] Mettre à jour `PERTView.jsx` et `GanttView.jsx`

### 2.4 Tests PERT [P1]
- [ ] Cas 1 : graphe linéaire A→B→C → slack = 0 partout
- [ ] Cas 2 : deux chemins parallèles → seul le plus long est critique
- [ ] Cas 3 : pas de dépendances → ES=0, slack maximal
- [ ] Cas 4 : cycle détecté → 400 avec liste des IDs impliqués

---

## Étape 3 — Tâches : contrôle d'accès par rôle [P1]

> D-01 : Admin 403 sur écritures ✅ fait (session A-01).
> D-03 : Distinction Chef vs Membre → à faire ici.
> 🔗 Dépend du Poste B : `members.role` opérationnel.

### 3.1 Backend : guard Chef dans `routes/tasks.py` [P1]
- [~] `@require_auth` + admin 403 fait (session A-01)
- [ ] Ajouter helper `is_chef_of_project(conn, project_id, user_id)` basé sur `projects.chef_id`
- [ ] `POST /tasks/` → vérifier appelant = chef du `project_id` soumis
- [ ] `PUT /tasks/<id>` → chef : tous les champs ; membre (responsable) : `status` seulement
- [ ] `DELETE`, `PATCH archive/unarchive` → chef uniquement

### 3.2 Frontend : adapter `TaskModal.jsx` [P1]
- [ ] **Audit `TaskModal.jsx` d'abord** (Bug B-01 — envoyer le fichier)
- [ ] Admin → formulaire entier en lecture seule
- [ ] Membre non-chef → seul champ `status` éditable
- [ ] Chef → formulaire complet

---

## Étape 4 — Gantt : conformité CDC [P1 / P2]

> **CDC BF-17** : barres ES→EF en coupons, critique rouge, couleur du membre responsable.

### 4.1 Vérification de l'existant [P1]
- [ ] Lire `GanttView.jsx` (envoyer le fichier)
- [ ] Confirmer barres ES/EF, critique rouge, couleur responsable

### 4.2 Améliorations manquantes [P1 / P2]
- [ ] Flèches de dépendances entre barres [P2]
- [ ] Filtre par membre dans la vue Gantt [P1]
- [ ] Filtre par projet si absent [P1]

### 4.3 Étiquettes et légende [P2]
- [ ] ID tâche sur chaque barre ou tooltip
- [ ] Marge (`slack`) en info-bulle
- [ ] Légende : rouge = critique, couleur = responsable

---

## Étape 5 — Projets : Chef de projet [P1]

> **D-02** : Chef stocké dans `projects.chef_id` (déjà en DB via migration v2).
> Pas de table `project_members` — membres du projet = DISTINCT responsible des tâches.
> 🔗 Dépend du Poste B : comptes membres opérationnels.

### 5.1 Backend : endpoint désignation Chef [P1]
- [x] Colonne `projects.chef_id` présente (migration v2)
- [ ] `PATCH /projects/<id>/chef` → Admin uniquement, body `{"chef_id": N}`
- [ ] Inclure `chef_id` et `chef_name` dans la réponse GET `/projects/`

### 5.2 Frontend `ProjectsView.jsx` [P1]
- [ ] Lire `ProjectsView.jsx` (envoyer le fichier)
- [ ] Afficher le Chef de projet sur chaque ligne
- [ ] Si `isAdmin` → bouton "Désigner Chef"

### 5.3 Guard Chef dans `tasks.py` et `activities.py` [P1]
- [ ] Utiliser `is_chef_of_project()` (Étape 3.1) pour tous les guards d'écriture

---

## Étape 6 — Activités : guard rôle et hiérarchie [P1]

> **CDC BF-19** : Chef de projet gère ses activités.

### 6.1 Backend `routes/activities.py` [P1]
- [ ] Lire `activities.py` (envoyer le fichier)
- [ ] Ajouter `@require_auth` + admin 403 + guard `is_chef_of_project()`
- [ ] Vérifier cascade suppression via `ON DELETE CASCADE`

### 6.2 Frontend `ActivitiesView.jsx` [P2]
- [ ] Masquer boutons créer/modifier/supprimer si `isAdmin`

---

## Étape 7 — Filtres & recherche avancée [P1]

> **CDC BF-12** : filtrer par projet, membre, statut, priorité, période, texte.

- [x] Filtre `priority` fonctionnel : DB ✅, API ✅
- [x] Filtres dates (`date_from`, `date_to`, `single_date`) fonctionnels dans `tasks.py`
- [x] Filtre `show_archived` fonctionnel
- [x] Recherche texte sur `id`, `description`, `project_name`, `activity_name`
- [ ] Vérifier filtre `show_critical` → dépend du PERT backend (Étape 2)
- [ ] Vérifier filtre `show_overdue` → vérifier saisie `due_date` dans `TaskModal`
- [ ] Ajouter filtre `priority` dans la vue Gantt si absent

---

## Étape 8 — Performance & qualité [P1 / P2]

### 8.1 Protection JWT des endpoints Poste A [P1]
- [x] `tasks.py` — toutes les routes protégées (session A-01)
- [ ] `projects.py` — audit et ajout `@require_auth`
- [ ] `activities.py` — audit et ajout `@require_auth`
- [ ] Tester token expiré → `401` propre (CDC BF-06)

### 8.2 Performance PERT [P1]
- [ ] Mesurer temps de calcul PERT backend après Étape 2
- [ ] Si > 100 ms pour 100 tâches : mettre en cache par projet

### 8.3 Messages d'erreur en français [P2]
- [x] `tasks.py` — messages en français (session A-01)
- [ ] `projects.py` — messages en français
- [ ] `activities.py` — messages en français

---

## Bugs ouverts

| ID | Fichier | Description | Priorité |
|---|---|---|---|
| B-01 | `TaskModal.jsx` | Sémantique `isAdmin` à auditer : admin doit voir formulaire en lecture seule | Haute |
| B-02 | `App.jsx` ⚠️ transversal | Cloche `<Bell>` et `diffCounts` encore gatés sur `isAdmin=true` — doit être `!isAdmin` per CDC BF-24 | Moyenne |

---

## Résumé des dépendances inter-postes

| Sujet | Poste A (Josué) | Poste B (Darelle) | Statut |
|---|---|---|---|
| `@require_auth` / JWT | Consomme | Crée et maintient | ✅ Opérationnel |
| `projects.chef_id` | Crée endpoint PATCH (Étape 5.1) | Lit pour rapports | À faire |
| Contrat JSON PERT | Produit le calcul (Étape 2) | Consomme dans rapports | À définir |
| `useData.js` ⚠️ | Brancher PERT backend (Étape 2.3) | Hook partagé | En attente Étape 2 |
| `App.jsx` ⚠️ | Bug B-02 : cloche non-admin | Shell partagé | À coordonner |

---

## Ordre de traitement recommandé (sessions suivantes)

```
A-02 : Bug B-01 (TaskModal audit + fix)
     → Étape 2 (PERT backend)
     → Étape 8.1 (projects.py + activities.py JWT guards)

A-03 : Étape 3 (guards chef/membre dans tasks.py)
     → Étape 5 (projets : chef_id endpoint + UI)
     → Étape 6 (activités : guards)

A-04 : Étape 4 (Gantt améliorations)
     → Étape 7 (filtres complets)
     → Étape 8 (qualité, perf)
```

---

*Ce fichier ne doit pas être réorganisé sans accord explicite de Josué.*
*Décisions numérotées D-xx en continu commun avec le Poste B (dernière en date : D-03).*