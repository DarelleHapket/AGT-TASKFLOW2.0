# Guide fonctionnel — comment ça marche

Ce document répond aux questions « comment on fait X » et « pourquoi Y s'affiche comme ça »
qui reviennent en testant l'appli. Pour les liens/comptes de test, voir
[`GUIDE_PROJET.md`](./GUIDE_PROJET.md).

---

## 1. RH — comment tout s'articule

```
Référentiel (Admin/Superadmin)          Chaque membre                  Employé (optionnel)
─────────────────────────────           ──────────────                 ────────────────────
Compétences, Postes,          ──────►   Profil (créé              ──►  Rattaché à un profil
Équipes, Types de contrat               automatiquement à                existant, jamais
                                         l'activation du compte)          l'inverse (BF-19)
                                         ├─ poste (1 seul)
                                         └─ compétences (plusieurs)       ├─ Contrat (type + dates)
                                                                          └─ Rémunération (montant,
                                                                             périodicité, historique
                                                                             jamais effacé — BNF-07)
```

**Assigner un poste ou des compétences à un membre** (ta question « je n'arrive pas à
modifier la fiche de Josue ») : c'était un vrai trou, corrigé. Sur `/membres`, bouton
**« Fiche »** sur la ligne du membre → **« Modifier le poste / les compétences »** (visible
si tu as la permission `rh.write`, donc Admin/Superadmin). Avant ce correctif, il n'existait
tout simplement aucun écran pour le faire — le champ existait en base mais rien ne l'écrivait.

**Qui voit quoi sur un profil ?**
- **Poste + compétences** : lecture ouverte à tout membre connecté (annuaire d'équipe,
  pas une donnée confidentielle) — accessible via la fiche d'un collègue sur `/membres`.
- **Salaire** : seulement le titulaire (sur `/mon-compte`) et Admin/Superadmin (`rh.employes.gerer`,
  fiche membre). Un chef de projet ou un membre normal ne voit jamais le salaire d'un
  collègue, seulement sa disponibilité si applicable.
- **Écriture** (assigner poste/compétences, créer un employé) : réservée à `rh.write` /
  `rh.employes.gerer` (Admin/Superadmin).

**Créer un employé — le message d'erreur « déjà rattaché »** : ce n'est pas un bug, c'est
la garde-fou BF-19 (un employé référence toujours un profil qui n'a pas déjà d'employé).
Josue et Darelle ont déjà un employé créé (probablement pendant tes tests précédents) —
retente sur un membre qui n'en a pas encore, ou modifie le contrat/salaire existant plutôt
que d'en recréer un. Le formulaire prévient maintenant *avant* la soumission si le membre
choisi est déjà employé, au lieu de faire échouer silencieusement.

**Types de contrat** : ça fonctionnait déjà (vérifié : ajout de « CDI » réussi pendant les
tests). L'endroit est peut-être juste peu visible — `/rh`, onglet **Référentiel**, carte
« TYPES DE CONTRAT » en bas à droite, champ + bouton `+` tout en bas de la carte.

---

## 2. Recrutement — le candidat est hors système

Un **Candidat** (`/rh/recrutement`) n'est **pas un compte utilisateur** — juste un nom et un
contact (téléphone/email) associés à une offre. Il n'a donc **aucun accès à la plateforme**
et ne peut recevoir aucune notification automatique.

**Comment il sait qu'il passe à l'entretien ?** Tu dois le contacter toi-même, en dehors de
l'outil (téléphone, email), en te basant sur le champ « contact » renseigné à sa création. Le
statut (« Reçue » → « Entretien » → « Retenue »/« Refusée ») que tu changes dans l'appli est
une trace **interne** pour l'équipe RH, pas un déclencheur de message vers le candidat.

**Ce qui EST automatique** : dès que tu passes le statut à **« Retenue »**, la plateforme
crée en une seule opération (transaction atomique, BF-49) : le compte utilisateur (avec un
mot de passe temporaire), son profil, son employé, un contrat et une première rémunération.
C'est à ce moment précis que la personne devient un vrai utilisateur du système — avant, elle
n'existe que comme fiche candidat.

---

## 3. Finances — pourquoi les montants sont négatifs et en rouge

Le journal des mouvements (`/finances`) suit une convention comptable standard :
- **Entrée** (vert, `+montant`) = argent qui rentre (vente, financement…).
- **Sortie** (rouge, `-montant`) = argent qui sort — **y compris les salaires**, qui sont
  par définition une dépense pour l'entreprise (BF-26 : chaque rémunération génère
  automatiquement un mouvement « Salaire » en sortie).

Ce n'est pas un jugement sur le salarié, c'est la même convention que sur un relevé bancaire :
un salaire versé est une sortie de trésorerie pour l'entreprise. Si tu préfères ne pas
afficher les mouvements de type « Salaire » dans le journal général (ou les regrouper à
part), c'est un choix de present ation qu'on peut faire — dis-le-moi et je l'implémente.
Le montant stocké en base, lui, est **toujours positif** (`Remuneration.montant`) ; le signe
et la couleur ne sont qu'un affichage.

**Le Bilan** (`/finances/bilan`), sur une période choisie :
- **Entrées** = somme de tous les mouvements de sens « entrée » sur la période.
- **Sorties** = somme de tous les mouvements de sens « sortie » sur la période (dont les
  salaires).
- **Solde** = Entrées − Sorties. Négatif = l'entreprise a dépensé plus qu'elle n'a encaissé
  sur cette période (normal certains mois, à surveiller si ça persiste).

Exemple actuel sur ta base de test : deux salaires (29 + 7777) enregistrés comme sorties,
aucune entrée saisie → solde à -7806. Rien d'anormal, juste aucune vente/entrée enregistrée
pour équilibrer.

---

## 4. Mon compte — ce que chacun peut modifier

Sur `/mon-compte`, accessible à **tout le monde** (pas besoin de permission particulière) :
- **Informations personnelles** : nom affiché, couleur d'avatar — modifiable par tout membre
  à tout moment (nouveau, suite à ta demande).
- **Mon profil** : poste et compétences (lecture seule ici — modification par un Admin/
  Superadmin via la fiche membre, cf. §1), et le salaire si tu es employé.
- **Mot de passe** : changement libre, obligatoire à la première connexion
  (`doit_changer_mdp`) — c'est ce qui protège les mots de passe temporaires (recrutement,
  migration de données) même quand ils sont prévisibles.

L'email et le rôle restent gérés par Admin/Superadmin (`/membres`, `/rbac`) — pas
d'auto-modification possible, pour éviter qu'un compte se donne lui-même plus de droits.

---

## 5. Matériel (Module 2) — maintenant implémenté

Absent jusqu'ici simplement parce que ce n'était pas encore demandé (le travail précédent
portait sur Finance/RH/Profil, modules 3/4). Construit à l'identique du CDC (§4.3, BF-09 à
BF-14) :

- `/materiel` : types de matériel (référentiel), inventaire (nom, description, type, date
  d'achat, projet associé), et un encart stock agrégé par type/par projet.
- `/materiel/mouvements` : journal daté et **non modifiable** (BNF-04) des mouvements —
  achat (entrée en stock), affectation (à un projet ou un employé), retour (remise en stock),
  rebut (sortie définitive). Une correction se fait par un nouveau mouvement inverse, jamais
  en éditant l'existant.
- Le stock d'un matériel (`quantite`) n'est pas saisi à la main : il se met à jour tout seul
  via les mouvements achat (+) et rebut (-). Créer un matériel démarre à 0, il faut un
  mouvement « Achat » pour le faire apparaître en stock.
- Cohérence (BNF-05) : si un matériel est déjà rattaché à un projet, impossible de
  l'affecter à un *autre* projet — le serveur refuse.
- Réservé à Admin/Superadmin (`materiel.read`/`materiel.write`), comme RH et Finances —
  même logique « Ressources de l'entreprise ».
- Encart tableau de bord (BF-14) : stock total, cliquable vers `/materiel`.

---

## 6. Identifiants de démarrage

Le superadmin unique auto-créé au premier démarrage utilise l'email/mot de passe définis par
les variables d'environnement `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` dans `.env.django` —
voir [`GUIDE_PROJET.md`](./GUIDE_PROJET.md) §2 pour la valeur actuelle vérifiée (ne jamais
garder les valeurs par défaut en production, même si le changement de mot de passe est de
toute façon forcé à la première connexion). Aucun autre compte n'est créé automatiquement :
tout membre supplémentaire vient soit d'une inscription (`/login`, formulaire « créer un
compte », validée ensuite par Admin/Superadmin), soit d'un recrutement retenu (§2).

---

## 7. Congés et notes de frais — espace salarié (hors CDC)

Ajouté le 2026-08-10 à la demande explicite du donneur d'ordre, en dehors du périmètre
initial du cahier des charges (à mettre à jour formellement). Même logique RBAC que le reste
du module RH : réservé à Admin/Superadmin pour la validation, ouvert à tout employé pour ses
propres demandes.

**Poser une demande** — `/mon-compte`, sections « Mes congés » / « Mes notes de frais »
(visibles seulement si tu es rattaché à un `Employe`, cf. §1) :
- **Congé** : date de début, date de fin, motif optionnel.
- **Note de frais** : montant, motif, date de la dépense.
- La demande part au statut **« En attente »**. Tu peux l'**annuler** tant qu'elle est en
  attente (bouton « Annuler » sur ta propre carte) — une fois validée ou refusée, elle reste
  dans l'historique, non modifiable.

**Valider / refuser** — `/rh`, onglet « Congés & notes de frais » (visible seulement avec la
permission `rh.conges.gerer` / `rh.notes_frais.gerer`, Admin/Superadmin) : liste de toutes les
demandes, boutons Valider/Refuser avec un commentaire optionnel. La personne reçoit une
notification quand sa demande est traitée.

**Ce qui n'existe pas** : pas de solde de congés (jours restants, calcul automatique), pas de
justificatif joint à une note de frais (photo/PDF) — la déclaration est purement textuelle
pour l'instant. À construire si le besoin se confirme.

---

## 8. Fiche de paie et historique de carrière

Sur `/mon-compte`, à côté du salaire actuel (§1) : bouton **« Fiche de paie »** qui génère un
PDF côté client (même principe que le bilan financier — rien n'est stocké côté serveur, le
PDF est recréé à chaque téléchargement à partir des données actuelles). En dessous, **«
Historique de carrière »** liste tous les contrats et rémunérations passés de l'employé (pas
seulement le contrat en cours) — cette donnée existait déjà en base (`BNF-07`, historique
jamais effacé) mais n'était affichée nulle part avant.

---

## 9. Rôles & permissions — catalogue (`/rbac`)

En plus du tableau par membre (bascule des rôles/permissions individuelles, voir §10), la
page `/rbac` permet de gérer le **catalogue** lui-même :
- **Rôles** : créer un nouveau rôle, le supprimer (sauf `superadmin`), cliquer un badge de
  permission sur un rôle pour l'ajouter/retirer de ses permissions **par défaut** — ce sont
  celles copiées automatiquement à toute personne à qui ce rôle est attribué ensuite (BF-05).
- **Permissions** : créer une nouvelle permission via deux champs **Verbe** + **Ressource**
  (ex. `gerer` + `conges` → code `gerer:conges`), la supprimer. Ce style verbe:ressource
  s'applique aux **nouvelles** permissions créées depuis ce formulaire ; les permissions
  historiques du système (`rh.write`, `membres.validate`, etc., style `ressource.verbe`) n'ont
  pas été renommées — coexistence des deux styles, aucun impact fonctionnel.

**Important — changer le rôle de quelqu'un met à jour ses permissions.** Retirer un rôle
retire aussi les permissions que *ce rôle précis* avait données (sauf si un autre rôle actif
de la personne les accorde encore, ou si elles ont été accordées/retirées **directement** —
ça reste indépendant). Corrigé le 2026-08-10 : avant, les permissions de rôle restaient
accrochées indéfiniment après un changement de rôle.

---

## 10. Membres — permissions cochables par carte (`/membres`)

Chaque carte de membre actif (sauf Superadmin, qui a un accès total non modifiable) affiche,
visible uniquement par le Superadmin :
- **Rôles** : badges cliquables pour ajouter/retirer un rôle à la personne (le rôle Admin est
  unique — grisé si déjà attribué à quelqu'un d'autre).
- **Permissions directes** : badges cliquables, regroupés par module (RH, Finances, Matériel,
  Pilotage…) pour la lisibilité, pour accorder/retirer une permission indépendamment du rôle
  (IBAC).

---

## 11. Tâches — mode Tableau et allègement de la liste

Sur `/taches`, un toggle **Liste / Tableau** en haut de page :
- **Liste** (inchangé) : groupement Projet → Activité.
- **Tableau** (nouveau) : colonnes par membre (kanban), avec compteur « X fait(s) · X
  bloqué(s) » par colonne.

Chaque ligne de tâche a été allégée pour ressembler à team-tool : titre, assigné, statut,
bouton ouvrir. Les badges ID/critique/difficultés et le détail ES/EF/marge ont été retirés de
la liste (ils restent visibles dans le détail de la tâche et sur `/pert`/`/gantt`). Le bouton
Supprimer reste présent, réservé au créateur de la tâche ou à l'owner/manager du projet.

---

## 12. PERT / Gantt — un seul lien de menu, un toggle

Le lien de menu « PERT / Gantt » (`/gantt`) ouvre maintenant un toggle en haut de page pour
basculer entre les deux vues, au lieu de ne montrer que le Gantt :
- **Gantt** : timeline en coupons (inchangé).
- **PERT** : table éditable (# / Nom / Prédécesseurs / Durée / Statut / Marge / Supprimer) +
  pastilles « Durée du projet »/« Tâches critiques » + export JSON, au-dessus du diagramme
  réseau (chemin critique, ES/EF/LS/LF par tâche).

Contrairement à team-tool, il n'y a pas de catalogue de statuts PERT personnalisable par
projet (« Gérer les statuts ») — AGT n'a qu'un seul statut par tâche, partagé avec la page
Tâches (à faire/en cours/terminée/bloquée).
