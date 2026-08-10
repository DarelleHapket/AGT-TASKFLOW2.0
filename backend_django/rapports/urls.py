from django.urls import path

from . import views

urlpatterns = [
    path("rapports/data", views.report_data),
    path("rapports/projet", views.project_report),
]
