from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=False)
router.register("finances/types-mouvement", views.TypeMouvementFinancierViewSet, basename="finances-types-mouvement")
router.register("finances/mouvements", views.MouvementFinancierViewSet, basename="finances-mouvements")
router.register("finances/previsions", views.PrevisionViewSet, basename="finances-previsions")

urlpatterns = [
    path("finances/bilan", views.bilan),
    path("finances/previsions/<int:pk>/ecart", views.prevision_ecart),
    path("finances/rapports", views.creer_rapport),
] + router.urls
