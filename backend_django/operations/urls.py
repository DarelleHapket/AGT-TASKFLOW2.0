from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views
from .views import BesoinViewSet, NoteViewSet

router = DefaultRouter(trailing_slash=False)
router.register("besoins", BesoinViewSet, basename="besoins")
router.register("notes", NoteViewSet, basename="notes")

urlpatterns = [
    path("besoins-types", views.need_types),
    path("besoins-statuts", views.need_statuses),
    path("ordre-journalier", views.get_daily_order),
    path("ordre-journalier/ajouter", views.set_daily_order),
    path("ordre-journalier/bulk", views.set_daily_order_bulk),
    path("ordre-journalier/<int:pk>", views.delete_daily_order),
    path("performance", views.performance),
] + router.urls
