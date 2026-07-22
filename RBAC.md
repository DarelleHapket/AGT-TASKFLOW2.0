# 🔐 RBAC — Contrôle d'accès basé sur les rôles
## AGT TaskFlow · Sessions A-07 (mise à jour complète)

---

## Vue d'ensemble

AGT TaskFlow utilise un système RBAC à **deux niveaux indépendants** :

| Niveau | Portée | Stockage |
|--------|--------|----------|
| **Rôle global** | Toute l'application | `members.role` |
| **Rôle projet** | Par projet uniquement | `project_members.role` |

Ces deux niveaux coexistent et se combinent pour déterminer ce qu'un utilisateur peut faire à chaque instant.

---

## Niveau 1 — Rôle global

Chaque membre possède **un seul rôle global**, assigné à l'inscription ou promu par l'administrateur.

### Rôles globaux

| Rôle | Valeur BDD | Qui | Accès |
|------|-----------|-----|-------|
| **Administrateur** | `admin` | Gabriel uniquement | Lecture seule sur les entités opérationnelles · Gestion complète des comptes membres |
| **Chef de projet** | `chef_projet` | Promu par l'admin | Peut créer de nouveaux projets |
| **Membre** | `membre` | Tous les autres | Peut créer des tâches sans projet · Voir ses données |

> **Règle fondamentale :** le rôle global `chef_projet` est un **verrou de création de projet** uniquement. Il ne confère aucun droit d'édition sur un projet existant — c'est le rôle **projet** qui gouverne cela.

### Promotion / rétrogradation automatique

```
Désignation chef d'un projet  →  role global devient 'chef_projet'
Perd ownership sur tous projets  →  role global repasse 'membre'
```

Logique centralisée dans `_demote_if_orphan()` (`projects.py`).

---

## Niveau 2 — Rôle projet

Indépendamment du rôle global, chaque membre peut avoir un **rôle spécifique dans chaque projet**. Un membre peut être *owner* sur le projet A et *contributeur* sur le projet B.

### Rôles projet

| Rôle | Valeur BDD | Attribution | Description |
|------|-----------|-------------|-------------|
| **Propriétaire** | `owner` | Automatique (créateur) ou désignation admin | Contrôle total du projet et de son équipe |
| **Manager** | `manager` | Promu par l'owner | Édition complète des tâches et activités |
| **Contributeur** | `contributor` | Défaut à l'ajout | Accès limité — voir matrice ci-dessous |

> **Un seul owner par projet.** Le rôle `owner` ne peut être transféré que par l'administrateur via `PUT /api/projects/<id>/chef`.

---

## Matrice des permissions

### Gestion des membres de la plateforme

Actions réservées à l'administrateur. Les guards s'appliquent sur **chaque action** : l'admin ne peut jamais agir sur lui-même ni sur un autre compte `admin`.

| Action | Admin | Chef | Membre |
|--------|:-----:|:----:|:------:|
| Voir les membres actifs | ✅ | ✅ | ✅ |
| Voir les demandes en attente | ✅ | ❌ | ❌ |
| Voir les comptes suspendus | ✅ | ❌ | ❌ |
| Valider / Rejeter une demande | ✅ | ❌ | ❌ |
| Promouvoir / Rétrograder (membre ↔ chef_projet) | ✅ | ❌ | ❌ |
| Suspendre un compte | ✅ *(non-soi, non-admin)* | ❌ | ❌ |
| Réactiver un compte suspendu | ✅ *(non-soi, non-admin)* | ❌ | ❌ |
| Supprimer définitivement un compte | ✅ *(non-soi, non-admin)* | ❌ | ❌ |

**Cycle de vie d'un compte :**
```
inscription  →  pending  →  [approve] active  ←→  [toggle] suspended
                          →  [reject]  rejected
                          active  →  [delete] supprimé (irréversible)
```

**Champ `password_hash` :** jamais exposé dans aucune réponse API (`GET /api/members/` retourne des colonnes explicites sans ce champ).

---

### Projets

| Action | Admin | Chef (global) | Owner (projet) | Manager (projet) | Contributor | Membre sans rôle |
|--------|:-----:|:-------------:|:--------------:|:----------------:|:-----------:|:----------------:|
| Voir la liste des projets | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Créer un projet | ❌ | ✅ | — | — | — | ❌ |
| Modifier un projet | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Supprimer un projet | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Changer le chef d'un projet | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### Équipe d'un projet

| Action | Admin | Owner | Manager | Contributor | Non-membre |
|--------|:-----:|:-----:|:-------:|:-----------:|:----------:|
| Voir les membres du projet | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ajouter un membre | ❌ | ✅ | ❌ | ❌ | ❌ |
| Changer le rôle d'un membre | ❌ | ✅ *(manager ↔ contributor)* | ❌ | ❌ | ❌ |
| Retirer un membre | ❌ | ✅ | ❌ | ❌ | ❌ |
| Se retirer soi-même | — | ❌ | — | — | — |
| Modifier son propre rôle | ❌ | ❌ | ❌ | ❌ | ❌ |

> L'owner ne peut pas se retirer ni changer son propre rôle. Le transfert d'ownership passe exclusivement par l'admin (`PUT /api/projects/:id/chef`).

---

### Tâches

La permission est calculée dynamiquement par `get_task_permission_level()` et retournée dans le champ `permission` de chaque tâche.

| Situation | Permission |
|-----------|-----------|
| Admin | `read_only` |
| Créateur de la tâche (`owner_id`) | `full` |
| Owner ou manager du projet | `full` |
| Contributor **ET** responsable de la tâche | `status_only` |
| Tout autre membre du projet | `read_only` |
| Non-membre (tâche avec projet) | **invisible** |
| Tâche sans projet — non créateur, non responsable | **invisible** |

**Ce que chaque niveau autorise :**

| Action | `full` | `status_only` | `read_only` |
|--------|:------:|:-------------:|:-----------:|
| Voir la tâche | ✅ | ✅ | ✅ |
| Modifier description, dates, priorité… | ✅ | ❌ | ❌ |
| Modifier le statut | ✅ | ✅ *(immédiat)* | ❌ |
| Changer le responsable | ✅ | ❌ | ❌ |
| Supprimer / archiver | ✅ | ❌ | ❌ |
| Signaler une difficulté | ✅ | ✅ | ❌ |

#### Validation à la création d'une tâche dans un projet

```
1. Le projet existe                                    → 404 si absent
2. Le créateur est membre du projet                    → 403 si non-membre
3. Le créateur est owner ou manager                    → 403 si contributor
4. Le responsable désigné est membre du projet         → 400 si non-membre
```

#### Visibilité des tâches (filtre P3)

```
Admin                →  voit toutes les tâches
Tâche sans projet    →  visible si owner_id == moi  OU  responsible == mon nom
Tâche avec projet    →  visible si je suis membre du projet (project_members)
```

> Le graphe PERT est calculé sur **toutes** les tâches avant le filtre P3 pour garantir l'intégrité des marges et du chemin critique.

---

### Activités

| Action | Admin | Owner | Manager | Contributor | Non-membre |
|--------|:-----:|:-----:|:-------:|:-----------:|:----------:|
| Voir les activités du projet | ✅ | ✅ | ✅ | ✅ | ❌ |
| Créer une activité | ❌ | ✅ | ✅ | ❌ | ❌ |
| Modifier une activité | ❌ | ✅ | ✅ *(P4)* | ❌ | ❌ |
| Supprimer une activité | ❌ | ✅ | ✅ *(P4)* | ❌ | ❌ |

> **P4 :** un manager peut modifier toutes les activités du projet, pas seulement celles qu'il a créées. Le champ renvoyé par l'API est `can_edit` (et non plus `is_owner`).

---

### Difficultés signalées

| Action | Admin | Owner / Manager du projet | Créateur de la tâche | Responsable | Autre membre |
|--------|:-----:|:-------------------------:|:--------------------:|:-----------:|:------------:|
| Voir les difficultés d'une tâche | ✅ | ✅ | ✅ | ✅ | ❌ |
| Signaler une difficulté | ❌ | ✅ | ✅ | ✅ | ❌ |
| Supprimer sa propre difficulté | ❌ | ✅ | ✅ | ✅ | ❌ |
| Supprimer une difficulté d'un autre | ✅ | ✅ | ✅ | ✅ | ❌ |

> La vérification d'accès (`can_access_task`) utilise `get_project_role()` depuis `permissions.py` — elle ne lit plus `projects.chef_id` directement.

---

## Système de notifications

### Déclencheurs

| Événement | Type | Destinataires | Déclencheur |
|-----------|------|---------------|-------------|
| Tâche créée avec un responsable | `task_assigned` | Le responsable désigné | `POST /api/tasks/` |
| Responsable changé sur une tâche | `task_assigned` | Le nouveau responsable | `PUT /api/tasks/<id>` |
| Difficulté signalée sur une tâche | `difficulty_reported` | Tous les **owners** et **managers** du projet | `POST /api/difficulties/` |
| Demande de compte déposée | `register_request` | L'administrateur | `POST /api/auth/register` |

**Règles communes :**
- Un utilisateur ne reçoit jamais de notification de sa propre action (expéditeur exclu des destinataires).
- Les notifications sont persistées 7 jours en base, puis purgées automatiquement.

### Badge de la cloche

Le badge compte **uniquement les notifications backend non lues** (`read_at IS NULL`). Source de vérité unique — aucun tracking localStorage séparé.

```
unseenTotal = notifications.filter(n => !n.read_at).length
```

Les difficultés alimentent le badge via le système de notifications (`difficulty_reported`), pas via des appels `getDifficulties()` en parallèle.

---

## Seed rattrapage (migration non-destructive)

À chaque démarrage, `init_db()` peuple automatiquement `project_members` depuis les données existantes :

```
projects.chef_id            →  (project_id, chef_id,   'owner')
tasks.owner_id              →  (project_id, owner_id,  'contributor')
tasks.responsible (par nom) →  (project_id, member_id, 'contributor')
activities.owner_id         →  (project_id, owner_id,  'contributor')
```

Toutes ces insertions utilisent `INSERT OR IGNORE` — idempotentes, sans modification d'un rôle déjà attribué.

---

## Architecture du code

### Fichiers du système RBAC

```
backend/
├── utils/
│   ├── permissions.py       ← Centralisateur RBAC (source de vérité unique)
│   ├── auth.py              ← Décodage JWT, require_auth / require_admin
│   └── notif.py             ← Helper notify() — insère en base, l'appelant commit
└── routes/
    ├── project_members.py   ← CRUD équipe projet (/api/projects/<id>/members)
    ├── projects.py          ← Sync project_members + user_role/member_count
    ├── tasks.py             ← Filtre P3 · validate_task_creation · notify responsable
    ├── activities.py        ← Filtre P3 · can_edit_activity (P4) · champ can_edit
    ├── difficulties.py      ← can_access_task via get_project_role · notify owners+managers
    ├── members.py           ← Gestion comptes : pending · suspended · toggle-active · delete
    └── notifications.py     ← GET (purge 7j) · PATCH read · PATCH read-all

frontend/
└── src/
    ├── api/client.js                          ← Toutes les fonctions API (password_hash jamais reçu)
    └── components/
        ├── projects/
        │   ├── ProjectsView.jsx               ← Badges user_role, bouton Équipe conditionnel
        │   └── ProjectMembersPanel.jsx        ← Panel inline gestion équipe (lazy load)
        ├── tasks/
        │   └── TaskModal.jsx                  ← saveError inline · filtre creatableProjects
        └── team/
            └── TeamView.jsx                   ← Sections pending/suspended/actifs · actions admin
```

### Fonctions clés — `permissions.py`

| Fonction | Entrées | Retour | Usage |
|----------|---------|--------|-------|
| `get_project_role` | conn, user_id, project_id | `'owner'` \| `'manager'` \| `'contributor'` \| `None` | Base de tout le système |
| `is_project_member` | conn, user_id, project_id | `bool` | Guard accès rapide |
| `get_user_project_ids` | conn, user_id | `set[int]` | Pré-calcul filtre P3 (1 requête) |
| `is_task_visible` | task, user, project_ids | `bool` | Filtre P3 tâches |
| `get_task_permission_level` | conn, user, task | `'full'` \| `'status_only'` \| `'read_only'` | Permission fine tâche |
| `can_edit_activity` | conn, user, activity | `bool` | Guard P4 activités |
| `can_create_activity` | conn, user, project_id | `bool` | Guard création activité |
| `validate_task_creation` | conn, user, data | `(ok, msg, code)` | 4 validations cascade |

---

## Référence API

### project_members

```
GET    /api/projects/:id/members         Lister (membres du projet + admin)
POST   /api/projects/:id/members         Ajouter — owner uniquement
PUT    /api/projects/:id/members/:mid    Changer le rôle — owner uniquement (manager|contributor)
DELETE /api/projects/:id/members/:mid    Retirer — owner uniquement
```

### members (admin)

```
GET    /api/members/                     Membres actifs (colonnes safe, sans password_hash)
GET    /api/members/pending              Demandes en attente — admin uniquement
GET    /api/members/suspended            Comptes suspendus — admin uniquement
PUT    /api/members/:id/validate         Approuver ou rejeter — admin uniquement
PUT    /api/members/:id/role             Changer rôle global (membre|chef_projet) — admin uniquement
PUT    /api/members/:id/toggle-active    Suspendre / Réactiver — admin uniquement
DELETE /api/members/:id                  Supprimer définitivement — admin uniquement
```

### Réponse enrichie — `GET /api/projects/`

```json
{
  "id": 1,
  "name": "ERP v2",
  "chef_name": "Alice",
  "member_count": 4,
  "user_role": "owner"
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `member_count` | `int` | Nombre de membres dans `project_members` |
| `user_role` | `string \| null` | Rôle du connecté dans ce projet — `null` si non-membre ou admin |

---

## Règles de sécurité invariantes

1. **L'admin est en lecture seule** sur les entités opérationnelles (tâches, activités, projets). Il ne peut créer ni modifier — il gère uniquement les comptes membres.

2. **L'admin ne peut jamais agir sur lui-même** (toggle-active, delete, role) ni sur un autre compte `admin`.

3. **L'owner ne peut pas se retirer** de son propre projet ni modifier son propre rôle. Le transfert d'ownership passe uniquement par l'admin.

4. **Le rôle `owner` n'est pas attribuable** via les endpoints de gestion d'équipe — uniquement via `POST /api/projects/` (création) ou `PUT /api/projects/:id/chef` (admin).

5. **Un contributor ne peut pas créer de tâche** dans un projet. Il peut uniquement mettre à jour le statut des tâches dont il est responsable.

6. **Un responsable doit être membre du projet.** Toute tentative d'affectation d'un non-membre est rejetée par le backend.

7. **Le filtre P3 est côté backend.** Un utilisateur ne peut jamais obtenir via l'API des données de projets dont il n'est pas membre, quelle que soit la manipulation frontend.

8. **`password_hash` n'est jamais exposé.** `GET /api/members/` utilise des colonnes explicites — ce champ est exclu de toutes les réponses API.

9. **Les notifications sont la source de vérité du badge.** Aucun tracking côté client (localStorage) n'entre dans le calcul du compteur de la cloche — uniquement les `read_at IS NULL` en base.