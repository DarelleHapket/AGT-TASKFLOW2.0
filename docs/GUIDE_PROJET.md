# AGT TaskFlow / ERP — Guide du projet

Document de référence unique : état du cahier des charges par module, accès
et comptes pour tester en local, et pointeurs vers les autres documents du
dépôt. À relire après chaque évolution majeure — ce n'est pas figé.

---

## 1. Deux stacks en parallèle — ne pas confondre

| | Ancienne stack (**en production actuelle**) | Nouvelle stack (en cours de test, pas encore en prod) |
|---|---|---|
| Backend | `backend/` — Flask + SQLite | `backend_django/` — Django + DRF + Postgres (SQLite en local/dev) |
| Frontend | `frontend/` — React + Vite | `frontend_next/` — Next.js + TypeScript |
| Déploiement | `docker-compose.yml`, auto sur push `feat/dev` (`.github/workflows/deploy.yml`) | `docker-compose.django.yml`, **manuel uniquement**, cf. [`BASCULE_PRODUCTION.md`](./BASCULE_PRODUCTION.md) |

Tout le travail décrit dans ce document (Finance, RH, Profil, RBAC/IBAC,
Swagger) concerne la **nouvelle stack**. L'ancienne continue de tourner en
prod sans changement tant que la bascule n'est pas faite.

---

## 2. Tester en local — accès et comptes

### Lancer les serveurs

```bash
# Terminal 1 — API Django
cd backend_django
python3 manage.py runserver 8000

# Terminal 2 — Frontend Next.js
cd frontend_next
npm run dev
```

Next.js choisit automatiquement un port libre à partir de 3000 (3000, 3001,
3002…) — **regarder la ligne `- Local: http://localhost:XXXX` affichée au
démarrage** pour savoir lequel utiliser. L'API Django reste fixe sur 8000.

### Liens

| Lien | Contenu |
|---|---|
| `http://localhost:<port next>` | Application (dashboard, RH, Finances, etc.) |
| `http://localhost:8000/api/docs/` | **Swagger UI** — documentation interactive de toute l'API |
| `http://localhost:8000/api/redoc/` | Redoc — même doc, présentation en lecture seule |
| `http://localhost:8000/api/schema/` | Schéma OpenAPI brut (JSON) |

### Comptes de test (base locale)

Mot de passe identique pour les trois : **`Test@2026`**

| Email | Rôle | Sert à tester |
|---|---|---|
| `darelle@agt.test` | Superadmin | Accès total, `/rbac`, gestion des rôles |
| `admin.test@agt.test` | Admin | RH, Finances, sans les écrans réservés Superadmin |
| `josue@agt.test` | Membre + Chef de projet | Ce qu'un utilisateur normal voit (Finances/RH masqués) |

Pour tester un endpoint dans Swagger : se connecter d'abord sur
`/login` dans l'appli (vérifie que le compte fonctionne), puis dans Swagger
utiliser `POST /api/auth/login` (« Try it out ») avec un des comptes
ci-dessus pour récupérer un `access_token`, le coller dans le cadenas 🔒 en
haut à droite au format `Bearer <token>`.

---

## 3. Cahier des charges — état par module

Source : `documents/CahierDeChargeGlobal.pdf` + les documents d'analyse/
conception (`documents/Document_*_v1.*.md`, versions corrigées faisant foi
sur les PDF correspondants). 6 modules, un par semaine de stage.

| # | Module | Périmètre résumé | État |
|---|---|---|---|
| 0 | Améliorer l'existant | Consolider projets/activités/tâches/PERT-Gantt déjà en prod, corriger les bugs connus | ✅ Fait (bugs B01/B02/B04/B07/B09/B10/B11 corrigés, cf. historique de commits) |
| 1 | Rôles et permissions (RBAC + IBAC) | Rôles multiples par utilisateur, permissions copiées puis modifiables individuellement, superadmin unique auto-créé | ✅ Fait — `authentification/` (backend), `/rbac` (frontend) |
| 2 | Gestion du matériel | Types de matériel, stock, mouvements (achat/affectation/retour/rebut) | ❌ Pas commencé (affiché « Matériel (S2) » en attente sur le dashboard) |
| 3 | Profils et ressources humaines | Profil (poste/compétences), employés, contrats, salaires, disponibilité, recrutement, formations, signalements | ✅ Fait — `rh/` (backend), `/rh`, `/rh/recrutement`, `/rh/signalements`, section « Mon profil » sur `/mon-compte`, fiche membre sur `/membres` |
| 4 | Finances | Mouvements d'argent immuables, lien auto salaire→finances, bilan, prévisions, rapports PDF/TXT | ✅ Fait — `finances/` (backend), `/finances`, `/finances/bilan`, `/finances/previsions`, génération de rapport |
| 5 | Documentation | Documents liés à n'importe quel élément, classement, dashboard complet | ❌ Pas commencé |
| S6 | Tests et mise en ligne finale | Tests BF-00 à BF-37 par rôle, corrections, démonstration | 🔶 Partiel — tests automatisés + manuels faits pour modules 0/1/3/4 (voir §4), pas de démonstration finale ni bascule prod |

**Hors plan initial, déjà fusionné dans cette stack** : l'outil interne
`team-tool` (PERT/arbre de tâches d'équipe, sauvegardes BD) — porté dans
`pilotage_stage/` et `administration/`, le dossier `team-tool/` d'origine a
été supprimé du dépôt (son historique reste sur son propre remote GitHub
`admin-agtechnologies/team-tool`).

---

## 4. Dernier tour de travail — ce qui a été fait

- **Module 3/4, trous comblés côté frontend** (le backend était déjà complet) :
  section « Mon profil » + salaire (`/mon-compte`), fiche membre avec
  profil/salaire (`/membres`), page Prévisions (`/finances/previsions`),
  génération de rapport PDF/TXT (`/finances/bilan`), encarts RH/Finances sur
  le dashboard.
- **Swagger** : `drf-spectacular` ajouté (`/api/docs/`, `/api/redoc/`,
  `/api/schema/`).
- **Nettoyage** : `team-tool/` (déjà fusionné) et 7 fichiers obsolètes à la
  racine supprimés.
- **Validation** : 108 tests backend (`manage.py test`) verts, `tsc` +
  `next build` sans erreur, parcours navigateur manuel sur les 3 comptes de
  test ci-dessus (RBAC/IBAC vérifié : un Membre n'accède ni aux pages ni aux
  endpoints Finances/RH réservés). Un bug trouvé pendant ce test manuel
  (`/mon-compte` plantait pour un compte sans permission `rh.read`) a été
  corrigé dans la foulée.

Commit local sur `feat/darelle-B` (`baf1a35`), **pas encore poussé** — en
attente de validation après test en local.

---

## 5. Documents liés

- [`BASCULE_PRODUCTION.md`](./BASCULE_PRODUCTION.md) — runbook de bascule
  vers la nouvelle stack en production (non exécuté).
- `documents/` — cahier des charges global (PDF) + documents d'analyse et de
  conception par module (PDF + `.md`, les `.md` faisant foi sur les PDF
  correspondants).
- `docs.ia/` — notes de travail et protocole de session (poste Darelle).
