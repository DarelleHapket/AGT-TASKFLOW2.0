BILAN — Session A-01 | Poste A — Josué
Date : 16 juillet 2026 | Projet : AGT TaskFlow

1. État du périmètre
🗂 Projets

CRUD complet opérationnel (back + front)
Schéma DB : id, name, description, created_at
Frontend (ProjectsView.jsx) : formulaire nom + description, liste avec édition inline

🔖 Activités

CRUD complet opérationnel, liées à un projet
Contrainte UNIQUE(name, project_id) présente en DB
Frontend (ActivitiesView.jsx) : filtre par projet, formulaire inline

✅ Tâches

CRUD de base + archivage implémentés
Schéma DB actuel (dump) : id, project_id, activity_id, description, duration, responsible, status, created_at, completed_at
⚠️ Problème détecté : le frontend référence des champs absents du schéma du dump :

is_archived — utilisé dans App.jsx (filtre show_archived)
start_date, end_date, due_date — utilisés dans les filtres temporels
priority — utilisé dans FilterBar et TaskModal


Ces champs sont peut-être ajoutés par des migrations dans database.py (non visibles dans le dump) — à confirmer

📊 PERT

Calcul ES / EF / LS / LF + marge totale entièrement côté frontend (utils/pert.js)
PERTView.jsx (334 lignes) : mode normal + vue comparée jour par jour
Table task_dependencies présente en DB avec 43 enregistrements

📅 Gantt

GanttView.jsx (255 lignes) : timeline en coupons (1 coupon = 3 h)
Barres colorées par responsable, chemin critique en rouge


2. ⚠️ Lacune prioritaire
Le schéma BDD vu dans le dump ne contient pas is_archived, start_date, end_date, due_date, priority, alors que le frontend les utilise activement. Deux possibilités :

Ces champs sont ajoutés dynamiquement par database.py via des ALTER TABLE → le dump est simplement antérieur aux migrations
Ces champs sont absents → fonctionnalités cassées en production

À valider en priorité avant tout développement.

3. Tâches recommandées (à toi de choisir)
OptionDescriptionRisqueA — Audit & stabilisationLire database.py + routes/tasks.py sur ta machine pour confirmer l'état réel des champs. Faire la migration + backend si manquants.Faible — fondationB — Nouvelle fonctionnalitéSi le backend est déjà correct sur ta machine, attaquer une feature du CDC (chemin critique Gantt, PERT backend, filtres avancés…)Moyen — dépend de AC — Initialisation du TODO.md