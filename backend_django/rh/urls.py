from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=False)
router.register("rh/competences", views.CompetenceViewSet, basename="rh-competences")
router.register("rh/postes", views.PosteViewSet, basename="rh-postes")
router.register("rh/responsabilites", views.ResponsabiliteViewSet, basename="rh-responsabilites")
router.register("rh/equipes", views.EquipeViewSet, basename="rh-equipes")
router.register("rh/types-contrat", views.TypeContratViewSet, basename="rh-types-contrat")
router.register("rh/disponibilites", views.DisponibiliteViewSet, basename="rh-disponibilites")
router.register("rh/offres", views.OffreEmploiViewSet, basename="rh-offres")
router.register("rh/candidats", views.CandidatViewSet, basename="rh-candidats")
router.register("rh/formations", views.FormationViewSet, basename="rh-formations")
router.register("rh/inscriptions-formation", views.InscriptionFormationViewSet, basename="rh-inscriptions-formation")
router.register("rh/signalements", views.SignalementViewSet, basename="rh-signalements")
router.register("rh/conges", views.CongeViewSet, basename="rh-conges")
router.register("rh/notes-frais", views.NoteFraisViewSet, basename="rh-notes-frais")

urlpatterns = [
    path("rh/profils/moi", views.mon_profil),
    path("rh/profils/par-utilisateur", views.profil_par_utilisateur),
    path("rh/profils/<int:pk>", views.profil_detail),
    path("rh/employes", views.employes),
    path("rh/employes/moi/salaire", views.mon_salaire),
    path("rh/employes/<int:pk>/salaire", views.salaire_employe),
    path("rh/employes/<int:pk>/remuneration", views.changer_remuneration),
    path("rh/fiches-paie/moi", views.mes_fiches_paie),
] + router.urls
