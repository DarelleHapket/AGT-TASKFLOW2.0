# TODO.md — Poste A (Josué) | AGT TaskFlow
**Périmètre** : Tâches · PERT · Gantt · Projets · Activités
**Mis à jour** : Session A-01 — 16 juillet 2026
**Référence CDC** : version 1.0 BROUILLON, 14 juillet 2026

> **Légende**
> - `[ ]` À faire
> - `[~]` Partiel / à corriger
> - `[x]` Terminé
> - **P1** Indispensable au lancement · **P2** Version 1.0 · **P3** Futur
> - 🔗 Dépend du Poste B (Darelle)

---

## Étape 0 — Audit du code réel sur la machine (priorité absolue)

> Le dump `taskflow_dump.db` analysé en session A-01 **peut être antérieur
> aux dernières migrations**. Certains champs vus dans le frontend
> (`priority`, `is_archived`, `start_date`, `end_date`, `due_date`)
> sont absents du dump mais référencés dans l'UI.
> Avant tout développement, valider l'état réel.

- [ ] Lire `backend/database.py` en entier et noter chaque `ALTER TABLE` ou colonne ajoutée après le schéma initial
- [ ] Lire `backend/routes/tasks.py` en entier et lister tous les champs lus/écrits
- [ ] Lire `frontend/src/utils/pert.js` et confirmer que le calcul PERT est 100 % côté frontend
- [ ] Lire `frontend/src/hooks/useData.js` et confirmer comment `pert` est calculé et distribué
- [ ] Lire `frontend/src/components/tasks/TaskModal.jsx` et lister tous les champs du formulaire
- [ ] Lire `frontend/src/api/client.js` et lister tous les endpoints appelés (vérifier absence endpoint PERT backend)
- [ ] Exécuter `.schema tasks` sur la vraie DB Docker et coller le résultat → confirmer les champs présents

---

## Étape 1 — Stabilisation BDD : champs manquants dans `tasks` — P1

> **CDC BF-07** : une tâche doit avoir `priorité`, `statut`, `durée`, `dépendances`.
> Les dates sont optionnelles mais utilisées dans les filtres UI.

### 1.1 Champ `priority` [P1]
- [ ] Vérifier si `priority TEXT DEFAULT 'normal'` existe dans `tasks`
- [ ] Sinon : ajouter `ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'normal'`
- [ ] Mettre à jour `database.py` (schéma initial) pour inclure `priority`
- [ ] Mettre à jour `routes/tasks.py` : lecture + écriture de `priority` dans GET / POST / PUT
- [ ] Vérifier que `TaskModal.jsx` envoie le champ `priority` (valeurs : `low`, `normal`, `high`)
- [ ] Vérifier que `FilterBar.jsx` filtre correctement sur `priority`

### 1.2 Champ `is_archived` [P2]
- [ ] Vérifier si `is_archived INTEGER DEFAULT 0` existe dans `tasks`
- [ ] Sinon : ajouter via migration dans `database.py`
- [ ] Mettre à jour `routes/tasks.py` : endpoints `PATCH /tasks/<id>/archive` et `PATCH /tasks/<id>/unarchive`
- [ ] Vérifier que `App.jsx` filtre correctement sur `is_archived`

### 1.3 Champs de dates : `start_date`, `end_date`, `due_date` [P2]
- [ ] Vérifier si ces trois colonnes existent dans `tasks`
- [ ] Sinon : migration `ALTER TABLE tasks ADD COLUMN ...`
- [ ] Mettre à jour `routes/tasks.py` pour les inclure dans GET / POST / PUT
- [ ] Vérifier que `TaskModal.jsx` les expose en saisie optionnelle (CDC BF-07 : "Les dates sont optionnelles")
- [ ] Vérifier que les filtres temporels de `App.jsx` / `FilterBar.jsx` fonctionnent correctement

---

## Étape 2 — PERT côté backend — P1

> **CDC §4.2.2 — Flux de calcul PERT** :
> *"Le backend recalcule automatiquement le graphe PERT (passe forward puis backward).
> ES, EF, LS, LF et la marge sont mis à jour pour chaque tâche liée."*
>
> **Situation actuelle** : le calcul est entièrement dans `utils/pert.js` (frontend).
> Le CDC exige un moteur PERT côté serveur.
> **Impact transversal** : à coordonner avec le Poste B (contrat API).

### 2.1 Moteur PERT backend — `routes/tasks.py` ou `utils/pert.py` [P1]
- [ ] Créer `backend/utils/pert.py` avec les fonctions :
  - `compute_pert(tasks, dependencies)` → renvoie `{ES, EF, LS, LF, slack}` par tâche
  - `forward_pass(tasks, deps)` → calcul des ES/EF
  - `backward_pass(tasks, deps, max_ef)` → calcul des LS/LF
- [ ] Appeler `compute_pert()` automatiquement après chaque `POST /tasks/`, `PUT /tasks/<id>`, `DELETE /tasks/<id>`, `POST/DELETE /tasks/<id>/dependencies`
- [ ] Stocker les valeurs PERT calculées dans la réponse JSON de chaque tâche (champs `es`, `ef`, `ls`, `lf`, `slack`, `is_critical`)
- [ ] **Option A** (recommandée) : calculer à la volée et inclure dans le GET `/api/tasks/` → pas de colonne supplémentaire
- [ ] **Option B** : persister `es`, `ef`, `ls`, `lf`, `slack` dans la table `tasks` → migration nécessaire

### 2.2 Contrat API — 🔗 coordination Poste B [P1]
- [ ] Définir avec Darelle le format exact du champ PERT dans la réponse JSON
  - Proposition : chaque tâche retourne `"pert": {"es": 0, "ef": 2, "ls": 1, "lf": 3, "slack": 1, "critical": false}`
- [ ] Documenter dans `docs/ia/` le contrat API arrêté

### 2.3 Frontend : brancher sur le PERT backend [P1]
- [ ] Modifier `useData.js` : si le backend renvoie les champs PERT dans les tâches, ne plus appeler `computePERT()` côté frontend
- [ ] Garder `utils/pert.js` comme fallback (vue DailyOrder, comparaisons jour par jour)
- [ ] Mettre à jour `PERTView.jsx` pour utiliser les valeurs PERT du backend en priorité
- [ ] Mettre à jour `GanttView.jsx` idem
- [ ] ⚠️ **Fichier transversal** `useData.js` → signaler tout changement au Poste B

### 2.4 Tests PERT [P1]
- [ ] Cas 1 : graphe linéaire (A→B→C) → chemin critique = A, B, C, slack = 0 partout
- [ ] Cas 2 : deux chemins parallèles → seul le plus long est critique
- [ ] Cas 3 : pas de dépendances → ES=0, slack maximal
- [ ] Cas 4 : cycle détecté → retourner une erreur 400 explicite

---

## Étape 3 — Tâches : contrôle d'accès par rôle — P1

> **CDC BF-08** : Chef de projet = modifie tout ; Membre = statut seulement ; Admin = lecture seule.
> 🔗 **Dépend du Poste B** : la table `users` avec les rôles doit exister.

### 3.1 Backend : guards dans `routes/tasks.py` [P1]
- [ ] Vérifier que `utils/auth.py` expose le rôle de l'utilisateur connecté (`admin`, `chef`, `membre`)
- [ ] `POST /tasks/` → réservé Chef de projet (ou Admin en lecture simulée)
- [ ] `PUT /tasks/<id>` → Chef de projet : tous les champs ; Membre : `status` seulement
- [ ] `DELETE /tasks/<id>` → Chef de projet uniquement
- [ ] `PATCH /tasks/<id>/archive` → Chef de projet uniquement
- [ ] Retourner `403 Forbidden` avec message clair si accès non autorisé (CDC BNF-05)

### 3.2 Frontend : adapter `TasksView.jsx` et `TaskModal.jsx` [P1]
- [ ] Si `user.role === 'membre'` : masquer boutons Modifier, Supprimer, Archiver
- [ ] Si `user.role === 'membre'` : `TaskModal` en mode lecture + seul champ `status` éditable
- [ ] Si `user.role === 'admin'` : vue lecture seule (pas de bouton créer/modifier)
- [ ] Si `user.role === 'chef'` : accès complet

---

## Étape 4 — Gantt : conformité CDC — P1 / P2

> **CDC BF-17** : barres ES→EF positionnées en coupons, chemin critique rouge,
> couleur du membre responsable, consultable par tous.

### 4.1 Vérification de l'existant [P1]
- [ ] Lire `GanttView.jsx` entier : confirmer que les barres utilisent `pert.ES` et `pert.EF`
- [ ] Confirmer que les tâches critiques (slack=0) s'affichent bien en rouge
- [ ] Confirmer que les autres tâches utilisent la couleur du membre responsable

### 4.2 Améliorations CDC manquantes [P1]
- [ ] Ajouter les **flèches de dépendances** entre les barres du Gantt (CDC BF-11 : visualiser les précédences)
- [ ] Ajouter un **filtre par membre** dans la vue Gantt (CDC BF-17 : "consultable par tous")
- [ ] Ajouter un **filtre par projet** si absent

### 4.3 Étiquettes et légende [P2]
- [ ] Afficher l'identifiant de la tâche sur chaque barre ou en tooltip
- [ ] Afficher la marge (`slack`) en info-bulle au survol
- [ ] Ajouter une légende : rouge = critique, couleur = responsable

---

## Étape 5 — Projets : Chef de projet — P1

> **CDC BF-18** : l'Admin crée un projet et y désigne un Membre comme Chef.
> 🔗 **Dépend du Poste B** : table `users` et notion de compte Membre.

### 5.1 Table d'association `project_members` [P1]
- [ ] Créer la table `project_members(project_id, user_id, role)` dans `database.py`
  - `role` : `'chef'` ou `'membre'`
- [ ] Endpoints dans `routes/projects.py` :
  - `POST /projects/<id>/members` → ajouter un membre ou désigner un chef
  - `DELETE /projects/<id>/members/<user_id>` → retirer un membre
  - `GET /projects/<id>/members` → lister les membres et leurs rôles

### 5.2 Frontend `ProjectsView.jsx` [P1]
- [ ] Afficher la liste des membres par projet
- [ ] Bouton Admin : "Désigner Chef de projet" (select membre → attribuer rôle chef)
- [ ] Afficher le Chef de projet courant sur chaque ligne de projet

### 5.3 Guard d'accès aux projets [P1]
- [ ] Un Chef de projet ne voit que les tâches / activités de ses projets
- [ ] L'Admin voit tout en lecture seule
- [ ] 🔗 Coordonner avec Poste B pour le middleware d'auth

---

## Étape 6 — Activités : guard rôle et hiérarchie — P1

> **CDC BF-19** : Chef de projet crée/modifie/supprime ses activités.
> La hiérarchie Projet → Activité → Tâche doit être respectée.

### 6.1 Backend `routes/activities.py` [P1]
- [ ] `POST /activities/` → réservé Chef de projet du projet concerné
- [ ] `PUT /activities/<id>` → Chef de projet uniquement
- [ ] `DELETE /activities/<id>` → Chef de projet uniquement (cascade sur les tâches liées)
- [ ] Retourner `403` si l'appelant n'est pas chef du projet rattaché

### 6.2 Frontend `ActivitiesView.jsx` [P1]
- [ ] Masquer les boutons créer/modifier/supprimer si `user.role !== 'chef'`
- [ ] Vérifier que la suppression cascade correctement sur les tâches liées

---

## Étape 7 — Filtres & recherche avancée — P1

> **CDC BF-12** : filtrer par projet, membre, statut, priorité, période ou texte libre,
> sans rechargement de page.

- [ ] Vérifier que le filtre `priority` fonctionne de bout en bout (DB → API → UI) après Étape 1.1
- [ ] Vérifier que le filtre `period` (date_from / date_to) fonctionne après Étape 1.3
- [ ] Vérifier que le filtre `show_critical` utilise bien les valeurs PERT (slack=0)
- [ ] Vérifier que `show_overdue` fonctionne avec `due_date` après Étape 1.3
- [ ] Ajouter le filtre `priority` dans la vue Gantt si absent
- [ ] Tester la recherche texte libre sur `id`, `description`, `project_name`, `activity_name`

---

## Étape 8 — Performance & qualité — P1 / P2

> **CDC BNF-01** : réponse < 500 ms pour 500 tâches, 5 utilisateurs simultanés.
> **CDC BNF-03** : tous les endpoints protégés par JWT.

### 8.1 Protection JWT des endpoints Poste A [P1]
- [ ] Vérifier que CHAQUE endpoint de `tasks.py`, `projects.py`, `activities.py` exige un token JWT valide
- [ ] Tester avec un token expiré → retourner `401` proprement (CDC BF-06)

### 8.2 Performance PERT [P1]
- [ ] S'assurer que le calcul PERT backend (Étape 2) reste < 100 ms pour 100 tâches
- [ ] Si > 100 ms : mettre en cache le résultat PERT par projet (invalider au prochain write)

### 8.3 Messages d'erreur en français [P2]
- [ ] Revoir tous les messages d'erreur retournés par `tasks.py`, `projects.py`, `activities.py`
- [ ] Les formulaires frontend doivent afficher des messages compréhensibles (CDC BNF-05)

---

## Résumé des dépendances inter-postes

| Sujet | Poste A (Josué) | Poste B (Darelle) | Statut |
|-------|-----------------|-------------------|--------|
| Table `users` + JWT | Consomme le token | Crée et gère | 🔗 Attendre Poste B |
| Table `project_members` | Crée (Étape 5.1) | Lit pour les rôles | À synchroniser |
| Contrat JSON PERT | Produit le calcul (Étape 2.2) | Consomme dans rapports | À définir ensemble |
| `useData.js` | Brancher PERT backend (Étape 2.3) | Hook partagé | ⚠️ Fichier transversal |
| `client.js` | Ajouter endpoints PERT / project_members | Ajouter endpoints auth | ⚠️ Fichier transversal |
| `App.jsx` | Adapter guards UI rôles | Gérer login/logout | ⚠️ Fichier transversal |

---

## Ordre de traitement recommandé

```
Étape 0  →  Étape 1  →  Étape 7 (vérification filtres)
                ↓
           Étape 2 (PERT backend)  →  Étape 4 (Gantt)
                ↓
    🔗 Attendre Poste B (users/JWT)
                ↓
           Étape 3 (rôles tâches)  →  Étape 5 (projets)  →  Étape 6 (activités)
                ↓
           Étape 8 (qualité)
```

---

*Ce fichier ne doit pas être réorganisé sans accord explicite de Josué.*
*Décisions numérotées D-xx en continu commun avec le Poste B.*