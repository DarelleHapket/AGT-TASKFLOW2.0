# Document de Conception — v1.0

## AGT ERP : Module 3 — Profils & Ressources Humaines et Module 4 — Finances

| | |
|---|---|
| **Auteure** | Hapket Darelle (cheffe d'équipe) |
| **Encadrant** | NOMO BODIANGA Gabriel |
| **Base** | `Document_Analyse_Module3-4_v1.1.md` |
| **Version** | 1.0 |
| **Statut** | Document de conception — précède l'implémentation |

---

## 0. Cadrage

Ce document conçoit deux apps Django nouvelles, `rh` (Module 3) et `finances` (Module 4), sur le socle déjà en place (`authentification` pour RBAC + IBAC, `notifications` pour la cloche, `projets` pour la hiérarchie projet/activité/tâche). Il suit exactement les conventions déjà établies dans le projet (voir `backend_django/authentification`, `projets`, `operations`) plutôt que d'introduire un nouveau style : apps nommées en français, modèles français, permissions du type `module.action`, `HasPerm(code)` comme fabrique de permission DRF, ViewSet DRF + `path()` explicites pour les actions hors CRUD standard.

Les deux apps sont conçues ensemble (comme le Document d'Analyse) car `finances` référence directement `Remuneration` (app `rh`) pour BF-26 — mais restent deux apps Django distinctes, livrables indépendamment (S3 puis S4) comme l'exige le CDC (« chaque module est livré complet et montrable chaque vendredi »).

---

# Partie I — App `rh` (Module 3)

## 1. Structure

```
backend_django/rh/
├── models.py
├── serializers.py
├── views.py
├── acces.py          # IBAC : visibilité disponibilité par chef de projet (BF-23)
├── urls.py
├── admin.py
├── migrations/
│   ├── 0001_initial.py
│   └── 0002_seed_rh_permissions.py
└── tests.py
```

`rh` est ajoutée à `INSTALLED_APPS` (`config/settings.py`) et montée dans `config/urls.py` via `path('api/', include('rh.urls'))`, à la suite de `pilotage_stage`.

## 2. Modèles (`rh/models.py`)

Directement dérivés du diagramme de classes corrigé (Document d'Analyse §6). `Utilisateur` est le modèle `authentification.User` déjà existant — pas de duplication.

```python
from django.conf import settings
from django.db import models


class Competence(models.Model):
    nom = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)


class Poste(models.Model):
    nom = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)


class Responsabilite(models.Model):
    poste = models.ForeignKey(Poste, on_delete=models.CASCADE, related_name="responsabilites")
    nom = models.CharField(max_length=150)
    competences_requises = models.ManyToManyField(Competence, blank=True, related_name="responsabilites")


class Equipe(models.Model):
    """BF-18 — structurelle et transversale, indépendante de projets.MembreProjet."""
    nom = models.CharField(max_length=100)
    membres = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="equipes")


class Profil(models.Model):
    """Créé automatiquement à l'activation d'un compte (signal post_save côté
    authentification.User, statut=ACTIF) — BF-15 : chaque membre a un profil."""
    utilisateur = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profil")
    poste = models.ForeignKey(Poste, null=True, blank=True, on_delete=models.SET_NULL, related_name="profils")
    competences = models.ManyToManyField(Competence, blank=True, related_name="profils")


class Employe(models.Model):
    """BF-19 : rattaché à un profil qui existe déjà — association, pas héritage
    (cf. Document d'Analyse §6.1)."""
    profil = models.OneToOneField(Profil, on_delete=models.CASCADE, related_name="employe")
    date_embauche = models.DateField()


class TypeContrat(models.Model):
    nom = models.CharField(max_length=50, unique=True)  # CDI, CDD, Stage...
    description = models.CharField(max_length=255, blank=True)


class Contrat(models.Model):
    employe = models.ForeignKey(Employe, on_delete=models.CASCADE, related_name="contrats")
    type_contrat = models.ForeignKey(TypeContrat, on_delete=models.PROTECT, related_name="contrats")
    date_debut = models.DateField()
    date_fin = models.DateField(null=True, blank=True)


class Periodicite(models.TextChoices):
    MENSUELLE = "mensuelle", "Mensuelle"
    HEBDOMADAIRE = "hebdomadaire", "Hebdomadaire"
    JOURNALIERE = "journaliere", "Journalière"


class Remuneration(models.Model):
    """BF-21 / BNF-07 : historique protégé — jamais modifiée ni supprimée après
    création (cf. TypeMouvementFinancier.destroy pour le même principe côté
    finances). Un nouveau contrat ou un renouvellement crée une nouvelle ligne."""
    contrat = models.ForeignKey(Contrat, on_delete=models.CASCADE, related_name="remunerations")
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    periodicite = models.CharField(max_length=20, choices=Periodicite.choices)
    cree_le = models.DateTimeField(auto_now_add=True)


class StatutDisponibilite(models.TextChoices):
    DISPONIBLE = "disponible", "Disponible"
    INDISPONIBLE = "indisponible", "Indisponible"


class Disponibilite(models.Model):
    employe = models.ForeignKey(Employe, on_delete=models.CASCADE, related_name="disponibilites")
    statut = models.CharField(max_length=20, choices=StatutDisponibilite.choices)
    periode_debut = models.DateField()
    periode_fin = models.DateField(null=True, blank=True)


class OffreEmploi(models.Model):
    poste = models.ForeignKey(Poste, on_delete=models.CASCADE, related_name="offres")
    description = models.TextField(blank=True)
    statut = models.CharField(max_length=20, default="ouverte")


class StatutCandidature(models.TextChoices):
    RECUE = "recue", "Reçue"
    ENTRETIEN = "entretien", "Entretien"
    RETENUE = "retenue", "Retenue"
    REFUSEE = "refusee", "Refusée"


class Candidat(models.Model):
    offre = models.ForeignKey(OffreEmploi, on_delete=models.CASCADE, related_name="candidats")
    nom = models.CharField(max_length=150)
    contact = models.CharField(max_length=150)
    cv = models.FileField(upload_to="candidatures/", blank=True, null=True)
    statut = models.CharField(max_length=20, choices=StatutCandidature.choices, default=StatutCandidature.RECUE)


class Formation(models.Model):
    nom = models.CharField(max_length=150)
    description = models.CharField(max_length=255, blank=True)
    competences_visees = models.ManyToManyField(Competence, blank=True, related_name="formations")


class StatutInscriptionFormation(models.TextChoices):
    PREVUE = "prevue", "Prévue"
    EN_COURS = "en_cours", "En cours"
    TERMINEE = "terminee", "Terminée"


class InscriptionFormation(models.Model):
    employe = models.ForeignKey(Employe, on_delete=models.CASCADE, related_name="inscriptions_formation")
    formation = models.ForeignKey(Formation, on_delete=models.CASCADE, related_name="inscriptions")
    statut = models.CharField(max_length=20, choices=StatutInscriptionFormation.choices,
                               default=StatutInscriptionFormation.PREVUE)


class StatutSignalement(models.TextChoices):
    OUVERT = "ouvert", "Ouvert"
    TRAITE = "traite", "Traité"


class Signalement(models.Model):
    """BNF-18 : visible uniquement par Admin et Superadmin — appliqué au niveau
    du queryset (SignalementViewSet.get_queryset), pas d'un champ visibilite."""
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="signalements")
    description = models.TextField()
    statut = models.CharField(max_length=20, choices=StatutSignalement.choices, default=StatutSignalement.OUVERT)
    cree_le = models.DateTimeField(auto_now_add=True)
```

## 3. Règles métier et points d'intégration

### 3.1 Création automatique du `Profil` (BF-15)

Un `Profil` doit exister pour **tout** utilisateur, sans action manuelle. Implémenté via un signal Django plutôt que dans chaque point d'entrée qui active un compte (validation Module 1, recrutement Module 3) :

```python
# rh/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from authentification.models import User, StatutCompte
from .models import Profil

@receiver(post_save, sender=User)
def creer_profil_si_actif(sender, instance, **kwargs):
    if instance.statut == StatutCompte.ACTIF:
        Profil.objects.get_or_create(utilisateur=instance)
```

Cela couvre à la fois `validate_member` (Module 1, approbation d'une demande) et le flux de recrutement (§3.2) sans dupliquer la logique de création.

### 3.2 Recrutement → création automatique (BF-49, BNF-17)

Quand une `Candidat.statut` passe à `RETENUE`, une méthode `services.embaucher(candidat)` :
1. crée un `User` (statut `ACTIF`, `doit_changer_mdp=True`, mot de passe temporaire — même mécanisme que `migrate_from_sqlite`/`bootstrap_superadmin`, cf. Module 1) ;
2. déclenche la création du `Profil` via le signal §3.1 ;
3. crée l'`Employe` rattaché à ce profil ;
4. crée le premier `Contrat` et sa `Remuneration` à partir des informations de l'offre/candidature.

Tout se passe dans une transaction unique (`@transaction.atomic`) : soit les quatre objets sont créés, soit aucun (cohérence BNF-17 — jamais de compte orphelin sans profil/employé si la candidature est retenue).

### 3.3 Formation terminée → compétences ajoutées (BF-52)

Dans `InscriptionFormationViewSet.update`, quand `statut` passe à `TERMINEE` : `employe.profil.competences.add(*formation.competences_visees.all())`. Idempotent (un `ManyToManyField.add()` répété ne duplique rien).

### 3.4 Visibilité disponibilité par le chef de projet (BF-23)

Réutilise **exactement** le mécanisme IBAC du Module 1 (`PermissionEffective`, `source='direct'`) plutôt que d'introduire un nouveau système de permission par projet. Quand un chef de projet ajoute un membre à son équipe projet (`projets.MembreProjet`), une permission directe `rh.disponibilite.voir_projet.<id_projet>` (ou équivalent scopé) peut lui être accordée via `authentification.services.grant_permission`. Le détail de ce scoping est laissé à l'implémentation (première itération : le chef de projet voit la disponibilité de tout membre de ses propres projets, vérifié via `projets.acces.get_user_project_ids`, sans permission dédiée par membre — plus simple, conforme à BF-23 qui ne demande que la lecture de disponibilité, jamais les montants).

## 4. Permissions (extension du catalogue RBAC, migration `0002_seed_rh_permissions.py`)

| Code | Module | Description | Admin | Superadmin |
|---|---|---|---|---|
| `rh.read` | rh | Consulter le référentiel (compétences, postes, équipes) | ✓ | ✓ |
| `rh.write` | rh | Gérer le référentiel RH | ✓ | ✓ |
| `rh.employes.gerer` | rh | Créer employés, contrats, rémunérations | ✓ | ✓ |
| `rh.disponibilite.gerer` | rh | Modifier la disponibilité de n'importe quel employé | ✓ | ✓ |
| `rh.recrutement.gerer` | rh | Gérer offres, candidats, décisions | ✓ | ✓ |
| `rh.formations.gerer` | rh | Gérer catalogue et inscriptions | ✓ | ✓ |
| `rh.signalements.traiter` | rh | Consulter/traiter les signalements | ✓ | ✓ |

Membre et Chef de projet n'obtiennent aucune de ces permissions (§2 du Document d'Analyse : Chef de projet agit comme un Membre ordinaire dans ce module). L'auto-consultation de son propre salaire/disponibilité (BNF-09 révisé) et la création d'un signalement (BF-53) sont des vérifications de **propriété des données** (`request.user == profil.utilisateur` ou `request.user == signalement.auteur`), pas des permissions RBAC — cohérent avec la distinction déjà établie en Module 1 entre RBAC et contrôle d'appartenance.

## 5. API (`rh/urls.py`)

| Méthode | Chemin | Permission | Description |
|---|---|---|---|
| GET/POST | `/api/rh/competences` | `rh.read` / `rh.write` | Catalogue compétences |
| GET/POST | `/api/rh/postes` | `rh.read` / `rh.write` | Catalogue postes + responsabilités |
| GET/POST | `/api/rh/equipes` | `rh.read` / `rh.write` | Équipes |
| GET | `/api/rh/profils/moi` | `IsAuthenticated` | Mon profil (compétences, poste) |
| GET | `/api/rh/profils/<id>` | `rh.read` | Profil d'un membre (RH) |
| POST | `/api/rh/employes` | `rh.employes.gerer` | Créer employé + contrat + rémunération (UC §4) |
| GET | `/api/rh/employes/moi/salaire` | `IsAuthenticated` | Mon salaire + historique (BNF-09 révisé) |
| GET | `/api/rh/employes/<id>/salaire` | `rh.employes.gerer` | Salaire d'un autre employé |
| GET/PUT | `/api/rh/disponibilites` | `IsAuthenticated` (soi) / `rh.disponibilite.gerer` (autrui) | Disponibilité |
| GET/POST | `/api/rh/offres` | `rh.recrutement.gerer` | Offres d'emploi |
| GET/POST/PATCH | `/api/rh/candidats` | `rh.recrutement.gerer` | Candidats, `PATCH statut` déclenche §3.2 si `retenue` |
| GET/POST | `/api/rh/formations` | `rh.read` / `rh.formations.gerer` | Catalogue formations |
| GET/POST/PATCH | `/api/rh/inscriptions-formation` | `rh.formations.gerer` | Inscriptions, `PATCH statut` déclenche §3.3 si `terminee` |
| GET/POST | `/api/rh/signalements` | `IsAuthenticated` (créer) / `rh.signalements.traiter` (lister/traiter) | Signalements — queryset restreint pour non-Admin à ses propres signalements créés |

---

# Partie II — App `finances` (Module 4)

## 6. Structure

```
backend_django/finances/
├── models.py
├── serializers.py
├── views.py
├── services.py       # génération auto BF-26, calcul bilan BF-27, écart prévision BF-28
├── urls.py
├── migrations/
│   ├── 0001_initial.py
│   └── 0002_seed_finances_permissions.py
└── tests.py
```

## 7. Modèles (`finances/models.py`)

`Bilan` n'existe pas comme modèle (Document d'Analyse §11 — non persisté, calculé à la volée). `RapportFinancier` est un journal de génération, pas le contenu du fichier (cohérent avec le module `rapports` existant, où le PDF/TXT est généré côté client).

```python
from django.conf import settings
from django.db import models
from rh.models import Remuneration
from projets.models import Projet


class SensMouvement(models.TextChoices):
    ENTREE = "entree", "Entrée"
    SORTIE = "sortie", "Sortie"


class TypeMouvementFinancier(models.Model):
    nom = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    sens = models.CharField(max_length=10, choices=SensMouvement.choices)


class NiveauFinancier(models.TextChoices):
    ENTREPRISE = "entreprise", "Entreprise"
    PROJET = "projet", "Projet"
    EMPLOYE = "employe", "Employé"


class MouvementFinancier(models.Model):
    """BNF-10 : non modifiable, non supprimable après création — voir
    MouvementFinancierViewSet (update/destroy désactivés, §9)."""
    type_mouvement = models.ForeignKey(TypeMouvementFinancier, on_delete=models.PROTECT, related_name="mouvements")
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    date_mouvement = models.DateTimeField(auto_now_add=True)
    niveau = models.CharField(max_length=20, choices=NiveauFinancier.choices)
    projet = models.ForeignKey(Projet, null=True, blank=True, on_delete=models.SET_NULL, related_name="mouvements_financiers")
    employe = models.ForeignKey("rh.Employe", null=True, blank=True, on_delete=models.SET_NULL, related_name="mouvements_financiers")
    remuneration = models.ForeignKey(Remuneration, null=True, blank=True, on_delete=models.SET_NULL, related_name="mouvements_generes")

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(niveau="entreprise", projet__isnull=True, employe__isnull=True)
                    | models.Q(niveau="projet", projet__isnull=False, employe__isnull=True)
                    | models.Q(niveau="employe", employe__isnull=False)
                ),
                name="mouvement_niveau_coherent",
            )
        ]


class Prevision(models.Model):
    periode_debut = models.DateField()
    periode_fin = models.DateField()
    montant_prevu = models.DecimalField(max_digits=12, decimal_places=2)
    niveau = models.CharField(max_length=20, choices=NiveauFinancier.choices)
    projet = models.ForeignKey(Projet, null=True, blank=True, on_delete=models.SET_NULL, related_name="previsions")
    employe = models.ForeignKey("rh.Employe", null=True, blank=True, on_delete=models.SET_NULL, related_name="previsions")


class FormatRapport(models.TextChoices):
    PDF = "pdf", "PDF"
    TXT = "txt", "TXT"


class RapportFinancier(models.Model):
    genere_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rapports_financiers")
    format = models.CharField(max_length=5, choices=FormatRapport.choices)
    periode_debut = models.DateField()
    periode_fin = models.DateField()
    genere_le = models.DateTimeField(auto_now_add=True)
```

La contrainte `mouvement_niveau_coherent` fait respecter en base la règle « niveau ↔ FK renseignée » identifiée comme manquante dans le cahier v1.0 (Document d'Analyse §11) — pas seulement une vérification côté serializer, qui pourrait être contournée par un accès direct à l'ORM.

## 8. Génération automatique (BF-26) — `finances/services.py`

```python
from notifications.services import notify
from .models import MouvementFinancier, TypeMouvementFinancier, NiveauFinancier, SensMouvement

def generer_mouvement_salarial(remuneration):
    """Appelé depuis rh/services.py::embaucher() et depuis le renouvellement
    de contrat — jamais depuis une action Admin directe côté finances (cf.
    Document d'Analyse §5.2, cas d'utilisation système)."""
    type_sortie, _ = TypeMouvementFinancier.objects.get_or_create(
        nom="Salaire", defaults={"sens": SensMouvement.SORTIE}
    )
    MouvementFinancier.objects.create(
        type_mouvement=type_sortie, montant=remuneration.montant,
        niveau=NiveauFinancier.EMPLOYE, employe=remuneration.contrat.employe,
        remuneration=remuneration,
    )
```

Appelé en fin de transaction dans `rh/services.py::embaucher()` (§3.2) — couplage explicite et assumé entre les deux apps, documenté ici plutôt que caché dans un signal implicite, pour rester traçable (BNF-12 : lien automatique, mais pas invisible).

## 9. Immutabilité (BNF-10) — `finances/views.py`

```python
class MouvementFinancierViewSet(viewsets.ModelViewSet):
    queryset = MouvementFinancier.objects.select_related("type_mouvement", "projet", "employe")
    serializer_class = MouvementFinancierSerializer
    permission_classes = [HasPerm("finances.mouvements.gerer")]

    def update(self, request, *args, **kwargs):
        return Response({"error": "Un mouvement financier ne peut pas être modifié (BNF-10)."}, status=405)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Un mouvement financier ne peut pas être supprimé (BNF-10)."}, status=405)
```

Même principe que `RemunerationViewSet` côté `rh` (BNF-07) : `create`/`list`/`retrieve` autorisés, `update`/`destroy` bloqués à 405 plutôt que 403, pour signaler clairement au client qu'aucun rôle n'y changerait jamais rien (contrairement à un 403, qui suggère un problème de permission contournable).

## 10. Calcul du bilan et des prévisions (BF-27, BF-28) — non persisté

```python
# finances/services.py
def calculer_bilan(date_from, date_to, niveau=None, projet_id=None, employe_id=None):
    qs = MouvementFinancier.objects.filter(date_mouvement__date__range=(date_from, date_to))
    if niveau: qs = qs.filter(niveau=niveau)
    if projet_id: qs = qs.filter(projet_id=projet_id)
    if employe_id: qs = qs.filter(employe_id=employe_id)
    entrees = qs.filter(type_mouvement__sens=SensMouvement.ENTREE).aggregate(Sum("montant"))["montant__sum"] or 0
    sorties = qs.filter(type_mouvement__sens=SensMouvement.SORTIE).aggregate(Sum("montant"))["montant__sum"] or 0
    return {"entrees": entrees, "sorties": sorties, "solde": entrees - sorties}
```

Exposé via `GET /api/finances/bilan?date_from=...&date_to=...` (function-based view `@api_view(["GET"])`, comme `rapports/views.py::report_data`, pas un ViewSet — il n'y a rien à créer/modifier, seulement une lecture calculée).

## 11. Permissions (migration `0002_seed_finances_permissions.py`)

| Code | Description | Admin | Superadmin | Membre / Chef de projet |
|---|---|---|---|---|
| `finances.mouvements.gerer` | Enregistrer un mouvement financier | ✓ | ✓ | — |
| `finances.bilan.voir` | Générer/consulter le bilan | ✓ | ✓ | — |
| `finances.previsions.gerer` | Créer/consulter les prévisions | ✓ | ✓ | — |
| `finances.rapports.telecharger` | Générer un rapport PDF/TXT | ✓ | ✓ | — |

Aucune permission finances n'est accordée à Membre ou Chef de projet, même par défaut de rôle — conforme à la décision actée en Document d'Analyse §8 (« les finances concernent exclusivement le dirigeant »).

## 12. API (`finances/urls.py`)

| Méthode | Chemin | Permission | Description |
|---|---|---|---|
| GET/POST | `/api/finances/types-mouvement` | `finances.mouvements.gerer` | Types de mouvement |
| GET/POST | `/api/finances/mouvements` | `finances.mouvements.gerer` | Journal (update/destroy → 405) |
| GET | `/api/finances/bilan` | `finances.bilan.voir` | Bilan calculé sur une période |
| GET/POST | `/api/finances/previsions` | `finances.previsions.gerer` | Prévisions + écart au réel |
| POST | `/api/finances/rapports` | `finances.rapports.telecharger` | Enregistre le journal de génération, renvoie les données pour le PDF/TXT client |

---

# Partie III — Frontend (Next.js)

## 13. Sidebar

Les entrées « RH & Profils » et « Finances » (`Sidebar.tsx`, section « Ressources de l'entreprise ») perdent leur badge `comingSoon` et pointent vers `/rh` et `/finances`, gérées par la permission correspondante (`permission: "rh.read"` / `permission: "finances.bilan.voir"`) — même mécanisme de garde que les autres entrées déjà en place.

## 14. Pages prévues

| Route | Contenu | Miroir de |
|---|---|---|
| `/rh` | Référentiel (compétences, postes, équipes) + liste employés | `RBACView.tsx` (deux colonnes catalogue/gestion) |
| `/rh/[id]` ou modale | Fiche employé : contrats, rémunération, disponibilité, formations | `TaskModal.tsx` (fiche détaillée) |
| `/rh/recrutement` | Offres + candidats + pipeline de statut | `TeamView.tsx` (sections par statut) |
| `/rh/signalements` | Liste des signalements (Admin/Superadmin uniquement) | `NeedsView.tsx` (liste + statut) |
| `/finances` | Journal des mouvements + formulaire d'ajout | `NotesView.tsx` (liste + formulaire inline) |
| `/finances/bilan` | Sélecteur de période + solde + graphique simple | `PerformanceView.tsx` (sélecteur période + cartes) |
| Dashboard | Encart RH (BF-24) et encart Finances (BF-31) | `WidgetsGlobaux`/`WidgetsAVenir` (remplacent les widgets « à venir » S2-S4) |

Chaque page suit la convention déjà établie sur tout le reste de l'app : styles inline avec les variables CSS partagées (`var(--bg-card)`, `var(--accent)`...), pas de nouvelle bibliothèque UI, cartes de stats sur le dashboard cliquables vers la page filtrée correspondante (même principe que les widgets Membres/Projets déjà en place).

## 15. Ordre d'implémentation recommandé

1. `rh` : modèles + migrations + permissions + signal `Profil` → tests.
2. `rh` : API référentiel (compétences/postes/équipes) + employés/contrats/rémunérations → tests.
3. `rh` : recrutement (BF-49, transaction atomique) → tests dédiés au flux bout-en-bout candidat → employé.
4. `rh` : formations + signalements → tests.
5. `finances` : modèles + migration + permissions (dépend de `rh.Remuneration`, donc après l'étape 2).
6. `finances` : génération automatique BF-26 (appelée depuis `rh/services.py::embaucher`) → test d'intégration croisé `rh`/`finances`.
7. `finances` : bilan, prévisions, rapports.
8. Frontend : sidebar + pages, dans le même ordre (RH avant Finances).

Chaque étape se valide comme le reste du projet : `python manage.py test` par app, `tsc --noEmit` + `next build` côté frontend, avant de passer à la suivante — pas de développement des deux apps en parallèle sans tests intermédiaires, pour ne pas répéter la dette accumulée puis corrigée sur les modules précédents.

---

*Document de conception — Module 3 (Profils & RH) et Module 4 (Finances) — AGT ERP — version 1.0 — Hapket Darelle.*
