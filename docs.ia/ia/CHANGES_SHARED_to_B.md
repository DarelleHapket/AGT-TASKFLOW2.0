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