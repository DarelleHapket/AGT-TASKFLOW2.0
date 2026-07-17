# Rapport de session A-03 — AGT TaskFlow
**Poste :** A — Josué  
**Date :** 17 juillet 2026  
**Durée estimée :** ~2 coupons  
**Dernière décision de la session précédente :** D-05

---

## Tâches traitées

### 1. Étape 2.3 — Branchement frontend sur PERT backend
`frontend/src/hooks/useData.js` modifié :
- Import `computePERT` supprimé
- Helper local `buildPertFromTasks(tasks, cycleIds)` créé : reconstruit `{ES, EF, LS, LF, slack, end, cycles}` depuis les champs `es/ef/ls/lf/slack` embarqués dans chaque tâche (format D-05)
- `pert` migré de dérivée réactive vers état explicite (`useState`)
- Parse du double format D-05 : tableau plat (pas de cycle) ou `{tasks, pert_cycle_ids}` (cycle détecté)
- `GanttView.jsx` et `PERTView.jsx` : aucune modification nécessaire — les modes semaine/jour continuent d'appeler `computePERT()` localement sur les sous-ensembles filtrés

**Vérification :** commandes fournies, résultats non encore confirmés par le dev.

---

### 2. Audit UI/UX — identification de 8 bugs

Audit complet de `TaskModal.jsx`, `useAuth.js`, `TasksView.jsx`, `ProjectsView.jsx`, `ActivitiesView.jsx`, `TeamView.jsx`.

| ID | Gravité | Description |
|---|---|---|
| B-03 | 🔴 Bloquant | Chef voit MemberModal (lecture) au lieu du formulaire éditable |
| B-04 | 🔴 Bloquant | `isChef` non transmis depuis `App.jsx` vers `TaskModal` |
| B-05 | 🟠 Haute | `ActivitiesView` : boutons CRUD visibles pour tous les rôles |
| B-06 | 🟠 Haute | `ProjectsView` : boutons CRUD visibles pour tous les rôles |
| B-07 | 🟠 Haute | `TeamView` : formulaire ajout visible + 🗑️ non restreint |
| B-08 | 🟡 Moyenne | "Nouvelle tâche" visible pour Membre |
| B-09 | 🟡 Moyenne | `disabled` HTML manquant sur bouton "Enregistrer" |
| B-10 | 🟡 Moyenne | Comparaison `member_id` stricte pouvant échouer (int vs string) |

---

### 3. Corrections bugs UI/UX — Lot 1 + Lot 2

**Lot 1 — Bloquants :**
- `TaskModal.jsx` (B-03, B-09, B-10) : routage à 3 cas (Membre → MemberModal, Admin → AdminModal, Chef → formulaire éditable), `disabled={!valid}` sur Enregistrer, `String()` cast sur `member_id`
- `App.jsx` ⚠️ TRANSVERSAL (B-04) : `isChef={isChef}` ajouté sur `<TaskModal>`, `<TasksView>`, `<ProjectsView>`, `<ActivitiesView>` ; `currentUser={user}` ajouté sur `<ProjectsView>`

**Lot 2 — Hautes et moyennes :**
- `TasksView.jsx` (B-08) : "Nouvelle tâche" + archive/suppression → `isChef` uniquement
- `ActivitiesView.jsx` (B-05) : boutons CRUD masqués si `!isChef`
- `ProjectsView.jsx` (B-06) : boutons CRUD masqués si `!isChef`
- `TeamView.jsx` (B-07) : formulaire ajout supprimé (création via compte, Poste B), 🗑️ réservé à l'admin

---

### 4. Bugs backend projets — chef_id et ownership

Deux bugs constatés lors des tests :

**Bug 1 — chef_id non stocké à la création :** `POST /api/projects/` n'insérait pas `chef_id`. Corrigé dans `projects.py` : `INSERT INTO projects (name, description, chef_id) VALUES (?, ?, current_user["id"])`.

**Bug 2 — absence de garde ownership :** `PUT` et `DELETE` acceptaient n'importe quel chef. Corrigé : helper `_is_owner(project, current_user)` ajouté, garde 403 sur PUT et DELETE si `project.chef_id != current_user.id`.

---

### 5. Vue admin refaite — AdminModal (directeur)

`TaskModal.jsx` : nouveau composant `AdminModal` remplaçant le formulaire grisé par une fiche de pilotage orientée superviseur :
- Ligne métriques : statut · priorité · durée · marge (couleur selon criticité)
- Contexte : projet · activité · responsable (avec initiale)
- Calendrier : début · fin prévue · deadline (rouge si dépassée)
- PERT : ES/EF/LS/LF + badge "Sur le chemin critique" si marge = 0
- Signalements : bandeau warning si difficultés > 0

---

### 6. Utilitaire set_role.py

Script Python créé pour modifier directement le rôle d'un utilisateur en BD SQLite (pour tests sans attendre le Poste B). Inspecte le schéma avant toute modification, affiche état avant/après, valide les rôles acceptés.

---

## Fichiers touchés

| Fichier | Statut | Nature |
|---|---|---|
| `frontend/src/hooks/useData.js` | ⚠️ TRANSVERSAL | Étape 2.3 : PERT depuis backend |
| `frontend/src/App.jsx` | ⚠️ TRANSVERSAL | B-04 : props isChef + currentUser ajoutés |
| `frontend/src/components/tasks/TaskModal.jsx` | Périmètre A | B-03/09/10 + AdminModal |
| `frontend/src/components/tasks/TasksView.jsx` | Périmètre A | B-08 |
| `frontend/src/components/projects/ProjectsView.jsx` | Périmètre A | B-06 + ownership |
| `frontend/src/components/activities/ActivitiesView.jsx` | Périmètre A | B-05 |
| `frontend/src/components/team/TeamView.jsx` | Périmètre A | B-07 |
| `backend/routes/projects.py` | Périmètre A | chef_id POST + ownership PUT/DELETE |
| `tools/set_role.py` | Nouveau | Utilitaire test rôles |

---

## Décisions (continuation depuis D-05)

**D-06** — Limitation PERT post-mutation : après `setTasks()` local (créer/modifier/supprimer), `pert` reste figé à la dernière valeur backend jusqu'au prochain `reload()`. Acceptable V1. Correction propre : appeler `reload()` après chaque mutation dans `App.jsx` — différée à A-04.

**D-07** — Vue admin sur tâche = `AdminModal` (fiche directeur). Pas de formulaire, pas de champs désactivés. Contenu : statut, priorité, durée, marge, contexte, calendrier, PERT, count signalements.

**D-08** — Ownership projets : le chef qui crée un projet en devient automatiquement `chef_id`. Seul ce chef peut modifier ou supprimer son projet (403 sinon). Guard frontend (ownership) + backend (is_owner).

---

## Bugs ouverts en fin de session

| ID | Fichier | Description | Statut |
|---|---|---|---|
| B-02 | `App.jsx` ⚠️ | Cloche `<Bell>` affichée si `isAdmin=true` (devrait être `!isAdmin`) | 🔴 Poste B |

Bugs B-03 à B-10 : tous fermés en A-03.

---

## Vérifications en attente

Les commandes de test ont été fournies pour :
- Étape 2.3 (`useData.js`) — résultats non confirmés
- Bugs UI/UX (B-03 à B-10) — tests visuels partiels
- `projects.py` ownership — curl tests fournis, non confirmés

À valider en début de A-04 si nécessaire.

---

## Tâche suivante recommandée (A-04)

1. **Étape 3.1** — `is_chef_of_project()` + guards `tasks.py` (POST/PUT/DELETE/archive)
2. **Étape 6.1** — Guard `is_chef_of_project()` dans `activities.py`
3. **Étape 2.2** — `PERT_CONTRACT.md` (rapide, débloque Darelle)
4. **D-06** — `reload()` post-mutation dans `App.jsx`

---

## Changements transversaux à transmettre au Poste B

Voir `docs/ia/CHANGES_SHARED_to_B.md` — deux entrées ajoutées ce jour :
- `useData.js` : `computePERT` retiré, `pert` issu du backend
- `App.jsx` : nouvelles props sur plusieurs composants (isChef, currentUser)
