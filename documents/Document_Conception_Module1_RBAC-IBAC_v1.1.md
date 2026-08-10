# Document de Conception — Correctif v1.1

## AGT ERP : Module 1 : RBAC + IBAC + Tableau de bord squelette

| | |
|---|---|
| **Auteur** | Hapket Darelle (cheffe d'équipe) |
| **Encadrant** | NOMO BODIANGA Gabriel |
| **Semaine** | S1 → corrections début S2 — 27 juillet au 5 août 2026 |
| **Version** | 1.1 (corrige la v1.0 du 28 juillet 2026, en cohérence avec le Document d'Analyse v1.1) |
| **Statut** | Document de conception — corrections post-relecture |

---

## 0. Pourquoi cette révision

Deux choses à mettre en cohérence avec le Document d'Analyse v1.1 :

1. Le diagramme d'états « Cycle de vie du rôle global (RoleGlobal) » (section 4.2 de la v1.0) reposait sur l'enum `RoleGlobal` et un modèle à rôle unique. Ce modèle est abandonné (voir Analyse v1.1, §5.2) au profit d'un modèle multi-rôles (`Role` en table, association many-to-many avec `Utilisateur`) + permissions directes (IBAC). La conception doit refléter la même architecture de données.
2. **Exigence ajoutée : l'application doit être responsive web.** Ce n'était pas couvert par la v1.0 — ni dans les choix technologiques, ni dans l'architecture. Un état des lieux du frontend actuel montre qu'aucune media query n'existe dans `index.css`, et que plusieurs écrans utilisent des largeurs fixes en pixels (ex. panneau de connexion à 480px fixes, contenu principal plafonné à 1440px sans réduction en dessous). Cette section corrige ce manque.

Le reste du document (architecture client/serveur, justification Flask vs Django/microservices, flux de connexion, flux de vérification de permission, structure des fichiers) reste valide et n'est pas repris ici — seules les sections impactées sont réécrites.

---

## 1. Diagrammes d'états/transitions (section 4 — corrigée)

### 1.1 Cycle de vie d'un compte utilisateur (`StatutCompte`) — inchangé

Toujours : `EN_ATTENTE → ACTIF ↔ SUSPENDU → SUPPRIMÉ`. C'est un champ à valeur unique, un diagramme d'états classique reste correct.

### 1.2 Attribution des rôles — remplace « Cycle de vie du rôle global (RoleGlobal) »

L'ancien diagramme d'états (`MEMBRE ↔ CHEF_PROJET`, `ADMIN` attribué à part) supposait qu'un utilisateur ne porte qu'un seul rôle global à la fois. Ce n'est plus le modèle retenu : `member_roles` (table pivot) autorise plusieurs rôles simultanés par utilisateur (BF-04 du CDC), et `member_permissions` permet des permissions directes indépendantes du rôle (IBAC, BF-05).

Un diagramme d'états à jeton unique n'a donc plus de sens pour modéliser cela. Il est remplacé, comme dans l'Analyse v1.1 (§5.2), par le principe d'implémentation suivant :

- **Attribution d'un rôle** = `INSERT` dans `member_roles` (idempotent) + copie des permissions par défaut du rôle dans `member_permissions` avec `source='role'`.
- **Retrait d'un rôle** = `DELETE` dans `member_roles`. Les permissions déjà copiées **restent** (elles sont découplées dès l'attribution — BF-05) sauf retrait explicite.
- **Retrait automatique piloté par une règle métier** (ex. `chef_projet`, retiré quand l'utilisateur ne possède plus aucun projet) : la même mécanique s'applique, déclenchée par le code métier plutôt que par une action manuelle du Superadmin. C'est le cas observé dans `_demote_if_orphan()` (`routes/projects.py`), qui doit désormais mettre à jour **à la fois** la colonne legacy `members.role` et la table `member_roles`, pour que les deux systèmes restent synchronisés (un bug de désynchronisation entre les deux a été identifié et corrigé début S2 — cf. rapport de session : BUG-02).

---

## 2. Diagrammes d'activités (section 5 — mise à jour du flux d'assignation)

Le flux de connexion (§5.1) et le flux de vérification d'une permission (§5.3) restent inchangés — ils étaient déjà écrits en termes de permissions effectives, indépendamment de tout enum de rôle.

Le flux d'assignation d'un rôle (§5.2) est précisé sur deux points :

1. Étape 2 (« Il choisit le nouveau rôle ») devient **« Il ajoute (ou retire) un rôle parmi ceux déjà portés »** — ce n'est plus un remplacement de rôle unique, mais un ajout/retrait dans un ensemble.
2. Étape 5 (« Les permissions par défaut du nouveau rôle sont copiées dans `PermissionEffective` ») est complétée : si l'utilisateur possède déjà des permissions directes (IBAC, `source='direct'`), elles ne sont **jamais écrasées** par l'attribution d'un rôle — seules les permissions `source='role'` sont ajoutées ou mises à jour.

---

## 3. Responsive web (nouvelle section)

### 3.1 Constat

Le frontend actuel (`frontend/src/index.css` et les composants React) ne contient **aucune media query** et plusieurs écrans utilisent des largeurs fixes en pixels non adaptatives (ex. `LoginPage` : panneau de formulaire à 480px fixes ; `App.jsx` : contenu plafonné à 1440px). L'application n'est donc pas utilisable correctement sur un écran de taille mobile ou tablette aujourd'hui.

### 3.2 Exigence

Toutes les vues de l'ERP (tableau de bord, tâches, Gantt, PERT, projets, matériel, RH, finances, documentation à venir) doivent rester lisibles et utilisables sur trois familles de largeur d'écran :

| Palier | Largeur | Usage typique |
|---|---|---|
| Mobile | < 640px | Consultation rapide, statut de tâche |
| Tablette | 640–1024px | Consultation + saisie occasionnelle |
| Desktop | > 1024px | Usage principal (poste de travail) |

### 3.3 Approche retenue pour la suite du développement (modules 2 à 5)

- **Layout fluide par défaut** : remplacer les largeurs fixes en pixels par des unités relatives (`%`, `rem`, `minmax()`, `clamp()`) et des conteneurs flexibles (`flex`, `grid`) plutôt que des tailles codées en dur.
- **Media queries** sur les trois paliers ci-dessus, centralisées dans `index.css` via des variables/breakpoints partagés, pour éviter que chaque composant réinvente son propre seuil.
- **Sidebar et tableaux** (les deux zones les plus denses de l'app) : bascule en navigation repliable/empilée sous le palier tablette, plutôt que simple débordement horizontal.
- Cette approche est un correctif progressif sur la base **Flask/React/SQLite actuelle**, applicable dès le Module 2 (matériel) sans dépendre d'une éventuelle migration future de stack.
- **Si la migration vers Next.js/Tailwind (évoquée pour l'intégration de team-tool) est retenue**, le responsive sera nativement couvert par les classes utilitaires `sm:`/`md:`/`lg:` de Tailwind — dans ce cas cette exigence sera satisfaite par construction plutôt que par un correctif manuel. Ce point sera tranché dans le plan de migration à venir, pas dans ce document.

---

## 4. Conclusion

Cette révision aligne le Document de Conception sur le modèle multi-rôles + IBAC retenu dans l'Analyse v1.1 (`member_roles` et `member_permissions` remplacent la logique à rôle unique), documente le bug de désynchronisation déjà corrigé (`_demote_if_orphan`), et introduit le responsive web comme exigence transversale, avec une approche immédiate (media queries sur la base actuelle) et une option à plus long terme (Tailwind, si la fusion avec team-tool est confirmée).

---

*Document de conception — Module 1 RBAC + IBAC — AGT ERP — version 1.1 — corrige la version 1.0 du 28 juillet 2026 — Hapket Darelle.*
