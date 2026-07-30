# TODO — Poste B (Darelle)

## Module 1 — RBAC (S1)

- [x] Analyse : acteurs, use case, classes métier, packages
- [x] Conception : états/transitions, activités, architecture
- [x] Document d'analyse LaTeX
- [x] Document de conception LaTeX
- [x] Backend : tables roles/permissions/member_roles/member_permissions
- [x] Backend : endpoints /api/rbac/*
- [x] Backend : rôle effectif superadmin dans /login et /me
- [x] Frontend : RBACView.jsx (écran gestion rôles/permissions)
- [x] Frontend : onglet "Rôles" dans sidebar (superadmin uniquement)
- [x] Frontend : sidebar réorganisée (logique métier)
- [ ] Documentation Markdown des endpoints RBAC
- [ ] Tests supplémentaires (assignation multiple, cas limites)
- [ ] Déploiement sur task.ag-technologies.tech
- [ ] Démonstration à Gabriel (vendredi S1)

## Bugs

- [x] B01 — Reconnexion forcée après promotion chef
- [x] B02/B04 — Création de tâches en masse
- [ ] B03 — Ajout membre sur projet : option "tous"
- [ ] B05 — PERT badge notification ne disparaît pas
- [ ] B08 — Activités sans valeurs par défaut
- [ ] B09 — Notes disparaissent au changement d'onglet
- [ ] B10 — Label "Demander un compte" → "Créer un compte"
- [ ] B06 — Admin RBAC trop restrictif (à revalider après Module 1)
- [ ] B11 — Faille compte supprimé (déjà géré par Josué via deleted_at — à vérifier)

## Module 2 — Matériel (S2, pas commencé)

- [ ] Conception schéma DB
- [ ] CRUD TypeMatériel + Matériel
- [ ] Journal des mouvements irréversibles

## Divers

- [ ] Export/Import base SQLite (BF-38)
- [ ] Documentation Swagger/Markdown des endpoints (décidé : Markdown simple)
