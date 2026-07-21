## 🤝 Conventions de travail à deux

Fichiers partagés : `docs/ia/INDEX.md`, `docs/ia/TODO.md`, `frontend/src/api/client.js`.

**Règles pour éviter les conflits Git :**

- `INDEX.md` : on n'AJOUTE qu'une ligne à la fin, on ne modifie JAMAIS une ligne existante.
  Préfixe `A-` = backend, `B-` = frontend.
- Toujours `git pull` avant d'ajouter sa ligne, et push juste après.
- `client.js` (contrat API) est sous la responsabilité du poste B. Le poste A
  ne le modifie pas : il signale tout changement d'endpoint dans son rapport de session.
- Décisions `D-xx` : numérotées en continu, communes aux deux postes.
- Chacun sur sa branche : `feat/backend-A`, `feat/frontend-B`. Merge dans `main` par PR.

# ⚡ AGT TaskFlow

Outil de gestion de tâches avec diagrammes Gantt et PERT, conçu pour des équipes projet travaillant sur plusieurs projets simultanément.

---

## 📋 Fonctionnalités

| Vue           | Description                                                                      |
| ------------- | -------------------------------------------------------------------------------- |
| **Tâches**    | Vue groupée Projet → Activité → Tâche. Chemin critique mis en évidence en rouge. |
| **Gantt**     | Timeline en coupons, barres colorées par responsable, flèches de dépendances.    |
| **PERT**      | Nœuds ES/EF/LS/LF avec calcul automatique du chemin critique.                    |
| **Projets**   | CRUD complet des projets.                                                        |
| **Activités** | CRUD complet des activités, rattachées à un projet.                              |
| **Équipe**    | Ajout/retrait des membres de l'équipe.                                           |

---

## 🚀 Lancement rapide (Docker — recommandé)

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et lancé

### Étapes

```bash
# 1. Cloner / décompresser le projet
cd agt-taskflow

# 2. Lancer tout le stack en une commande
docker compose up --build

# 3. Ouvrir dans le navigateur
# Frontend : http://localhost:4000
# API      : http://localhost:4001/api/tasks/

# 🌐 Accès depuis le réseau local (collègues sur le même WiFi) :
# Trouve ton IP locale avec : ipconfig (Windows) ou ifconfig/ip a (Linux/Mac)
# Exemple : http://192.168.1.42:4000
```

### Arrêter

```bash
docker compose down
```

### Supprimer la base de données (reset complet)

```bash
docker compose down -v
```

---

## 🛠 Développement local (sans Docker)

### Backend (Flask)

```bash
cd backend

# Créer un environnement virtuel
python -m venv .venv
source .venv/bin/activate      # macOS/Linux
.venv\Scripts\activate         # Windows

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
python app.py
# → http://localhost:5000
```

### Frontend (React + Vite)

```bash
cd frontend

# Installer les dépendances
npm install

# Lancer en mode dev (proxy vers backend local)
npm run dev
# → http://localhost:4000
```

> En mode dev, le proxy Vite redirige `/api` vers `http://localhost:4001`.

---

## 🗂 Structure du projet

```
agt-taskflow/
├── docker-compose.yml
├── backend/
│   ├── app.py              # Point d'entrée Flask
│   ├── database.py         # Init SQLite + helpers
│   ├── requirements.txt
│   ├── Dockerfile
│   └── routes/
│       ├── tasks.py
│       ├── projects.py
│       ├── activities.py
│       └── members.py
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx             # Shell principal
        ├── main.jsx
        ├── index.css           # Thème clair (variables CSS)
        ├── api/client.js       # Toutes les requêtes API
        ├── hooks/useData.js    # État global
        ├── utils/pert.js       # Calcul PERT
        └── components/
            ├── shared/         # Badges, FilterBar
            ├── tasks/          # TasksView, TaskModal
            ├── gantt/          # GanttView
            ├── pert/           # PERTView
            ├── projects/       # ProjectsView
            ├── activities/     # ActivitiesView
            └── team/           # TeamView
```

---

## 📡 API REST

| Méthode | Endpoint               | Description             |
| ------- | ---------------------- | ----------------------- |
| GET     | `/api/tasks/`          | Liste toutes les tâches |
| POST    | `/api/tasks/`          | Créer une tâche         |
| PUT     | `/api/tasks/<id>`      | Modifier une tâche      |
| DELETE  | `/api/tasks/<id>`      | Supprimer une tâche     |
| GET     | `/api/projects/`       | Liste des projets       |
| POST    | `/api/projects/`       | Créer un projet         |
| PUT     | `/api/projects/<id>`   | Modifier un projet      |
| DELETE  | `/api/projects/<id>`   | Supprimer un projet     |
| GET     | `/api/activities/`     | Liste des activités     |
| POST    | `/api/activities/`     | Créer une activité      |
| PUT     | `/api/activities/<id>` | Modifier une activité   |
| DELETE  | `/api/activities/<id>` | Supprimer une activité  |
| GET     | `/api/members/`        | Liste des membres       |
| POST    | `/api/members/`        | Ajouter un membre       |
| DELETE  | `/api/members/<id>`    | Retirer un membre       |

---

## 💡 Workflow quotidien suggéré

1. **Matin** : ouvrir l'onglet **PERT** filtré par projet
2. Identifier les tâches critiques (marge = 0, bordure rouge)
3. Assigner via le formulaire en fonction des disponibilités
4. **Gantt** se met à jour automatiquement
5. En cours de journée : mettre à jour les statuts directement dans la vue **Tâches**

---

## 🔧 Configuration

| Variable  | Défaut        | Description              |
| --------- | ------------- | ------------------------ |
| `DB_PATH` | `taskflow.db` | Chemin de la base SQLite |

Modifiable dans `docker-compose.yml` sous `environment`.


### Clear BD

## Avant de lancer : si tu veux pouvoir revenir en arrière, fais d'abord un dump de sécurité :
sudo cp /var/lib/docker/volumes/agt-taskflow20_db_data/_data/taskflow.db taskflow_dump.db
# ou
docker compose exec backend sh -c 'sqlite3 $DB_PATH .dump' > backup_avant_reset.sql

# 1. Copier le script dans le container backend
docker compose cp reset_db_keep_admin.py backend:/app/reset_db_keep_admin.py

# 2. L'exécuter à l'intérieur du container (là où DB_PATH pointe vers la vraie base)
docker compose exec backend python3 reset_db_keep_admin.py
