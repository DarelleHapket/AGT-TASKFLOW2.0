from django.urls import path

from . import views

urlpatterns = [
    path("admin/backups", views.list_backups),
    path("admin/backups/creer", views.create_backup),
    path("admin/backups/importer", views.import_backup),
    path("admin/backups/<str:nom>/telecharger", views.download_backup),
    path("admin/backups/<str:nom>", views.delete_backup),
]
