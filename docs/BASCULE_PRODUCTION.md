# Bascule en production — Flask/React → Django/Next.js

Runbook pour basculer AGT TaskFlow de la stack actuelle en production
(`docker-compose.yml`, Flask + React + SQLite) vers la nouvelle stack déjà
développée en parallèle (`docker-compose.django.yml`, Django + Next.js +
Postgres). Rédigé, non exécuté : la bascule réelle sur le VPS reste à faire
par vous — je n'ai pas les identifiants SSH du serveur (secret GitHub
Actions), et c'est une action à fort impact sur un système en production
réelle. Le commentaire déjà présent dans `docker-compose.django.yml` le dit
explicitement : *« Bascule réelle (cutover) seulement après validation
explicite par Gabriel »*.

## 0. Prérequis avant de commencer

- [ ] PR de ce tour de travail mergée dans `main` (finitions Finance/RH/Profil,
      Swagger, nettoyage).
- [ ] `python manage.py test` et `npm run build` verts (déjà vérifié dans ce
      tour de travail — à revérifier si du code a bougé depuis).
- [ ] Validation explicite de Gabriel (ou du responsable désigné) pour lancer
      la bascule — ce n'est pas une décision technique isolée.
- [ ] Fenêtre de maintenance communiquée aux utilisateurs (la bascule implique
      une coupure courte le temps de rediriger nginx).

## 1. Ne PAS modifier `deploy.yml` avant la bascule elle-même

`.github/workflows/deploy.yml` se déclenche sur tout push vers `feat/dev` et
déploie **sans étape de validation manuelle**. Le modifier maintenant pour
pointer vers `docker-compose.django.yml` ferait basculer la prod au prochain
push, avant que la nouvelle stack soit vérifiée en conditions réelles.

**Étape recommandée** : déployer la nouvelle stack manuellement en parallèle
d'abord (ports différents, cf. commentaire dans `docker-compose.django.yml` —
aucun conflit avec la stack Flask actuelle), la valider, *puis seulement*
adapter `deploy.yml` une fois la bascule confirmée stable.

## 2. Premier déploiement manuel de la nouvelle stack (en parallèle, sans couper l'ancienne)

Sur le VPS :

```bash
cd ~/apps/AGT-TASKFLOW2.0   # ou le chemin réel du dépôt sur le serveur
git pull origin main

cp .env.django.example .env.django
# éditer .env.django : SECRET_KEY, POSTGRES_PASSWORD, SUPERADMIN_EMAIL/PASSWORD
# (valeurs différentes de .env de la stack Flask actuelle)

docker compose -f docker-compose.django.yml up -d --build
docker compose -f docker-compose.django.yml ps
```

Au démarrage, `backend_django/entrypoint.sh` applique automatiquement les
migrations Django et crée le superadmin (`bootstrap_superadmin`, idempotent).
Rien de manuel à faire côté base tant qu'on ne migre pas les données
existantes (étape 3).

Vérifier que ça répond (le frontend écoute sur le port 4100, cf.
`docker-compose.django.yml`) :

```bash
curl -sf http://localhost:4100 && echo OK
curl -sf http://localhost:4100/api/docs/ && echo "Swagger OK"   # via le proxy Next -> Django
```

## 3. Migration des données de l'ancienne base

Commande déjà prête : `administration/management/commands/migrate_from_sqlite.py`.
Tourne en **dry-run par défaut** (aucune écriture) — `--commit` est requis
explicitement pour écrire réellement. Génère un rapport de mots de passe
temporaires (un par compte migré, hashes Flask non compatibles Django).

```bash
# 1. Dump de sécurité de la base SQLite actuelle (cf. README, section Clear BD)
docker compose exec backend sh -c 'sqlite3 $DB_PATH .dump' > taskflow_prod_dump.sql
# ou copier directement le fichier .db du volume Docker

# 2. Dry-run — vérifier le résumé (comptes, projets, tâches, etc.) avant d'écrire
docker compose -f docker-compose.django.yml exec api \
  python manage.py migrate_from_sqlite --source /chemin/vers/taskflow.db

# 3. Une fois le résumé validé, écriture réelle
docker compose -f docker-compose.django.yml exec api \
  python manage.py migrate_from_sqlite --source /chemin/vers/taskflow.db --commit \
  --rapport-mdp /backups/mots_de_passe_temporaires.txt
```

- Chaque compte migré reçoit un mot de passe temporaire aléatoire et
  `doit_changer_mdp=True` (redirection forcée vers `/mon-compte` à la première
  connexion, déjà en place côté frontend).
- **Communiquer les mots de passe temporaires hors-bande** (pas par email en
  clair) puis **supprimer le fichier** `mots_de_passe_temporaires.txt` du
  serveur une fois fait.
- La commande est transactionnelle : en cas d'erreur en cours de migration,
  rien n'est écrit.

## 4. Bascule nginx (coupure réelle, courte)

Hors dépôt — à faire sur le serveur : rediriger le reverse-proxy nginx du
domaine de production (`task.ag-technologies.tech`) du port de l'ancien
backend Flask/frontend React vers le port `4100` (nouveau frontend Next.js,
qui proxy lui-même vers l'API Django en interne). Recharger nginx
(`nginx -s reload`), pas de redémarrage brutal.

## 5. Vérification post-bascule

- [ ] Connexion avec un compte migré (mot de passe temporaire) → redirection
      forcée vers changement de mot de passe → OK.
- [ ] Connexion superadmin → dashboard, widgets RH/Finances, `/rbac`.
- [ ] Un projet/tâche migré est visible et cohérent avec l'ancienne interface.
- [ ] `GET /api/docs/` (Swagger) accessible en prod pour vérification rapide
      de l'API si besoin.
- [ ] Sauvegarde automatique (service `backup` du compose Django) tourne bien
      (`docker compose -f docker-compose.django.yml logs backup`).

## 6. Basculer le déploiement automatique (une fois tout validé)

Seulement après le point 5 validé en conditions réelles :
- Modifier `.github/workflows/deploy.yml` pour builder/relancer
  `docker-compose.django.yml` au lieu de `docker-compose.yml`.
- Ou créer un second workflow dédié, le temps de garder l'ancien en filet de
  sécurité un cycle de plus.

## 7. Plan de rollback

Tant que l'ancienne stack (`docker-compose.yml`) n'est pas arrêtée ni son
code supprimé (cf. plan de travail — sa suppression est volontairement la
toute dernière étape, après confirmation que la nouvelle stack tourne
correctement), revenir en arrière ne coûte qu'un changement nginx :

```bash
# Re-pointer nginx vers l'ancien port (Flask/React), reload
nginx -s reload
# La stack Django/Next.js peut continuer de tourner en parallèle sans risque
# (ports différents) pendant l'investigation.
```

Si le rollback intervient après migration des données (étape 3), les
données saisies entre-temps dans la nouvelle stack ne sont pas
rétro-migrées automatiquement — à arbitrer au cas par cas selon la durée
de la fenêtre concernée.
