# ⚡ AGT ERP (ex-AGT TaskFlow)

ERP interne AG Technologies : projets/activités/tâches avec Gantt et PERT (chemin
critique), RH & profils, finances, matériel, rôles et permissions (RBAC + IBAC).

Documentation complète : [`docs/GUIDE_PROJET.md`](docs/GUIDE_PROJET.md) (état du
cahier des charges par module, accès, comptes de test) et
[`docs/GUIDE_FONCTIONNEL.md`](docs/GUIDE_FONCTIONNEL.md) (comment utiliser chaque
module). Ce README est un point d'entrée rapide, pas la référence complète.

---

## 📋 Fonctionnalités

| Module | Description |
| --- | --- |
| **Tâches** | Vue Liste (groupée Projet → Activité) ou Tableau (kanban par membre). |
| **Gantt / PERT** | Timeline en coupons + diagramme réseau (chemin critique, marges ES/EF/LS/LF), toggle entre les deux vues. |
| **Projets / Activités** | CRUD complet, rôles par projet (owner/manager/contributor). |
| **RH & Profils** | Employés, contrats, rémunérations, disponibilité, recrutement, formations, signalements, congés et notes de frais (espace salarié self-service). |
| **Finances** | Mouvements immuables, lien automatique salaire → finances, bilan, prévisions, rapports PDF/TXT. |
| **Matériel** | Types, inventaire, stock agrégé, mouvements (achat/affectation/retour/rebut). |
| **Rôles & permissions** | Multi-rôle par utilisateur (RBAC), permissions accordées/retirées individuellement (IBAC), catalogue de rôles/permissions éditable. |
| **Mon compte** | Nom affiché, couleur d'avatar, mot de passe, fiche de paie PDF, historique de carrière. |

---

## 🚀 Lancement (Docker)

### Prérequis

- Docker + Docker Compose
- Un fichier `.env.django` à la racine (copier `.env.django.example` et remplir
  `SECRET_KEY`, `POSTGRES_PASSWORD`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`)

### Lancer

```bash
docker compose -f docker-compose.django.yml --env-file .env.django -p agt-django up -d --build
```

`-p agt-django` fixe le nom du projet Docker Compose — à toujours utiliser pour
retomber sur la même stack/volume (sans lui, Compose dérive un nom du dossier
courant et peut créer une base vide en double).

- Application : http://localhost:4100
- API + Swagger : http://localhost:8000/api/docs/

### Reconstruire après une modification

```bash
# backend
docker compose -f docker-compose.django.yml --env-file .env.django -p agt-django up -d --build api
# frontend
docker compose -f docker-compose.django.yml --env-file .env.django -p agt-django up -d --build web
```

Les migrations Django s'appliquent automatiquement au démarrage du conteneur `api`.

### Arrêter

```bash
docker compose -f docker-compose.django.yml --env-file .env.django -p agt-django down
```

---

## 🛠 Développement local (sans Docker)

```bash
# Terminal 1 — API Django (nécessite Postgres accessible)
cd backend_django
python3 manage.py runserver 8000

# Terminal 2 — Frontend Next.js
cd frontend_next
npm run dev
```

---

## 🗂 Structure du projet

```
AGT-TASKFLOW2.0/
├── docker-compose.django.yml
├── .env.django
├── backend_django/
│   ├── config/              # settings, urls racine
│   ├── authentification/    # Utilisateur, Role, Permission, RBAC+IBAC
│   ├── projets/             # Projets, Activités, Tâches, PERT
│   ├── rh/                  # Profils, employés, contrats, congés, notes de frais…
│   ├── finances/            # Mouvements, bilan, prévisions, rapports
│   ├── materiel/            # Types, inventaire, mouvements
│   ├── notifications/
│   ├── operations/          # Besoins, notes, ordre journalier
│   ├── pilotage_stage/      # Suivi interne du stage (ex-team-tool)
│   └── administration/      # Sauvegardes BD
└── frontend_next/
    └── src/
        ├── app/              # Routes Next.js (App Router)
        ├── components/       # Vues par module
        └── lib/              # api.ts (client HTTP), auth.tsx, pert.ts, types.ts
```

---

## 📡 API

Toute l'API REST (Django REST Framework) est documentée automatiquement via
Swagger/Redoc — pas de table d'endpoints maintenue à la main ici :

| Lien | Contenu |
| --- | --- |
| `/api/docs/` | Swagger UI interactif |
| `/api/redoc/` | Redoc, lecture seule |
| `/api/schema/` | Schéma OpenAPI brut (JSON) |

---

## 🔧 Configuration

Variables d'environnement dans `.env.django` (voir `.env.django.example`) :
`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD`,
`SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` (compte superadmin auto-créé au premier
démarrage), `BACKUP_DIR`.

---

## 📚 Pour aller plus loin

- [`docs/GUIDE_PROJET.md`](docs/GUIDE_PROJET.md) — état du cahier des charges par
  module, comptes de test, dernier tour de travail.
- [`docs/GUIDE_FONCTIONNEL.md`](docs/GUIDE_FONCTIONNEL.md) — comment utiliser
  chaque module, réponses aux questions fréquentes.
- [`docs/BASCULE_PRODUCTION.md`](docs/BASCULE_PRODUCTION.md) — runbook de mise en
  production.
- `documents/` — cahier des charges global (PDF) + documents d'analyse et de
  conception par module (les `.md` corrigent/complètent les PDF correspondants,
  ils font foi en cas de divergence).
