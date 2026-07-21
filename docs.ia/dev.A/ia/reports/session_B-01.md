# Session B-01 — Auth/Rôles + Difficultés + Rapports + Ma Journée + Notes

**Poste :** B (Darelle)
**Date :** 2026-07-18 → 2026-07-21
**Branche :** feat/darelle-B

## Note

Grosse session fondatrice regroupant tout le périmètre B traité jusqu'ici.
Numérotation des décisions reprise à D-13 (Josué occupe D-01→D-12).

## Tâches traitées

1. Socle RBAC 3 rôles (admin / chef_projet / membre) — confirmé et complété.
2. Difficultés : filtrage backend par projet du chef.
3. Rapports : correction bug dates, filtrage par rôle, rapport par projet, export TXT + PDF (jspdf).
4. Ma Journée : rendue personnelle (le membre gère la sienne) + plages horaires + surlignage temps réel EN COURS/DÉPASSÉ.
5. Notes : ajout auth + auteur (member_id), lecture publique, modification réservée à l'auteur.

## Fichiers touchés

| Fichier                                          | Périmètre | Nature                                                                    |
| ------------------------------------------------ | --------- | ------------------------------------------------------------------------- |
| backend/database.py                              | partagé   | migrations B4 : daily_task_order.start_time/duration_min, notes.member_id |
| backend/routes/reports.py                        | B         | bug dates (timedelta), filtrage rôle, endpoint /project/                  |
| backend/routes/difficulties.py                   | B         | filtrage par projet du chef (can_access_task)                             |
| backend/routes/daily_order.py                    | B         | droits membre (journée personnelle) + horaires                            |
| backend/routes/notes.py                          | B         | @require_auth, auteur, droits de modification                             |
| backend/routes/projects.py                       | A (Josué) | route PUT /<id>/chef ajoutée (déjà mergée côté A)                         |
| frontend/src/api/client.js                       | partagé   | getProjectReport                                                          |
| frontend/src/App.jsx                             | partagé   | props isChef/projects/user vers Reports, Daily, Notes                     |
| frontend/src/components/reports/ReportsView.jsx  | B         | mode projet, TXT+PDF, filtres fiables                                     |
| frontend/src/components/daily/DailyOrderView.jsx | B         | gestion perso + horaires + surlignage                                     |
| frontend/src/components/notes/NotesView.jsx      | B         | auteur affiché + lecture seule sur notes des autres                       |

## Décisions numérotées

- **D-13** — Rapports : autorisation d'accès CÔTÉ BACKEND. admin = tout ; chef = membres/projets dont il est chef ; membre = lui-même.
- **D-14** — Rapport par projet réservé à admin + chef (chef limité à ses projets). Membre exclu (403).
- **D-15** — Export rapports en 2 formats : TXT et PDF (dépendance frontend `jspdf`).
- **D-16** — Difficultés filtrées par projet du chef (un chef ne voit que les difficultés des tâches de ses projets).
- **D-17** — Ma Journée est PERSONNELLE : chaque membre gère la sienne. Admin/chef en lecture seule.
- **D-18** — Ma Journée : ajout plages horaires (start_time, duration_min). Surlignage temps réel côté client uniquement, PAS de notification push (choix assumé pour rester léger).
- **D-19** — Notes = interprétation 2 : lecture publique à toute l'équipe, modification/suppression réservées à l'auteur (member_id). Auth obligatoire (faille d'accès anonyme corrigée).

## Bugs / points ouverts

- **B-open-1** — Notes existantes avant migration ont member_id NULL → modifiables par tous (choix : ne pas bloquer les anciennes).
- **B-open-2** — Tâches sans projet (project_id NULL) invisibles pour les chefs (seul l'admin les voit). Validation à ajouter côté création de tâche (périmètre A).
- **B-open-3** — Dépendance jspdf ajoutée : Josué doit faire `npm install` après pull.
- **B-open-4** — Mots de passe SHA-256 sans sel (hérité).

## Tâche suivante recommandée

Finaliser les modules P2 restants (Besoins, Performances) et coordonner avec Josué
la validation d'un projet obligatoire à la création d'une tâche (B-open-2).
