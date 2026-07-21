# Session A-06 — 21 juillet 2026

**Poste :** A — Josué  
**Périmètre :** Tâches · PERT · Gantt · Projets · Activités + Notifications (étendu cette session)

---

## Tâches traitées

### 1. Fix `ProjectsView` — boutons ✏️/🗑️ invisibles pour le chef propriétaire

**Cause :** `currentUser` n'était pas transmis à `<ProjectsView>` dans `App.jsx`. La condition `isOwner` dans `ProjectRow` comparait `project.chef_id` à `Number(undefined?.id)` = `NaN` → toujours `false`.

**Correction :** ajout de `currentUser={user}` sur le rendu de `<ProjectsView>` dans `App.jsx`.

**Fichiers :** `frontend/src/App.jsx` ⚠️ transversal

---

### 2. Fix `delete_project` backend — `database is locked` (500)

**Cause :** variable `old_chef` utilisée dans `_demote_if_orphan(conn, old_chef)` sans être définie dans `delete_project()` (présente dans `set_project_chef()` mais oubliée dans `delete_project()`). Le `NameError` faisait crasher la fonction sans fermer la connexion → SQLite `database is locked` sur la requête suivante.

**Correction :** ajout de `old_chef = dict(project).get("chef_id")` avant le `DELETE`.

**Fichiers :** `backend/routes/projects.py`

---

### 3. Fix cloche — badge ne se mettait pas à jour à la lecture

**Cause :** `markAsSeen(tid, count)` n'était jamais appelé dans le `onClick` des items de difficultés dans la cloche.

**Correction :** ajout de `markAsSeen(tid, count)` dans le handler de clic.

**Fichiers :** `frontend/src/App.jsx` ⚠️ transversal

---

### 4. Système de notifications persistant — Option B (backend)

**Décision D-20 :** notifications stockées en base de données (table `notifications`), purge automatique à 7 jours, visible pour tous les utilisateurs connectés.

**3 déclencheurs :**
- `POST /auth/register` → notifie tous les admins actifs (`register_request`)
- `POST /tasks/` (si `responsible` défini) → notifie le responsable (`task_assigned`)
- `POST /difficulties/` (si tâche liée à un projet avec chef) → notifie le chef (`difficulty_reported`)

**Nouveaux fichiers :**
- `backend/utils/notif.py` — helper `notify()` réutilisable
- `backend/routes/notifications.py` — `GET /`, `PATCH /<id>/read`, `PATCH /read-all`

**Fichiers modifiés :**
- `backend/database.py` ⚠️ — `CREATE TABLE IF NOT EXISTS notifications`
- `backend/routes/tasks.py` — inject `notify()` dans `create_task()`
- `backend/routes/auth.py` ⚠️ périmètre Darelle — inject `notify()` dans `register()`
- `backend/routes/difficulties.py` ⚠️ périmètre Darelle — inject `notify()` dans `create_difficulty()`
- `backend/app.py` — `register_blueprint(notifications_bp)`
- `frontend/src/api/client.js` ⚠️ transversal — `getNotifications()`, `markNotificationRead()`, `markAllNotificationsRead()`
- `frontend/src/App.jsx` ⚠️ transversal — refonte complète de la cloche

**Note :** `useSeenAssignments.js` a été créé en cours de session (Option A frontend-only) puis abandonné au profit de l'Option B. Le fichier peut être supprimé s'il a été déployé.

---

### 5. Fix navigation — clic sur `register_request` ne naviguait pas vers "Équipe"

**Cause :** `handleNotifClick` ne gérait que `notif.task_id` (navigation tâche), pas le type `register_request`.

**Correction :** ajout d'un `if (notif.type === "register_request") setTab("team")` avant la vérification `task_id`.

**Fichiers :** `frontend/src/App.jsx` ⚠️ transversal

---

### 6. NotificationsPanel — panneau plein écran slide-in

**Décision D-21 :** panneau slide-in depuis la droite (Option B), déclenché par "Voir toutes mes notifications →" dans le dropdown de la cloche. Pas de nouvel onglet dans la navigation.

**Contenu du panneau :**
- Filtres par type : Toutes / 📋 Affectations / ⚠️ Difficultés / 👤 Demandes
- Groupement par jour : Aujourd'hui / Hier / Cette semaine
- Badge "Nouveau" + fond coloré pour les non lues
- Indicateur point bleu à droite
- "Tout lire" en header
- Fermeture sur Échap ou clic overlay
- État vide illustré

**Nouveau fichier :** `frontend/src/components/notifications/NotificationsPanel.jsx`

---

## Fichiers touchés (session A-06)

| Fichier | Nature |
|---|---|
| `frontend/src/App.jsx` ⚠️ | Fix currentUser ProjectsView, fix markAsSeen, refonte cloche, NotificationsPanel |
| `frontend/src/api/client.js` ⚠️ | 3 fonctions notifications ajoutées |
| `frontend/src/components/notifications/NotificationsPanel.jsx` | Nouveau — panneau slide-in |
| `frontend/src/hooks/useSeenAssignments.js` | Nouveau puis abandonné — à supprimer |
| `backend/utils/notif.py` | Nouveau — helper notify() |
| `backend/routes/notifications.py` | Nouveau — blueprint notifications |
| `backend/database.py` ⚠️ | Table notifications |
| `backend/routes/tasks.py` | inject notify() dans create_task() |
| `backend/routes/auth.py` ⚠️ périmètre Darelle | inject notify() dans register() |
| `backend/routes/difficulties.py` ⚠️ périmètre Darelle | inject notify() dans create_difficulty() |
| `backend/app.py` | register_blueprint notifications_bp |
| `backend/routes/projects.py` | Fix old_chef NameError dans delete_project() |

---

## Décisions

- **D-20** : Notifications persistantes en base (`notifications` table, 7 jours glissants). 3 déclencheurs : register, task assignée, difficulté signalée. Cloche visible pour tous les utilisateurs connectés.
- **D-21** : Panneau plein écran `NotificationsPanel` (slide-in droite) accessible via "Voir toutes mes notifications →" dans le dropdown cloche. Pas de nouvel onglet nav.

---

## Changements transversaux à transmettre au Poste B

**Résumé pour Darelle :**

- `database.py` : table `notifications` ajoutée (migration `CREATE TABLE IF NOT EXISTS` — non destructive).
- `client.js` : 3 fonctions ajoutées en fin de fichier (`getNotifications`, `markNotificationRead`, `markAllNotificationsRead`) — aucune signature existante modifiée.
- `App.jsx` : refonte de la cloche (badge unifié, NotificationsPanel), `currentUser={user}` ajouté sur ProjectsView.
- `auth.py` ⚠️ : `notify()` injecté dans `register()` pour notifier les admins. Bloc `try` restructuré — à relire si tu as modifié ce fichier depuis B-01.
- `difficulties.py` ⚠️ : `notify()` injecté dans `create_difficulty()` après le `conn.commit()` — à relire si tu as modifié ce fichier depuis A-05.

---

## Bugs

| ID | Statut |
|---|---|
| Fix ProjectsView currentUser | ✅ Fermé (A-06) |
| Fix delete_project old_chef NameError | ✅ Fermé (A-06) |
| Fix cloche markAsSeen non appelé | ✅ Fermé (A-06) |
| Fix register_request → navigation team | ✅ Fermé (A-06) |

---

## Tâche suivante recommandée

**A-07 : Révision de la logique métier ERP**

Décidé par l'utilisateur en clôture de session A-06 : la logique actuelle ne cadre pas bien avec le management d'un projet concret. Périmètre à définir en début de session A-07 — probable audit des flux métier (projets → activités → tâches → responsables) avant toute modification.

Reste également en attente :
```
Étape 2.2 — PERT_CONTRACT.md (reporté depuis A-02)
Étape 4   — Gantt : flèches de dépendances, filtres membre/projet
Étape 7   — Vérifier show_critical / show_overdue côté frontend
Étape 8.2 — Mesure perf PERT (< 100 ms / 100 tâches)
```
