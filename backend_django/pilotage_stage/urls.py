from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=False)
router.register("pilotage/branches", views.BranchViewSet, basename="pilotage-branches")
router.register("pilotage/sous-taches", views.SousTacheViewSet, basename="pilotage-sous-taches")
router.register("pilotage/pert/tasks", views.PertTaskViewSet, basename="pilotage-pert-tasks")
router.register("pilotage/pert/statuts", views.PertStatutViewSet, basename="pilotage-pert-statuts")
router.register("pilotage/taches", views.TacheViewSet, basename="pilotage-taches")

urlpatterns = [
    path("pilotage/arbre/export", views.export_arbre),
    path("pilotage/pert/export", views.export_pert),
] + router.urls
