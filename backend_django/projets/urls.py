from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views
from .views import ActiviteViewSet, ProjetViewSet, TacheViewSet

router = DefaultRouter(trailing_slash=False)
router.register("projets", ProjetViewSet, basename="projets")
router.register("activites", ActiviteViewSet, basename="activites")
router.register("taches", TacheViewSet, basename="taches")

urlpatterns = [
    path("difficultes", views.list_difficulties),
    path("difficultes/creer", views.create_difficulty),
    path("difficultes/<int:pk>", views.delete_difficulty),
    path("projets/<int:pid>/membres/<int:mid>", views.membre_projet_detail),
    path("projets/<int:pid>/membres/<int:mid>/permissions", views.membre_projet_permissions_detail),
    path("projets/<int:pid>/membres/<int:mid>/permissions/<str:code>", views.set_membre_projet_permission),
] + router.urls
