# JOURNAL DES CHANGEMENTS PARTAGÉS — AGT TaskFlow

Toute modification qui touche un fichier PARTAGÉ ou le périmètre de l'équipe B
DOIT être déclarée ici AVANT le push. On n'ajoute qu'en bas. On ne modifie jamais
une entrée existante. On fait `git pull` avant d'écrire.

Fichiers considérés comme partagés / transversaux :

- backend/database.py (schéma commun)
- backend/utils/auth.py (auth & rôles)
- backend/app.py (enregistrement des blueprints)
- frontend/src/App.jsx (shell)
- frontend/src/hooks/useData.js (état global)
- frontend/src/api/client.js (contrat API)
- tout fichier appartenant au périmètre de l'autre poste

Format d'une entrée :

- Date · Poste (A/B) · Fichier(s) · Nature du changement · Impact pour l'autre · Action requise

---

## 2026-07-17 · Poste A · `frontend/src/hooks/useData.js`

**Nature :** Refactoring Étape 2.3 (D-05/D-06)

**Changements :**
- Import `computePERT` supprimé
- `pert` migré de dérivée réactive vers `useState`
- Nouveau helper local `buildPertFromTasks(tasks, cycleIds)` : reconstruit `{ES, EF, LS, LF, slack, end, cycles}` depuis les champs `es/ef/ls/lf/slack` embarqués dans chaque tâche
- Gestion du double format `GET /tasks/` : tableau plat (sans cycle) OU `{tasks, pert_cycle_ids}` (cycle détecté)
- `reload` toujours exporté (inchangé)

**Impact pour le Poste B :**
- `pert` a exactement la même forme qu'avant — aucun composant B ne devrait être cassé
- Si Darelle consomme `useData()` dans un de ses composants et en lit `pert`, aucune action requise
- Si Darelle appelle `computePERT` directement depuis `utils/pert.js`, c'est toujours possible — la fonction n'a pas été modifiée

**Action requise :** Aucune action immédiate. Informer Darelle du changement interne pour éviter une régression si elle modifie `useData.js` de son côté.

---

## 2026-07-17 · Poste A · `frontend/src/App.jsx`

**Nature :** Propagation des props de rôle (B-04 + B-06 + ownership projets)

**Changements (uniquement dans la section `{/* Contenu */}`) :**

```diff
- <TasksView ... isAdmin={isAdmin} />
+ <TasksView ... isAdmin={isAdmin} isChef={isChef} />

- <ProjectsView ... isAdmin={isAdmin} />
+ <ProjectsView ... isAdmin={isAdmin} isChef={isChef} currentUser={user} />

- <ActivitiesView ... isAdmin={isAdmin} />
+ <ActivitiesView ... isAdmin={isAdmin} isChef={isChef} />

- <TaskModal ... isAdmin={isAdmin} currentUser={user} />
+ <TaskModal ... isAdmin={isAdmin} isChef={isChef} currentUser={user} />

- <TeamView members={members} onAdd={onAddMember} onDelete={onDeleteMember} isAdmin={isAdmin} />
+ <TeamView members={members} onDelete={onDeleteMember} isAdmin={isAdmin} />
```

**Impact pour le Poste B :**
- `onAdd` retiré de `<TeamView>` (l'ajout de membre passe maintenant par création de compte — Poste B)
- `isChef` est maintenant disponible dans tous les composants principaux si Darelle en a besoin
- Aucune prop retirée sur les composants du périmètre B (NeedsView, NotesView, PerformanceView, ReportsView, DailyOrderView) — inchangés

**Action requise :**
1. Faire un `git pull` sur `feat/frontend-B` avant de toucher `App.jsx`
2. Si Darelle avait ajouté du code dans `App.jsx` entre A-02 et A-03, merger manuellement les changements ci-dessus
3. Vérifier que `TeamView` côté Poste B n'appelle pas `onAdd` (prop supprimée)

---

## 2026-07-17 · Poste A · `frontend/src/api/client.js`

**Nature :** Bugfix session (D-07) — ajout d'un intercepteur 401

**Changements :**
- Nouvelle fonction exportée : `setUnauthorizedHandler(handler)` — enregistre un callback appelé à chaque réponse `401` reçue par n'importe quel appel API (`req()` interne)
- **Aucune fonction existante n'a changé de signature** (`getTasks`, `createTask`, `loginUser`, etc. sont strictement identiques)

**Impact pour le Poste B :**
- Aucune régression attendue sur les appels API existants de Darelle
- Si Darelle gérait déjà les 401 manuellement quelque part (try/catch spécifique), son code continue de fonctionner ; `setUnauthorizedHandler` s'ajoute en complément, il ne remplace rien
- Utile à connaître si Darelle veut bénéficier du même mécanisme de déconnexion automatique dans ses propres vues (Auth, Notifications, Rapports)

**Action requise :** Aucune action immédiate. Simple information — le hook est disponible si utile côté Poste B.

---

## 2026-07-17 · Poste A · `frontend/src/hooks/useData.js`

**Nature :** Bugfix session (D-07) — chargement conditionné à l'authentification

**Changements :**
- `useData()` accepte désormais un paramètre `isLogged` (`export function useData(isLogged = true)`)
- Le chargement (`load()`) ne se déclenche que si `isLogged === true`
- Quand `isLogged` repasse à `false` (déconnexion, y compris automatique via 401), l'état est intégralement réinitialisé : `error = null`, `tasks = []`, `pert = PERT_EMPTY`
- Garde anti race-condition ajoutée (`load._activeToken`) : si une déconnexion survient pendant qu'un appel API est en vol, son résultat (succès ou erreur) est ignoré à son retour

**Impact pour le Poste B :**
- **Si Darelle appelle `useData()` sans argument** (valeur par défaut `true`), le comportement est inchangé par rapport à avant — rétrocompatible
- **Recommandé cependant** : si Darelle a son propre point d'entrée qui appelle `useData()`, il vaut mieux lui passer la vraie valeur d'authentification (`useData(isLogged)`) pour bénéficier du correctif de session
- La forme de retour du hook (`tasks`, `pert`, `reload`, etc.) est strictement identique

**Action requise :**
1. Vérifier si Darelle appelle `useData()` ailleurs que dans `App.jsx`
2. Si oui, lui recommander de passer `isLogged` en argument

---

## 2026-07-17 · Poste A · `frontend/src/App.jsx`

**Nature :** Bugfix session (D-07) + retrait de `isChef` sur `TasksView`/`TaskModal` (modèle de permissions D-09)

**Changements :**

```diff
+ useEffect(() => {
+   api.setUnauthorizedHandler(() => logout());
+ }, [logout]);

  const { tasks, setTasks, ... } = useData(
-   
+   isLogged
  );

+ const onStatusChange = async (id, status) => {
+   const t = await api.updateTask(id, { status });
+   setTasks((prev) => prev.map((x) => x.id === t.id ? t : x));
+ };

- <TasksView ... isAdmin={isAdmin} isChef={isChef} />
+ <TasksView ... onStatusChange={onStatusChange} isAdmin={isAdmin} currentUser={user} />

- <TaskModal ... isAdmin={isAdmin} isChef={isChef} currentUser={user} />
+ <TaskModal ... onStatusChange={onStatusChange} isAdmin={isAdmin} currentUser={user} />
```

**Impact pour le Poste B :**
- **Bugfix session** : aucun impact négatif attendu — corrige un bug bloquant (token invalide au 1er login + session expirée sans retour). Bénéficie à tout le monde, y compris aux vues du Poste B.
- **Retrait de `isChef`** sur `<TasksView>` et `<TaskModal>` : le modèle de permissions sur les tâches ne s'appuie plus sur le rôle global `isChef`, mais sur un champ `permission` calculé par tâche côté backend (`"full" | "status_only" | "read_only"`, voir D-09 dans `session_A-04.md`). Si Darelle lisait `isChef` depuis l'un de ces deux composants, il faudra migrer vers cette nouvelle logique.
- `isChef` reste disponible ailleurs dans `App.jsx` (toujours calculé par `useAuth()`) et continue d'être transmis à `ProjectsView` et `ActivitiesView`, inchangé.

**Action requise :**
1. Faire un `git pull` avant de toucher `App.jsx`
2. Vérifier si des composants du Poste B consomment `isChef` transmis via `TasksView`/`TaskModal` (peu probable, ces composants sont du périmètre A, mais à vérifier si Darelle a étendu l'un d'eux)
3. Prendre connaissance du nouveau modèle owner/chef/responsable (D-09) si des vues transversales (notifications, rapports) doivent refléter les mêmes règles d'accès sur les tâches
---

## 2026-07-21 · Poste A · `backend/database.py` ⚠️ FIX URGENT

**Nature :** Correction d'un bug bloquant introduit par la fusion manuelle entre mes changements A-04 et les tiens

**Problème rencontré :**
Après fusion de ma migration `activities.owner_id` (A-04) avec tes ajouts (`daily_task_order.start_time`/`duration_min`, `notes.member_id`), le fichier contenait :
- Une boucle `for table, column, sql in migrations_b1 + ... + migrations_b4:` **sans corps** (un commentaire suivait directement les deux-points) → `IndentationError` au démarrage du backend
- Le nom `migrations_b4` réutilisé deux fois pour deux listes de migrations différentes (les tiennes, puis les miennes)

**Correction appliquée :**
- Suppression de la boucle orpheline
- Renommage clarifié : **`migrations_b4` = tes migrations** (`daily_task_order`, `notes.member_id`), **`migrations_b5` = ma migration** (`activities.owner_id`)
- `migrations_b4` est rejouée après le `CREATE TABLE IF NOT EXISTS daily_task_order`, exactement comme c'était structuré dans ta version (car cette table est créée plus loin dans le fichier)
- Vérifié avec `python3 -m py_compile` avant livraison — plus d'erreur de syntaxe

**Impact pour toi :**
- Tes migrations (`daily_task_order.start_time`, `duration_min`, `notes.member_id`) sont **intactes et fonctionnelles**, simplement renommées en interne (`migrations_b4`)
- Aucune perte de données ni de logique de ta part

**Action requise :**
1. Relire le fichier avant ta prochaine session dessus, pour t'assurer que la structure te convient
2. À l'avenir, si on doit fusionner nos migrations manuellement, on peut se prévenir mutuellement pour éviter ce genre de collision de noms de variables

---

## 2026-07-21 · Poste A · `backend/database.py` — Migration Bloc 5

**Nature :** Ownership des activités (D-13)

**Changements :**
- Nouvelle migration (Bloc 5, non destructive) : `activities.owner_id INTEGER DEFAULT NULL REFERENCES members(id)`
- Pas de rattrapage automatique : les activités créées avant cette migration ont `owner_id = NULL`

**Impact pour toi :** Aucun — colonne additive, ne touche à rien de ton périmètre.

**Action requise :** Aucune.

---

## 2026-07-21 · Poste A · `backend/routes/difficulties.py` ⚠️ FICHIER HORS PÉRIMÈTRE POSTE A

**Nature :** Bugfix (D-14) — modifié avec l'accord explicite de l'utilisateur, car ce fichier est normalement de ton périmètre (Auth, Rôles, Difficultés, Notifications, Rapports, Modules)

**Problème rencontré :**
Un utilisateur avec le rôle global `chef_projet` (chef d'un autre projet), assigné comme `responsible` sur une tâche dont il n'était ni owner ni chef, recevait "Vous n'avez pas accès à cette tâche" en tentant de signaler une difficulté — alors que l'UI l'autorisait correctement à changer le statut de cette même tâche.

**Cause :** la fonction `can_access_task()` faisait un `if/elif` **exclusif** sur le rôle global de l'utilisateur (`admin` / `chef_projet` / `membre`). Un utilisateur au rôle `chef_projet` tombait dans la branche `chef_projet` et ne retombait jamais sur la vérification `responsible` si ce n'était pas son projet — cette logique ne connaissait pas le modèle owner/chef/responsable introduit en A-04 dans `tasks.py`.

**Correction appliquée :**

```diff
def can_access_task(conn, user, task):
-   role = _user_role(user)
-
-   if role == "admin":
-       return True
-
-   if role == "chef_projet":
-       project_id = task.get("project_id")
-       if not project_id:
-           return False
-       proj = conn.execute(
-           "SELECT chef_id FROM projects WHERE id=?", (project_id,)
-       ).fetchone()
-       return bool(proj) and proj["chef_id"] == user["id"]
-
-   # membre
-   return task.get("responsible") == user.get("name")
+   if user.get("is_admin"):
+       return True
+
+   project_id = task.get("project_id")
+   if project_id:
+       proj = conn.execute(
+           "SELECT chef_id FROM projects WHERE id=?", (project_id,)
+       ).fetchone()
+       if proj and proj["chef_id"] == user["id"]:
+           return True
+
+   if task.get("owner_id") is not None and task["owner_id"] == user["id"]:
+       return True
+
+   if task.get("responsible") == user.get("name"):
+       return True
+
+   return False
```

La fonction `_user_role()` n'est plus utilisée par `can_access_task()` (elle a été retirée du fichier) — je l'ai laissée de côté car elle ne semblait utilisée nulle part ailleurs dans ce fichier, mais **vérifie si tu t'en sers ou comptais t'en servir ailleurs** avant de considérer ce retrait comme définitif.

**Impact pour toi :**
- Le comportement pour un admin ou un chef légitime de son propre projet est **inchangé**
- Le comportement change **seulement** pour les cas qui étaient buggés (responsable non-chef-de-ce-projet) — c'est une correction, pas une régression attendue
- Si tu avais des tests ou une logique qui dépendait du comportement buggé, il faudra les ajuster

**Action requise :**
1. **Relire ce fichier en priorité** avant ta prochaine session dessus — c'est le fichier le plus sensible de cette livraison car il est hors de mon périmètre habituel
2. Vérifier si `_user_role()` est utilisée ailleurs avant de la supprimer définitivement si tu la juges inutile
3. Si tu as d'autres vues qui vérifient l'accès à une tâche par rôle global (notifications, rapports), envisager de les aligner sur le même modèle cumulatif (admin / chef du projet / owner / responsable)