# AGT TaskFlow / ERP — Guide du projet

Document de référence unique : état du cahier des charges par module, accès
et comptes pour tester en local, et pointeurs vers les autres documents du
dépôt. À relire après chaque évolution majeure — ce n'est pas figé.

---

## 1. Une seule stack — l'ancienne a été supprimée

Correction 2026-08-10 : `backend/` (Flask) et `frontend/` (Vite/React), ainsi
que `docker-compose.yml` (qui les référençait), ont été **supprimés du
dépôt** — plus aucune stack en parallèle. La seule stack existante :

|             | Stack actuelle (seule)                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend     | `backend_django/` — Django + DRF + Postgres                                                                                                                |
| Frontend    | `frontend_next/` — Next.js + TypeScript                                                                                                                    |
| Déploiement | `docker-compose.django.yml` (nom de projet `agt-django`), lancé manuellement — cf. [`BASCULE_PRODUCTION.md`](./BASCULE_PRODUCTION.md) pour le runbook prod |

---

## 2. Tester en local — accès et comptes

### Lancer la stack (Docker — méthode utilisée en pratique)

```bash
docker compose -f docker-compose.django.yml --env-file .env.django -p agt-django up -d --build
```

`-p agt-django` fixe le nom de projet Docker Compose : sans lui, Compose
dérive un nom du répertoire courant, ce qui a déjà créé une stack en double
avec une base Postgres vide (piège rencontré le 2026-08-10 — toujours
utiliser ce `-p` pour retomber sur la même stack/volume).

Après une modification de code, rebuild le service concerné (`api` pour le
backend, `web` pour le frontend, les deux si le doute) :

```bash
docker compose -f docker-compose.django.yml --env-file .env.django -p agt-django up -d --build web
```

Les migrations Django s'appliquent automatiquement au démarrage du
conteneur `api` (`entrypoint.sh`) — pas besoin de les lancer à la main.

### Alternative — sans Docker (hot-reload plus rapide en dev actif)

```bash
# Terminal 1 — API Django (nécessite Postgres accessible en local ou exposé)
cd backend_django
python3 manage.py runserver 8000

# Terminal 2 — Frontend Next.js
cd frontend_next
npm run dev
```

Next.js choisit un port libre à partir de 3000 si non précisé — regarder la
ligne `- Local: http://localhost:XXXX` affichée au démarrage.

### Liens

| Lien                                | Contenu                                                   |
| ----------------------------------- | --------------------------------------------------------- |
| `http://localhost:4100`             | Application (via Docker, `-p agt-django`)                 |
| `http://localhost:8000/api/docs/`   | **Swagger UI** — documentation interactive de toute l'API |
| `http://localhost:8000/api/redoc/`  | Redoc — même doc, présentation en lecture seule           |
| `http://localhost:8000/api/schema/` | Schéma OpenAPI brut (JSON)                                |

### Comptes de test (base locale)

| Email                             | Mot de passe          | Rôle       | Sert à tester                                                                                                                                                                    |
| --------------------------------- | --------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `superadmin@ag-technologies.tech` | `TestSuperadmin2026!` | Superadmin | Identifiants réels seedés par `.env.django` (`SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`) — vérifié le 2026-08-10, seul compte actif dans la base Postgres de la stack `agt-django` |i

Correction 2026-08-10 : l'entrée précédente de ce tableau (`SuperAdmin@agt.com` /
`AGT2026!`) ne correspond à aucun compte de la base Postgres actuelle — vérifié
par requête directe. Pour retester les différences de rôle (Admin/Chef de
projet/Membre), le plus simple est de passer par le vrai parcours de
l'appli : `/login` → « Créer un compte » → valider la demande depuis `/membres` avec
le compte superadmin ci-dessus, puis attribuer le rôle voulu — plutôt que je recrée des
comptes en dur qu'il faudra encore nettoyer ensuite.

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

| #   | Module                             | Périmètre résumé                                                                                                    | État                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Améliorer l'existant               | Consolider projets/activités/tâches/PERT-Gantt déjà en prod, corriger les bugs connus                               | ✅ Fait (bugs B01/B02/B04/B07/B09/B10/B11 corrigés, cf. historique de commits)                                                                                                                                                                                                                                                             |
| 1   | Rôles et permissions (RBAC + IBAC) | Rôles multiples par utilisateur, permissions copiées puis modifiables individuellement, superadmin unique auto-créé | ✅ Fait — `authentification/` (backend), `/rbac` (catalogue rôles+permissions, créer/supprimer) et `/membres` (bascule directe des rôles/permissions par membre, groupée par module) côté frontend                                                                                                                                         |
| 2   | Gestion du matériel                | Types de matériel, stock, mouvements (achat/affectation/retour/rebut)                                               | ✅ Fait — `materiel/` (backend), `/materiel`, `/materiel/mouvements`                                                                                                                                                                                                                                                                       |
| 3   | Profils et ressources humaines     | Profil (poste/compétences), employés, contrats, salaires, disponibilité, recrutement, formations, signalements      | ✅ Fait — `rh/` (backend), `/rh`, `/rh/recrutement`, `/rh/signalements`, section « Mon profil » sur `/mon-compte`, fiche membre sur `/membres`. **Hors CDC, ajouté le 2026-08-10** : congés et notes de frais (espace salarié self-service — poser/annuler sur `/mon-compte`, valider/refuser sur `/rh`). **Révisé le 2026-08-17** : fiche de paie — historique mensuel persisté (`FichePaie`) sur `/mon-compte`, généré par un cron mensuel (pas un bouton PDF unique comme avant) |
| 4   | Finances                           | Mouvements d'argent immuables, lien auto salaire→finances, bilan, prévisions, rapports PDF/TXT                      | ✅ Fait — `finances/` (backend), `/finances`, `/finances/bilan`, `/finances/previsions`, génération de rapport. **Révisé le 2026-08-17** : sortie salariale automatique déclenchée par un cron mensuel (service `cron` dans `docker-compose.django.yml`), plus par la création d'un contrat |
| 5   | Documentation                      | Documents liés à n'importe quel élément, classement, dashboard complet                                              | ❌ Pas commencé                                                                                                                                                                                                                                                                                                                            |
| S6  | Tests et mise en ligne finale      | Tests BF-00 à BF-37 par rôle, corrections, démonstration                                                            | 🔶 Partiel — tests automatisés + manuels faits pour modules 0/1/2/3/4 (voir §4), pas de démonstration finale ni bascule prod                                                                                                                                                                                                               |

**Hors plan initial, déjà fusionné dans cette stack** : l'outil interne
`team-tool` (PERT/arbre de tâches d'équipe, sauvegardes BD) — porté dans
`pilotage_stage/` et `administration/`, le dossier `team-tool/` d'origine a
été supprimé du dépôt (son historique reste sur son propre remote GitHub
`admin-agtechnologies/team-tool`).

---

## 4. Dernier tour de travail — 2026-08-10

- **Suppression de l'ancienne stack** : `backend/` (Flask), `frontend/`
  (Vite/React) et `docker-compose.yml` supprimés du dépôt — plus qu'une
  seule stack (§1). Des changements non commités qui traînaient dans ces
  dossiers ont été perdus (acté avec le donneur d'ordre avant suppression).
- **Onglet Tâches allégé** (`frontend_next/src/components/tasks/TasksView.tsx`) :
  ajout d'un mode **Tableau** (kanban par membre, compteurs faits/bloqués) à
  côté du mode Liste existant ; barre de filtres réduite en mode `compact`
  (Projet/Membre/Statut seulement, plus de Priorité/Période/booleans) ;
  chaque ligne réduite à titre + assigné + statut + bouton ouvrir + bouton
  Supprimer (réservé au créateur/owner/manager de projet, permission
  `"full"`).
- **PERT enrichi + fusionné avec Gantt** : table éditable (# / Nom /
  Prédécesseurs / Durée / Statut / Marge / Supprimer) + pastilles « Durée du
  projet »/« Tâches critiques » + export JSON ajoutés au-dessus du diagramme
  réseau existant (`/pert`). Le lien de menu unique « PERT / Gantt » (qui ne
  menait qu'au Gantt) ouvre maintenant un toggle Gantt/PERT sur la même page
  (`/gantt`) pour rendre la table PERT réellement accessible.
- **Rôles & permissions (`/rbac`)** : catalogue Rôles et catalogue
  Permissions ajoutés (créer/supprimer un rôle ou une permission, basculer
  les permissions par défaut d'un rôle) — en plus du tableau par membre déjà
  existant. Nouvelles permissions créées via ce catalogue suivent le style
  `verbe:ressource` (ex. `gerer:conges`), différent du style `ressource.verbe`
  déjà en place pour les permissions historiques (`rh.write`, non renommées).
- **Membres (`/membres`)** : cartes par membre avec rôles et permissions
  directes cochables/décochables en un clic (Superadmin uniquement),
  permissions regroupées par module pour la lisibilité.
- **Bug RBAC corrigé — retrait de rôle** : `authentification/services.py::revoke_role`
  laissait les permissions déjà copiées d'un rôle **actif indéfiniment**
  après le retrait de ce rôle (BF-05 pris au pied de la lettre). Un compte
  passé d'Admin à Membre gardait par exemple `membres.delete`. Corrigé :
  retirer un rôle retire maintenant les permissions que **ce rôle précis**
  avait données, sauf si un autre rôle actif de l'utilisateur les accorde
  aussi, ou si elles ont été accordées/retirées **directement** (IBAC,
  toujours prioritaire, inchangé). Données existantes nettoyées en base pour
  les comptes déjà affectés. Voir la correction dans
  [`Document_Analyse_Module1_RBAC-IBAC_v1.1.md`](../documents/Document_Analyse_Module1_RBAC-IBAC_v1.1.md).
- **Congés et notes de frais — hors CDC, ajouté à la demande explicite du
  donneur d'ordre** (CDC à mettre à jour formellement) : modèles `Conge` et
  `NoteFrais` (`rh/models.py`), permissions `rh.conges.gerer` /
  `rh.notes_frais.gerer` (Admin/Superadmin uniquement, même règle que le
  reste du module RH). Un employé pose sa demande et la voit sur
  `/mon-compte` (annulable tant qu'en attente) ; Admin/Superadmin
  valide/refuse avec commentaire sur `/rh`, onglet « Congés & notes de
  frais ». Voir la correction dans
  [`Document_Analyse_Module3-4_v1.1.md`](../documents/Document_Analyse_Module3-4_v1.1.md).
- **Fiche de paie téléchargeable** : PDF généré côté client (`jsPDF`, même
  pattern que le bilan financier — rien stocké côté serveur) depuis
  `/mon-compte`, + historique de carrière (tous les contrats/rémunérations
  passés, pas seulement le contrat en cours).
- **Bug avatar corrigé** : le badge de profil en haut à droite
  (`AppShell.tsx`) avait sa couleur codée en dur sur `var(--accent)`, jamais
  reliée à `user.color` — la sauvegarde fonctionnait déjà côté serveur, mais
  rien ne le montrait à l'écran. Corrigé.
- **Identifiants réels corrigés** : la doc indiquait `SuperAdmin@agt.com` /
  `AGT2026!`, qui ne correspond à aucun compte de la base — voir §2.

Commit local sur `feat/darelle-B`, **pas encore poussé** — en attente de
validation après test en local.

---

## 5. Documents liés

- [`GUIDE_FONCTIONNEL.md`](./GUIDE_FONCTIONNEL.md) — comment utiliser chaque
  module (RH, recrutement, finances, matériel), réponses aux questions
  fréquentes en testant (pourquoi tel montant est en rouge, comment assigner
  un poste, etc.).
- [`BASCULE_PRODUCTION.md`](./BASCULE_PRODUCTION.md) — runbook de bascule
  vers la nouvelle stack en production (non exécuté).
- `documents/` — cahier des charges global (PDF) + documents d'analyse et de
  conception par module (PDF + `.md`, les `.md` faisant foi sur les PDF
  correspondants).
- `docs.ia/` — notes de travail et protocole de session (poste Darelle).
