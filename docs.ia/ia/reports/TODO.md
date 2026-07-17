# TODO — AGT TaskFlow (Poste B — Darelle)

Périmètre : Auth, Rôles, Difficultés, Notifications, Rapports, modules P2.

## Auth & Rôles

- [x] Colonne `role` + RBAC 3 rôles (admin/chef_projet/membre)
- [x] Décorateur `require_role`
- [x] `role` dans token + login + /me
- [x] Helpers front `isChef` / `isMembre`
- [ ] register / demande de compte + validation admin (pas encore fait)

## Chef de projet

- [x] Colonne `projects.chef_id`
- [x] Route `PUT /api/projects/<id>/chef` (admin)
- [ ] Bouton « désigner un chef » dans ProjectsView (coord. Josué)
- [ ] Rétrogradation auto en membre si plus aucun projet (règle fine)

## Difficultés

- [x] Filtrage backend par projet du chef
- [x] Cloche ouverte au chef (App.jsx)
- [ ] Sécuriser routes CRUD projects.py (Josué)

## Notifications

- [ ] Remplacer le lu/non-lu localStorage par une table serveur

## Modules à auditer (pas encore ouverts)

- [ ] Rapports (reports.py + ReportsView)
- [ ] Ma Journée (daily_order)
- [ ] Besoins (needs)
- [ ] Notes (notes)
- [ ] Performances (performance)
