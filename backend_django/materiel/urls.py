from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=False)
router.register("materiel/types", views.TypeMaterielViewSet, basename="materiel-types")
router.register("materiel/inventaire", views.MaterielViewSet, basename="materiel-inventaire")
router.register("materiel/mouvements", views.MouvementMaterielViewSet, basename="materiel-mouvements")

urlpatterns = [
    path("materiel/stock", views.stock),
] + router.urls
