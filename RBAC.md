# 🔐 RBAC + IBAC — Contrôle d'accès

## AGT ERP · Stack Django (`backend_django/authentification`, `backend_django/projets`)

> Réécriture complète du 2026-08-10 : ce document décrivait l'ancienne stack Flask
> (rôle global unique par membre, `member_roles`). Elle a été supprimée du dépôt.
> Ce qui suit décrit le système RBAC + IBAC réellement en place dans
> `backend_django`. Référence de conception détaillée (diagrammes UML) :
> [`documents/Document_Analyse_Module1_RBAC-IBAC_v1.1.md`](documents/Document_Analyse_Module1_RBAC-IBAC_v1.1.md)
> et [`documents/Document_Conception_Module1_RBAC-IBAC_v1.1.md`](documents/Document_Conception_Module1_RBAC-IBAC_v1.1.md).

---

## Vue d'ensemble

Deux niveaux indépendants coexistent :

| Niveau | Portée | Modèle |
|---|---|---|
| **Rôle(s) global(aux)** | Toute l'application | `authentification.Role` / `AttributionRole` / `PermissionEffective` — **multi-rôle** (BF-04) |
| **Rôle projet** | Par projet uniquement | `projets.MembreProjet.role` (`owner` / `manager` / `contributor`) |

---

## Niveau 1 — RBAC + IBAC global

### Modèles (`authentification/models.py`)

| Modèle | Rôle |
|---|---|
| `Permission` | Catalogue — `code` (unique, ex. `rh.write` ou `gerer:conges`), `module` (regroupement d'affichage), `description`. |
| `Role` | Catalogue de rôles (`code` unique : `superadmin`, `admin`, `chef_projet`, `membre`, + tout rôle créé via `/rbac`) — lié à `Permission` via `RolePermission` (permissions **par défaut** du rôle). |
| `AttributionRole` | Table pivot Utilisateur ↔ Role — un utilisateur peut porter **plusieurs rôles simultanément** (BF-04). |
| `PermissionEffective` | Une ligne par (utilisateur, permission) : `source` = `role` (copiée depuis un rôle porté) ou `direct` (accordée/retirée explicitement, IBAC) ; `accordee` = bool. **C'est la table lue à chaque vérification de permission.** |

`User.peut(code)` : `True` si superadmin (bypass total), sinon vrai si une ligne
`PermissionEffective(code, accordee=True)` existe pour cet utilisateur.

### Style des codes de permission

Deux conventions coexistent, sans impact fonctionnel (juste une chaîne de
caractères) :
- **Historique** : `ressource.verbe` (ex. `rh.write`, `membres.validate`,
  `finances.bilan.voir`) — toutes les permissions créées par les migrations de
  seed (une par module : `rh`, `finances`, `materiel`, `membres`, `projets`…).
- **Nouveau** (permissions créées depuis `/rbac`, formulaire Verbe+Ressource) :
  `verbe:ressource` (ex. `gerer:conges`), style team-tool.

### Attribution et retrait d'un rôle (`authentification/services.py`)

- **`assign_role(user, role_code)`** : ajoute `AttributionRole`, copie les
  permissions par défaut du rôle dans `PermissionEffective` (`source='role'`).
  Les permissions déjà accordées **directement** (`source='direct'`) ne sont
  jamais écrasées.
- **`revoke_role(user, role_code)`** *(corrigé le 2026-08-10)* : retire
  `AttributionRole`, **et** retire les permissions que ce rôle précis avait
  copiées — sauf si (a) un autre rôle encore porté par l'utilisateur les
  accorde aussi, ou (b) elles ont été rendues indépendantes par un
  grant/revoke **direct** (IBAC, toujours prioritaire). Avant cette
  correction, une permission copiée restait accrochée indéfiniment même après
  le retrait du rôle qui l'avait donnée (bug réel observé : un compte passé
  d'Admin à Membre gardait `membres.delete`).
- **`grant_permission` / `revoke_permission`** : accordent ou retirent une
  permission **directement** (`source='direct'`), indépendamment de tout rôle
  — c'est l'IBAC. Un retrait direct prime toujours sur ce qu'un rôle
  accorderait par défaut.

### Vérification — `HasPerm(code)`

Fabrique de permission DRF (`authentification/services.py`) : `HasPerm("rh.write")`
retourne une classe de permission dont `has_permission` appelle
`request.user.peut("rh.write")`. Utilisée dans `permission_classes` de chaque
ViewSet/vue.

### Rôles particuliers

- **Superadmin** : `is_superuser=True` ou porte le rôle `superadmin` — bypass
  total (`peut()` retourne toujours `True`), jamais soumis aux permissions du
  catalogue.
- **Admin** : rôle **unique** (un seul titulaire à la fois, décision produit) —
  accès en lecture seule sur les entités opérationnelles (tâches, activités,
  projets), gestion complète des comptes membres et des « Ressources de
  l'entreprise » (RH, Finances, Matériel). Ne peut pas aussi porter
  `superadmin` (accès déjà total, la combinaison n'a pas de sens).
- **Chef de projet** : verrou de **création** de projet uniquement (`RequireChefOnly`,
  `projets/views.py`) — ne confère aucun droit d'édition sur un projet
  existant, c'est le rôle **projet** (niveau 2) qui gouverne ça.

---

## Niveau 2 — Rôle projet

Indépendamment des rôles globaux, chaque membre peut avoir un rôle par projet
(`MembreProjet.role`, `projets/models.py`) : `owner` (propriétaire, contrôle
total du projet et de son équipe), `manager` (édition complète des tâches et
activités), `contributor` (accès limité). Un membre peut être owner sur le
projet A et contributor sur le projet B.

`get_project_role(user, projet_id)` (`projets/acces.py`) retourne le rôle de
l'utilisateur sur un projet donné (`None` si non-membre).

### Permission sur une tâche — `get_task_permission_level`

Calculée dynamiquement (`projets/acces.py`), renvoyée dans le champ
`permission` de chaque tâche :

| Situation | Permission |
|---|---|
| Admin | `read_only` |
| Créateur de la tâche | `full` |
| Owner ou manager du projet | `full` |
| Contributor **et** responsable de la tâche | `status_only` |
| Tâche sans projet, responsable == moi | `status_only` |
| Autre cas | `read_only` |

`full` : voir/modifier/supprimer tout. `status_only` : voir + changer le
statut uniquement (select inline sur `/taches`). `read_only` : voir seulement.

---

## Interfaces de gestion

### `/rbac` — catalogue

- **Rôles** : créer/supprimer un rôle, basculer ses permissions **par
  défaut** (celles copiées à quiconque reçoit ce rôle ensuite).
- **Permissions** : créer (Verbe + Ressource → `verbe:ressource`) / supprimer
  une permission du catalogue.
- Tableau par membre (rôles portés + détail permission par permission, source
  role/direct/superadmin distinguée).

### `/membres` — par membre

Chaque carte de membre actif (sauf superadmin) affiche, pour le Superadmin
uniquement : badges **Rôles** (cliquables, ajout/retrait) et **Permissions
directes** (cliquables, regroupées par module) — bascule immédiate via
`assign_role`/`revoke_role`/`grant_permission`/`revoke_permission`.

---

## Référence API (`authentification/urls.py`)

```
GET/PATCH  /api/auth/me                              Profil courant (nom, couleur d'avatar)
POST       /api/auth/login                            Connexion (email + mot de passe)
POST       /api/auth/register                          Demande de compte (statut EN_ATTENTE)

GET/POST/PATCH/DELETE  /api/roles                      CRUD rôles — HasPerm("roles.manage")
GET/POST/DELETE         /api/permissions                CRUD permissions — HasPerm("permissions.manage")
GET/POST/PATCH/DELETE   /api/membres                    CRUD comptes — HasPerm("membres.read"/"membres.write")

POST    /api/rbac/membres/<id>/roles                   Attribuer un rôle — Superadmin uniquement
DELETE  /api/rbac/membres/<id>/roles/<code>             Retirer un rôle — Superadmin uniquement
GET     /api/rbac/membres/<id>/permissions              Détail permission par permission (granted + source)
PUT     /api/rbac/membres/<id>/permissions/<code>        Accorder/retirer directement (IBAC) — Superadmin uniquement

PUT  /api/membres/<id>/validate                         Approuver/rejeter une demande — HasPerm("membres.validate")
PUT  /api/membres/<id>/toggle-active                     Suspendre/réactiver — HasPerm("membres.suspend")
```

---

## Règles de sécurité invariantes

1. **Superadmin bypass tout** — jamais soumis au catalogue de permissions.
2. **Admin est un rôle unique** — ne peut être porté que par une seule
   personne à la fois ; ne peut pas être combiné avec `superadmin`.
3. **Un retrait direct (IBAC) prime toujours** sur ce qu'un rôle accorderait
   par défaut — dans un sens (retrait explicite bloque même si un rôle
   accorderait la permission) comme dans l'autre (grant explicite persiste
   même après retrait du rôle qui l'accordait aussi).
4. **Retirer un rôle nettoie ses permissions par défaut** (depuis le
   2026-08-10) — sauf permission encore accordée par un autre rôle actif, ou
   rendue indépendante par un grant/revoke direct.
5. **Le rôle `owner` d'un projet n'est pas attribuable** via les endpoints de
   gestion d'équipe — uniquement à la création du projet, ou transféré par le
   Superadmin.
6. **`password` n'est jamais exposé** dans aucune réponse API.
