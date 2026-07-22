# 🔐 RBAC — Contrôle d'accès basé sur les rôles
## AGT TaskFlow · Session A-07

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
| **Administrateur** | `admin` | Gabriel uniquement | Lecture seule sur tout — ne peut rien créer ni modifier |
| **Chef de projet** | `chef_projet` | Promu par l'admin | Peut créer de nouveaux projets |
| **Membre** | `membre` | Tous les autres | Peut créer des tâches (sans projet), voir ses données |

> **Règle fondamentale :** le rôle global `chef_projet` est un **verrou de création de projet** uniquement. Il ne confère aucun droit d'édition sur un projet existant — c'est le rôle **projet** qui gouverne cela.

### Promotion / rétrogradation automatique

```
Quand un chef est désigné sur un projet  →  role global devient 'chef_projet'
Quand un chef n'est plus owner d'aucun projet  →  role global repasse 'membre'
```

Cette logique est centralisée dans `_demote_if_orphan()` (projects.py).

---

## Niveau 2 — Rôle projet

Indépendamment du rôle global, chaque membre peut avoir un **rôle spécifique dans chaque projet**. Un membre peut être *owner* sur le projet A et *contributeur* sur le projet B.

### Rôles projet

| Rôle | Valeur BDD | Attribution | Description |
|------|-----------|-------------|-------------|
| **Propriétaire** | `owner` | Automatique (créateur) ou désignation admin | Contrôle total du projet et de son équipe |
| **Manager** | `manager` | Promu par l'owner | Édition complète des tâches et activités |
| **Contributeur** | `contributor` | Défaut à l'ajout | Accès limité (voir ci-dessous) |

> **Un seul owner par projet.** Le rôle `owner` ne peut être transféré que par l'administrateur via `PUT /api/projects/<id>/chef`.

---

## Matrice des permissions

### Projets

| Action | Admin | Chef (global) | Owner (projet) | Manager (projet) | Contributor (projet) | Membre sans rôle |
|--------|:-----:|:-------------:|:--------------:|:----------------:|:--------------------:|:----------------:|
| Voir la liste des projets | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Créer un projet | ❌ | ✅ | — | — | — | ❌ |
| Modifier un projet | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Supprimer un projet | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Changer le chef d'un projet | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Équipe d'un projet

| Action | Admin | Owner | Manager | Contributor | Non-membre |
|--------|:-----:|:-----:|:-------:|:-----------:|:----------:|
| Voir les membres du projet | ✅ | ✅ | ✅ |✅  | ✅ |
| Ajouter un membre | ❌ | ✅ | ❌ | ❌ | ❌ |
| Changer le rôle d'un membre | ❌ | ✅ | ❌ | ❌ | ❌ |
| Retirer un membre | ❌ | ✅ | ❌ | ❌ | ❌ |
| Se retirer soi-même | — | ❌ | — | — | — |
| Modifier son propre rôle | ❌ | ❌ | ❌ | ❌ | ❌ |

> L'owner **ne peut pas se retirer ni modifier son propre rôle**. Le seul moyen de changer l'owner est via l'administrateur.

### Tâches

La permission sur une tâche est calculée dynamiquement par `get_task_permission_level()` et retournée dans le champ `permission` de chaque tâche.

| Situation | Permission retournée |
|-----------|---------------------|
| Admin | `read_only` |
| Créateur de la tâche (`owner_id`) | `full` |
| Owner ou manager du projet de la tâche | `full` |
| Contributor du projet **ET** responsable de la tâche | `status_only` |
| Tout autre membre du projet | `read_only` |
| Non-membre du projet (tâche sans projet) | invisible |

**Ce que chaque niveau autorise :**

| Champ / Action | `full` | `status_only` | `read_only` |
|----------------|:------:|:-------------:|:-----------:|
| Voir la tâche | ✅ | ✅ | ✅ |
| Modifier description, dates, priorité… | ✅ | ❌ | ❌ |
| Modifier le statut | ✅ | ✅ *(sauvegarde immédiate)* | ❌ |
| Changer le responsable | ✅ | ❌ | ❌ |
| Supprimer la tâche | ✅ | ❌ | ❌ |
| Archiver / désarchiver | ✅ | ❌ | ❌ |
| Signaler une difficulté | — | ✅ *(si responsable)* | ❌ |

#### Validation à la création d'une tâche dans un projet

Quand `project_id` est fourni, le backend vérifie dans l'ordre :

```
1. Le projet existe                                          → 404 si absent
2. Le créateur est membre du projet                          → 403 si non-membre
3. Le créateur est owner ou manager                          → 403 si contributor
4. Le responsable désigné est aussi membre du projet         → 400 si non-membre
```

#### Visibilité des tâches (filtre P3)

```
Admin                →  voit toutes les tâches
Tâche sans projet    →  visible si owner_id == moi  OU  responsible == mon nom
Tâche avec projet    →  visible si je suis membre du projet
```

> Le graphe PERT est calculé sur **toutes** les tâches avant l'application du filtre P3, pour garantir l'intégrité des marges et du chemin critique.

### Activités

| Action | Admin | Owner (projet) | Manager (projet) | Contributor | Non-membre |
|--------|:-----:|:--------------:|:----------------:|:-----------:|:----------:|
| Voir les activités du projet | ✅ | ✅ | ✅ | ✅ | ❌ |
| Créer une activité | ❌ | ✅ | ✅ | ❌ | ❌ |
| Modifier une activité | ❌ | ✅ | ✅ *(P4)* | ❌ | ❌ |
| Supprimer une activité | ❌ | ✅ | ✅ *(P4)* | ❌ | ❌ |

> **P4** = un manager peut modifier toutes les activités du projet, pas seulement celles qu'il a créées. C'est la raison pour laquelle le champ renvoyé par l'API est `can_edit` (et non plus `is_owner`).

---

## Seed rattrapage (migration non-destructive)

À chaque démarrage, `init_db()` peuple automatiquement `project_members` depuis les données existantes :

```
projects.chef_id            →  (project_id, chef_id,        'owner')
tasks.owner_id              →  (project_id, owner_id,       'contributor')
tasks.responsible (par nom) →  (project_id, member_id,      'contributor')
activities.owner_id         →  (project_id, owner_id,       'contributor')
```

Toutes ces insertions utilisent `INSERT OR IGNORE` — elles sont idempotentes et ne modifient jamais un rôle déjà attribué.

---

## Architecture du code

### Fichiers du système RBAC

```
backend/
├── utils/
│   ├── permissions.py          ← Centralisateur RBAC (source de vérité unique)
│   └── auth.py                 ← Décodage JWT, decorateurs require_auth / require_admin
└── routes/
    ├── project_members.py      ← CRUD équipe projet (/api/projects/<id>/members)
    ├── projects.py             ← Intègre project_members sur create/update/delete/chef
    ├── tasks.py                ← Filtre P3 + validate_task_creation + get_task_permission_level
    └── activities.py           ← Filtre P3 + can_edit_activity (P4)

frontend/
└── src/
    ├── api/client.js                               ← getProjectMembers / add / update / remove
    └── components/
        ├── projects/
        │   ├── ProjectsView.jsx                    ← Badges user_role, bouton Équipe conditionnel
        │   └── ProjectMembersPanel.jsx             ← Panel inline gestion équipe
        └── tasks/
            └── TaskModal.jsx                       ← saveError inline + filtre creatableProjects
```

### Fonctions clés — `permissions.py`

| Fonction | Entrées | Retour | Usage |
|----------|---------|--------|-------|
| `get_project_role` | conn, user_id, project_id | `'owner'` \| `'manager'` \| `'contributor'` \| `None` | Base de tout le système |
| `is_project_member` | conn, user_id, project_id | `bool` | Guard d'accès rapide |
| `get_user_project_ids` | conn, user_id | `set[int]` | Pré-calcul P3 (une seule requête) |
| `is_task_visible` | task, user, project_ids | `bool` | Filtre P3 tâches |
| `get_task_permission_level` | conn, user, task | `'full'` \| `'status_only'` \| `'read_only'` | Permission fine sur tâche |
| `can_edit_activity` | conn, user, activity | `bool` | Guard P4 activités |
| `can_create_activity` | conn, user, project_id | `bool` | Guard création activité |
| `validate_task_creation` | conn, user, data | `(ok, msg, code)` | 4 validations en cascade |

---

## Endpoints API — project_members

```
GET    /api/projects/:id/members         Lister les membres (membres du projet + admin)
POST   /api/projects/:id/members         Ajouter un membre (owner uniquement)
PUT    /api/projects/:id/members/:mid    Changer le rôle (owner uniquement)
DELETE /api/projects/:id/members/:mid    Retirer un membre (owner uniquement)
```

### Payload POST / PUT

```json
POST  { "member_id": 3, "role": "contributor" }
PUT   { "role": "manager" }
```

Les seuls rôles attribuables via ces endpoints sont `"manager"` et `"contributor"`. Le rôle `"owner"` est réservé à `POST /api/projects/` (création) et `PUT /api/projects/:id/chef` (admin).

---

## Réponse enrichie — `GET /api/projects/`

Chaque projet retourne désormais deux champs supplémentaires :

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
| `user_role` | `string \| null` | Rôle du membre connecté dans ce projet. `null` si non-membre ou admin |

Le frontend utilise `user_role` pour afficher les boutons d'action sans appel API supplémentaire.

---

## Règles de sécurité invariantes

1. **L'admin est en lecture seule** sur toutes les entités opérationnelles (tâches, activités, projets). Il ne peut créer ni modifier — seulement observer et gérer les comptes.

2. **L'owner ne peut pas se retirer** de son propre projet. Seul l'admin peut transférer l'ownership.

3. **Le rôle `owner` n'est jamais attribuable** via les endpoints de gestion d'équipe — uniquement via la création de projet ou le changement de chef (admin).

4. **Un contributor ne peut créer une tâche** dans aucun projet. Il peut uniquement mettre à jour le statut des tâches dont il est responsable.

5. **Un responsable de tâche doit être membre du projet** contenant cette tâche. Le backend rejette toute tentative d'affectation d'un non-membre.

6. **Le filtre P3 est appliqué côté backend** — un utilisateur ne peut jamais obtenir via l'API des données de projets dont il n'est pas membre, quelle que soit la manipulation frontend.
