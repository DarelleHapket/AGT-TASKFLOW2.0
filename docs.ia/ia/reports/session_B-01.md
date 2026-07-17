# Session B-01 — Rôle Chef de projet (Auth/Rôles + Difficultés)

**Poste :** B (Darelle)
**Date :** 16/07/2026
**Branche :** feat/darelle-B

## Objectif de la session

Introduire un vrai système à 3 rôles (admin, chef_projet, membre) et brancher le
rôle chef_projet sur le module Difficultés, avec filtrage par projet côté backend.

## Tâches traitées

1. Ajout du rôle `chef_projet` au socle d'authentification (RBAC à 3 rôles).
2. Rattachement d'un chef à un projet (colonne `chef_id`) + route de désignation.
3. Filtrage des difficultés : un chef ne voit que celles de ses projets.
4. Ouverture de la cloche de notifications au chef côté frontend.

## Fichiers touchés

| Fichier                        | Périmètre | Nature                                                                                            |
| ------------------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| backend/database.py            | partagé   | + colonne `role` (members) + colonne `chef_id` (projects), migrations non-destructives + backfill |
| backend/utils/auth.py          | partagé   | + décorateur `require_role(*roles)` (require_auth/require_admin inchangés)                        |
| backend/routes/auth.py         | B         | `role` ajouté au token JWT et aux réponses login + /me                                            |
| backend/routes/projects.py     | A (Josué) | + route `PUT /api/projects/<id>/chef` (admin). CRUD de Josué INCHANGÉ                             |
| backend/routes/difficulties.py | B         | filtrage par projet du chef (helper `can_access_task`) sur GET/POST/DELETE                        |
| frontend/src/hooks/useAuth.js  | partagé   | expose `role`, `isChef`, `isMembre`                                                               |
| frontend/src/App.jsx           | partagé   | cloche + compteurs ouverts au chef, badge CHEF                                                    |
| docs/ia/CHANGES_SHARED.md      | partagé   | création du journal des changements inter-équipes                                                 |

## Décisions numérotées

- **D-01** — Système RBAC à 3 rôles : `admin`, `chef_projet`, `membre`. `is_admin` est CONSERVÉ et synchronisé avec `role` (is_admin=1 <=> role='admin') pour ne pas casser le code du poste A.
- **D-02** — L'autorisation d'accès aux difficultés se fait CÔTÉ BACKEND (pas seulement affichage front), via le helper `can_access_task`. Règle : admin voit tout ; chef voit les difficultés des tâches de ses projets (via projects.chef_id) ; membre voit ses tâches assignées.
- **D-03** — La désignation du chef d'un projet est réservée à l'admin (cf. diagramme : « Admin désigne ChefProjet »). Désigner un membre le promeut automatiquement en `chef_projet`.
- **D-04** — Un chef n'est PAS rétrogradé automatiquement s'il perd un projet (il peut en avoir plusieurs). Rétrogradation fine = à traiter plus tard.
- **D-05** — Création d'un journal `docs/ia/CHANGES_SHARED.md` : toute modif touchant un fichier partagé ou le périmètre de l'autre poste y est déclarée AVANT push. On n'ajoute qu'en bas, on pull avant d'écrire.

## Vérifications

Testé en sandbox (isolée, OK) :

- [x] Migration `role` : base neuve + base existante (backfill Gabriel)
- [x] Login renvoie `role` (admin et membre)
- [x] `require_role` : admin 200, chef 200, membre 403
- [x] Migration `chef_id` sur projects
- [x] Désignation chef (admin 200, membre non-admin 403)
- [x] Filtrage difficultés : chef voit son projet, 403 sur projet d'un autre chef
- [x] Compilation JSX de App.jsx (Babel)

À vérifier sur la machine de Darelle (production locale Docker) :

- [x] Login admin en réel (fait pendant la session)
- [ ] Colonne `chef_id` présente après `docker compose up --build`
- [ ] Désignation d'un chef via `PUT /api/projects/<id>/chef`
- [ ] Filtrage des difficultés en réel (chef A ne voit pas projet B)
- [ ] Cloche visible pour un chef dans le navigateur

## Bugs / points ouverts

- **B-open-1** — Les routes CRUD de `projects.py` (poste A) ne sont protégées par AUCUNE auth. À sécuriser par Josué.
- **B-open-2** — Le système « lu/non-lu » des difficultés est 100% côté client (localStorage) : perdu au changement de navigateur/appareil, non lié au compte.
- **B-open-3** — Pas d'interface (bouton) pour désigner un chef : la route existe mais `ProjectsView.jsx` (poste A) n'a pas le bouton. À coordonner avec Josué.
- **B-open-4** — Mots de passe en SHA-256 sans sel (hérité). Acceptable usage interne, à renforcer un jour.

## Tâche suivante recommandée

Coordination avec Josué : ajouter le bouton « désigner un chef » dans ProjectsView,
et sécuriser les routes CRUD de projects.py. Puis attaquer le module Notifications
persistantes (remplacer le localStorage par une vraie table côté serveur).
