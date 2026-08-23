# AGT ERP — Guide de test, feuille de route et perspectives

Document à jour au **2026-08-23**. Contrairement à `GUIDE_PROJET.md` (état du
cahier des charges) et `GUIDE_FONCTIONNEL.md` (logique métier détaillée), ce
document répond à une seule question : **comment tester chaque module,
concrètement, et où en est-on**. À relire/mettre à jour après chaque session
de correction — plusieurs infos des deux autres guides sont déjà obsolètes
(catalogue de rôles à 4 entrées, mouvement "rebut", etc.) suite au chantier
RBAC et Matériel du 2026-08-19/23.

---

## 1. Comment l'application fonctionne — vue d'ensemble

### Stack et démarrage

```bash
docker compose -f docker-compose.django.yml --env-file .env.django -p agt-django up -d --build
```

- **Backend** : `backend_django/` (Django + DRF + Postgres), un module = une
  app Django (`materiel/`, `rh/`, `finances/`, `projets/`, `authentification/`…).
- **Frontend** : `frontend_next/` (Next.js + TypeScript), une route par page
  sous `src/app/`, composants partagés sous `src/components/`.
- **Accès** : app sur `http://localhost:4100`, API brute + Swagger sur
  `http://localhost:8000/api/docs/`.
- Après une modif de code : rebuild le service concerné
  (`... up -d --build api` ou `web`) — les migrations Django s'appliquent
  automatiquement au démarrage du conteneur `api`.

### Le modèle d'autorisation — comprendre ça avant de tester quoi que ce soit

Toute la logique de test ci-dessous tourne autour d'un seul principe, posé le
2026-08-19 : **2 rôles natifs seulement, tout le reste est une question de
permission, pas de rôle**.

- **Superadmin** : accès total fixe, non modifiable, non révocable. Un seul
  compte au départ (seedé par `.env.django`), peut en promouvoir d'autres.
- **Utilisateur** (code `user`, ex-"Membre") : rôle de base, porte un petit
  socle de permissions par défaut (lecture RH/matériel...). **Tout le reste
  s'accorde à la carte**, de deux façons :
  1. **Rôles personnalisés** — le Superadmin en crée autant qu'il veut
     depuis `/rbac` ("Rôles (catalogue)"), avec un nom libre (ex. "Chef de
     projet", "Admin", "Comptable") et un paquet de permissions cliquables.
     Un même utilisateur peut cumuler plusieurs rôles.
  2. **Permissions directes (IBAC)** — indépendamment de tout rôle, sur la
     fiche de chaque membre (`/rbac`, bouton "Permissions", ou `/membres`) :
     accorder ou **retirer** une permission précise à une seule personne. Un
     retrait direct prime toujours sur ce qu'un rôle accorderait par ailleurs.
- **Permissions par-projet (IBAC scopé)** : indépendamment du RBAC global, un
  propriétaire de projet peut accorder `taches.gerer` / `activites.gerer` /
  `equipe.gerer` / `projet.gerer` à un membre de CE projet précis, au-delà de
  ce que son rôle projet (owner/manager/contributor) donne par défaut —
  panneau "Permissions" sous chaque membre dans la fiche projet.

**Conséquence pratique pour tester** : il n'existe plus de compte "Chef de
projet" ou "Admin" tout fait — il faut soit utiliser un rôle personnalisé déjà
créé dans la base de test, soit en créer un depuis `/rbac`, soit accorder des
permissions directes à un compte "Utilisateur" existant.

### Comptes de test

| Email | Mot de passe | Rôle |
| --- | --- | --- |
| `superadmin@ag-technologies.tech` | `TestSuperadmin2026!` | Superadmin (seedé par `.env.django`) |

Pour tester en tant qu'"Utilisateur" simple ou avec des permissions
spécifiques : `/login` → "Créer un compte" → valider la demande depuis
`/membres` avec le compte Superadmin, puis attribuer rôles/permissions
depuis `/rbac`. Ne pas créer de comptes en dur dans une migration pour ça —
le vrai parcours d'inscription est plus fiable dans la durée.

---

## 2. Feuille de route — état par module

| # | Module | État | Dernière action |
| --- | --- | --- | --- |
| 0 | Projets / Tâches / PERT-Gantt | ✅ Stable | Permissions par-projet flexibles ajoutées (owner peut accorder `taches.gerer` etc. indépendamment du rôle projet) |
| 1 | Rôles & permissions (RBAC + IBAC) | ✅ Fait | Réduit à 2 rôles natifs (Superadmin/Utilisateur) + catalogue de rôles personnalisés créables par le Superadmin, 2026-08-19 |
| 2 | Matériel | ✅ Fait, conforme au document formel | Alertes (rupture de stock auto, anomalie/rappel manuels, notification ciblée), types de mouvement "hors service"/"consommation", cohérence d'affectation dynamique (BNF-02), suppression protégée propre — **2026-08-23** |
| 3 | Profils et RH | ✅ Fait, conforme au document formel | Rémunération gérable après l'embauche (pas seulement à la création), annuaire employés léger sans donnée salariale — **2026-08-23** |
| 4 | Finances | ✅ Fait, conforme au document formel | Suppression de type protégée propre, mouvement manuel niveau "employé", encart tableau de bord (solde + mouvements récents) — **2026-08-23** |
| 5 | Documentation | ❌ Pas commencé | Documents liés à un élément quelconque, classement — hors périmètre de cette session |
| S6 | Tests et mise en ligne | 🔶 Partiel | Tests automatisés + manuels à jour pour 0/1/2/3/4 ; reste : démonstration finale, bascule prod |

**Rien n'est commité** — standing instruction de cette session : finir le
travail, puis tester manuellement avant tout commit.

---

## 3. Perspectives — prochaines étapes

Les audits Finances et RH contre les documents formels reçus le 2026-08-23
sont terminés (voir §4.C/§4.D pour le détail des écarts trouvés et corrigés).
Ce qui reste, par ordre de priorité suggéré :

1. **Module Documentation** (§2, module 5) — non commencé : documents liés à
   n'importe quel élément (projet, tâche, employé, matériel…), classement,
   pas de modèle ni d'écran existant à ce jour.
2. **Phase 2 du responsive** — le shell (sidebar/topbar) est responsive,
   les pages individuelles (RH, Finances, Matériel, tableaux) ont encore des
   largeurs fixes par endroits — deferred, jamais repris depuis.
3. **Démonstration finale et bascule prod** (module S6) — cf.
   `BASCULE_PRODUCTION.md`, runbook existant mais jamais exécuté.
4. **Petits reliquats notés pendant les audits, non bloquants** :
   - `ProjectMembersPanel.tsx` (permissions par-projet) : le panneau de
     gestion n'est affiché qu'au `owner`, pas à un membre qui aurait reçu
     `equipe.gerer` directement — le backend accepterait pourtant sa requête.
   - Le catalogue de mouvements financiers/matériel reste un texte libre créé
     à la volée (pas de validation métier sur les noms/doublons) — accepté
     tel quel, cohérent avec le reste du RBAC (catalogues ouverts au
     Superadmin).
5. Après toute nouvelle modification de ces modules : repasser
   `python manage.py test` + `tsc --noEmit` + `eslint`, comme fait à chaque
   étape de cette session, avant de proposer un commit.

---

## 4. Guide de test par module

Convention : "un utilisateur autorisé" = a la permission listée entre
parenthèses, obtenue via un rôle personnalisé ou une permission directe
(§1). Tester systématiquement le cas positif (a la permission → ça marche)
ET le cas négatif (n'a pas la permission → 403/masqué).

### A. Authentification & RBAC (`/login`, `/rbac`, `/membres`)

1. **Inscription + validation** : `/login` → "Créer un compte" → le compte
   apparaît en attente sur `/membres` (Superadmin) → valider → le compte
   devient actif avec le rôle "Utilisateur" par défaut.
2. **Rôle personnalisé** : sur `/rbac`, carte "Rôles (catalogue)" → créer un
   rôle (ex. "Testeur") → cliquer des badges de permissions pour construire
   son paquet → il apparaît dans le menu "Ajouter" de chaque membre plus bas
   sur la page.
3. **Attribution/retrait de rôle** : attribuer le rôle créé à un membre,
   vérifier qu'il apparaît dans ses badges ; le retirer, vérifier qu'il
   disparaît (sauf "Superadmin", non retirable).
4. **Permission directe (IBAC)** : dans le panneau "Permissions" d'un
   membre, accorder une permission hors de son rôle → se reconnecter avec ce
   compte, vérifier l'accès effectif à la fonctionnalité correspondante.
   Puis **retirer directement** une permission que son rôle accorderait par
   ailleurs → vérifier que l'accès est bien coupé (le retrait direct doit
   primer sur le rôle).
5. **Suppression/suspension** (`membres.delete`/`membres.suspend`) : sur
   `/membres`, suspendre puis réactiver un compte ; vérifier qu'un compte
   suspendu ne peut plus se connecter.

### B. Projets, Tâches, PERT/Gantt (`/projets`, `/taches`, `/gantt`, `/pert`)

1. **Création de projet** (`projets.write`) : créer un projet, vérifier que
   le créateur devient automatiquement `owner`.
2. **Permissions par-projet flexibles** : dans la fiche projet, panneau
   membres → un `contributor` sans `taches.gerer` ne peut pas créer de
   tâche ; l'owner lui accorde `taches.gerer` directement (indépendamment de
   son rôle projet) → il peut désormais créer une tâche dans CE projet
   uniquement.
3. **Tâches** : créer/assigner/faire évoluer le statut d'une tâche ; vérifier
   les vues Liste et Tableau (kanban par membre) sur `/taches`.
4. **PERT/Gantt** : `/gantt` bascule Gantt/PERT sur la même page ; vérifier
   le calcul du chemin critique et des marges après ajout de dépendances.

### C. RH & Profils (`/rh`, `/rh/recrutement`, `/rh/signalements`, `/mon-compte`, `/membres`)

**Audit contre le document formel fait le 2026-08-23.** Seul écart réel
trouvé : **BF-04** ("gérer la rémunération des employés") n'était couvert
qu'à l'embauche — aucun moyen d'enregistrer une augmentation ensuite. Corrigé
(`POST /rh/employes/<id>/remuneration`, bouton "Changer la rémunération" sur
la fiche membre). Tout le reste était déjà conforme.

1. **Profil auto-créé** (BF-01) : valider un compte → vérifier qu'un
   `Profil` existe pour lui sans action manuelle.
2. **Référentiel RH** (`rh.write`, BF-02) : gérer compétences/postes/équipes
   sur `/rh`.
3. **Embauche** (`rh.employes.gerer`, BF-03) : créer un employé rattaché à
   un profil existant, avec contrat + première rémunération.
4. **Gestion de la rémunération après embauche** (BF-04, corrigé le
   2026-08-23) : sur `/membres`, ouvrir la fiche d'un employé →
   "Changer la rémunération" (visible avec `rh.employes.gerer`) → saisir un
   nouveau montant/périodicité → vérifier que le nouveau montant s'affiche
   ET que l'ancienne rémunération reste dans l'historique (BNF-01 : jamais
   écrasée, une nouvelle ligne est créée).
5. **Confidentialité salariale** (BNF-02) — **point sensible à tester en
   priorité** : se connecter avec un compte "Utilisateur" sans
   `rh.employes.gerer`, tenter d'atteindre la rémunération d'un AUTRE
   employé (pas la sienne) — doit être refusé, y compris en tapant l'URL/API
   directement. Vérifier aussi que `GET /api/rh/employes` (annuaire léger,
   ouvert à tout authentifié pour le sélecteur de mouvement financier) ne
   renvoie **jamais** de champ salarial, seulement id + nom.
6. **Fiche de paie** (BF-06, BNF-04) — même test que ci-dessus mais sur le
   PDF de fiche de paie : un employé ne doit jamais pouvoir télécharger celle
   d'un autre, même en devinant/changeant l'ID dans la requête.
7. **Recrutement → embauche automatique** (BF-11/BF-12, BNF-03) : faire
   passer une candidature au statut "retenue" sur `/rh/recrutement` →
   vérifier qu'un compte + profil + employé + contrat sont créés
   automatiquement, et qu'aucun compte n'existe déjà en parallèle avant ce
   passage de statut.
8. **Formations → compétences auto** (BF-08/BF-09) : inscrire un employé à
   une formation, faire passer l'inscription à "terminée" → vérifier que les
   compétences visées apparaissent sur son profil sans action manuelle.
9. **Signalements** (BF-13/BF-14) : signaler une difficulté (tout
   utilisateur), la traiter (`rh.signalements.traiter`).
10. **Congés / notes de frais** (hors CDC, ajouté en cours de route) : poser
    une demande sur `/mon-compte`, valider/refuser sur `/rh`.

### D. Finances (`/finances`, `/finances/bilan`, `/finances/previsions`)

**Audit contre le document formel fait le 2026-08-23.** Écarts trouvés et
corrigés : suppression de type non protégée (BF-01), niveau "employé"
absent du formulaire manuel (BF-02), pas d'encart tableau de bord (BF-07).
BNF-04 (cohérence du niveau) était déjà solide — imposée à la fois par le
serializer et par une contrainte en base (`CheckConstraint`).

1. **Types de mouvement** (`finances.mouvements.gerer`, BF-01) : créer un
   type avec son sens (entrée/sortie) ; tenter de le supprimer alors qu'un
   mouvement l'utilise → refusé proprement (409), corrigé le 2026-08-23
   (c'était un 500 brut avant).
2. **Mouvement financier — les 3 niveaux** (BF-02, corrigé le 2026-08-23
   pour le niveau employé) : sur `/finances`, enregistrer un mouvement au
   niveau Entreprise, puis Projet, puis **Employé** (le sélecteur d'employé
   utilise l'annuaire léger `GET /rh/employes`, sans donnée salariale) —
   vérifier qu'il est daté automatiquement et **non modifiable/non
   supprimable après coup** (BNF-01) — un correctif se fait par mouvement
   inverse, jamais une édition.
3. **Sortie salariale automatique** (BF-03, BNF-03) : vérifier que le cron
   mensuel (service `cron` du `docker-compose.django.yml`) génère bien un
   mouvement financier par employé, sans ressaisie.
4. **Bilan** (BF-04) : générer le bilan sur une période, vérifier le calcul
   entrées − sorties à la volée (pas de solde stocké en base).
5. **Prévisions** (BF-05) : saisir un montant prévu pour une période/niveau,
   vérifier la comparaison automatique au réel.
6. **Rapport téléchargeable** (BF-06) : générer un rapport PDF et TXT,
   vérifier que les deux téléchargent correctement.
7. **Tableau de bord financier** (BF-07, corrigé le 2026-08-23) :
   `/dashboard` affiche maintenant une section "Finances — mouvements
   récents" (5 derniers, tous niveaux confondus) en plus du solde du mois
   déjà présent sur la tuile Finances.
8. **Cohérence du niveau** (BNF-04) : tenter de créer un mouvement niveau
   "projet" sans projet, ou niveau "entreprise" avec un projet renseigné →
   refusé côté formulaire (serializer) — la contrainte base de données est
   un filet de sécurité, pas la première ligne de défense.
9. **Conformité OHADA** (BNF-02) : le bandeau d'avertissement sur
   `/finances/bilan` ("à faire vérifier par un expert avant tout usage
   officiel") était déjà présent — aucune correction nécessaire.

### E. Matériel (`/materiel`, `/materiel/mouvements`) — fraîchement corrigé, tester en premier

1. **Types & inventaire** (`materiel.write`) : créer un type, créer un
   matériel rattaché.
2. **Mouvements** : enregistrer achat/affectation/retour/hors
   service/consommation sur `/materiel/mouvements` — vérifier que le stock
   de l'inventaire se met à jour uniquement sur achat (+) et hors
   service/consommation (−), pas sur affectation/retour.
3. **BNF-02 — cohérence d'affectation** : affecter un matériel à un employé
   ou projet, puis tenter de le réaffecter ailleurs **sans avoir enregistré
   de retour** → doit être refusé avec un message clair ; enregistrer le
   retour, puis réaffecter → doit passer.
4. **Alerte automatique** (BF-08) : vider le stock d'un matériel (mouvement
   hors service/consommation jusqu'à 0) → une alerte "Rupture de stock"
   apparaît automatiquement sur `/materiel`, sans action manuelle ; refaire
   la même chose une deuxième fois → vérifier qu'aucune deuxième alerte
   ouverte n'est créée (anti-doublon, BNF-04).
5. **Alerte manuelle** (BF-09) : bouton "Signaler" sur `/materiel` — un
   compte "Utilisateur" simple (sans `materiel.write`) doit pouvoir signaler
   une **anomalie**, mais pas voir/utiliser l'option "Rappel" (réservée à
   `materiel.write`).
6. **Notification ciblée** (BF-11) : créer une alerte avec un compte A,
   vérifier qu'un compte B ayant `materiel.write` reçoit une notification,
   et qu'un compte C "Utilisateur" simple n'en reçoit **pas** (contrairement
   à la notification de mouvement classique, qui elle est diffusée à tous
   les actifs).
7. **Traitement d'alerte** (BF-10) : bouton "Traiter" sur une alerte ouverte
   (`materiel.write`) → passe à "Traitée", disparaît de la liste des alertes
   ouvertes et du compteur.
8. **Suppression protégée** (BF-02/BF-04) : tenter de supprimer un type
   utilisé par du matériel, ou un matériel ayant des mouvements → message
   propre, pas de plantage.
9. **Tableau de bord** (BF-12) : `/dashboard` — la tuile "Matériel" affiche
   le stock total et, en rouge, le nombre d'alertes ouvertes s'il y en a ;
   `/materiel` affiche en plus le détail par type/projet et les 5 derniers
   mouvements.

### F. Rapports / Tableau de bord global (`/rapports`, `/dashboard`)

1. Vérifier que le tableau de bord n'affiche que les encarts correspondant
   aux permissions du compte connecté (RH/Finances/Matériel masqués si pas
   les permissions de lecture correspondantes).
2. `/rapports` : générer un rapport de projet, vérifier l'export.

---

## 5. Historique des audits — méthode utilisée

Pour Matériel, Finances et RH, la même méthode a été appliquée à chaque
fois : lire `models.py`/`services.py`/`views.py`/`serializers.py` en entier,
comparer point par point contre le document formel (BF/BNF), lister les
écarts, les faire valider par l'utilisateur, puis implémenter + tester
(tests automatisés `python manage.py test` + `tsc --noEmit` + `eslint` +
rebuild Docker + vérification manuelle) avant de proposer un commit. À
réappliquer pour tout futur document formel reçu sur un module existant, et
pour le module Documentation (§3) une fois son périmètre précisé.
