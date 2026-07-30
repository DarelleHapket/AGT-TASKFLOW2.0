# Session B-02 — Module 1 RBAC (rôles multiples + permissions ABAC)

**Poste :** B (Darelle)
**Date :** 29/07/2026
**Branche :** feat/darelle-B

## Objectif de la session

Corriger les bugs prioritaires signalés, puis implémenter le Module 1 du CDC
ERP : RBAC complet avec rôles multiples et permissions directes découplées.

## Tâches traitées

1. Correction B01 : reconnexion forcée après promotion chef_projet (refreshUser + isChef manquant dans ProjectsView).
2. Correction B02/B04 : création de tâches en masse (multi-sélection responsables dans TaskModal).
3. Conception + implémentation RBAC Module 1 : tables roles, permissions, role_permissions, member_roles, member_permissions.
4. Endpoint /api/rbac/* : gestion rôles/permissions réservée au superadmin.
5. Frontend RBACView.jsx : écran de gestion rôles/permissions avec badges colorés.
6. Rôle superadmin seedé automatiquement (Gabriel), prioritaire sur la colonne role legacy.

## Fichiers touchés

| Fichier | Périmètre | Nature |
|---------|-----------|--------|
| backend/database.py | partagé | + tables RBAC (roles, permissions, role_permissions, member_roles, member_permissions) + seed |
| backend/utils/auth.py | partagé | + require_permission(code) |
| backend/utils/rbac.py | B | nouveau — logique métier RBAC (assign_role, grant_permission, etc.) |
| backend/routes/rbac.py | B | nouveau — endpoints CRUD rôles/permissions |
| backend/routes/auth.py | B | _effective_role() : priorité superadmin sur colonne legacy |
| frontend/src/hooks/useAuth.js | partagé | + isSuperadmin |
| frontend/src/api/client.js | partagé | + fonctions RBAC (getRoles, assignMemberRole, etc.) |
| frontend/src/components/rbac/RBACView.jsx | B | nouveau — écran gestion rôles/permissions |
| frontend/src/App.jsx | partagé | + onglet "Rôles" (visible superadmin uniquement) |
| frontend/src/components/tasks/TaskModal.jsx | B | multi-sélection responsables (B02) |

## Décisions numérotées

- **D-05** — RBAC à deux niveaux indépendants : rôles globaux (superadmin/admin/chef_projet/membre) et rôles projet (owner/manager/contributor, déjà existant côté Josué).
- **D-06** — Multi-rôles : un membre peut cumuler plusieurs rôles globaux (table member_roles).
- **D-07** — Permission effective = tout ce qui est dans member_permissions avec granted=1, peu importe la source (role ou direct) — modèle ABAC hybride.
- **D-08** — Découplage : à l'assignation d'un rôle, ses permissions sont copiées (source='role'). Le retrait du rôle NE retire PAS les permissions déjà copiées (elles restent jusqu'à retrait explicite).
- **D-09** — Superadmin unique, seedé au démarrage (Gabriel), non attribuable via l'interface.
- **D-10** — /login et /me calculent le rôle effectif via _effective_role() : superadmin (multi-rôles) prioritaire sur la colonne members.role legacy.
- **D-11** — Sidebar réorganisée : Finances/RH/Matériel mis en avant (même non construits) avant Tâches/PERT/Gantt — logique métier pour le boss plutôt que jargon technique.
- **D-12** — Protocole de session remplacé par version inspirée PI-1 à PI-11 (voir PROMPT_B.md v2.0).

## Bugs corrigés

| # | Bug | Statut |
|---|-----|--------|
| B01 | Reconnexion forcée après promotion chef | ✅ Corrigé (refreshUser + isChef dans ProjectsView) |
| B02/B04 | Pas de création de tâches en masse | ✅ Corrigé (multi-sélection TaskModal) |

## Bugs restants (à traiter B-03)

| # | Bug |
|---|-----|
| B03 | Ajout membre sur projet : pas d'option "tous" |
| B05 | PERT badge notification ne disparaît pas au clic |
| B08 | Activités sans valeurs par défaut |
| B09 | Notes disparaissent au changement d'onglet |
| B10 | Label "Demander un compte" → "Créer un compte" |

## Tâche suivante recommandée

Documenter les endpoints RBAC en Markdown (docs/endpoints_module1.md), puis
attaquer les bugs restants (B03, B05, B08, B09, B10) avant de démontrer le
Module 1 complet à Gabriel vendredi.

⚠️ Note : cette session part du principe que la dernière session B- était B-01
(chef_projet). Merci de vérifier docs/ia/INDEX.md pour confirmer qu'aucune
session B- intermédiaire n'a été numérotée entre-temps, et ajuster D-05→D-12
si Josué a déjà utilisé ces numéros de décision.
