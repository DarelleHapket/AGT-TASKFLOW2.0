from django.urls import path

from . import views

urlpatterns = [
    path("notifications", views.list_notifications, name="notifications-list"),
    path("notifications/<int:pk>/read", views.mark_read),
    path("notifications/read-all", views.mark_all_read),
    path("notifications/<int:pk>/delete", views.delete_notification),
    path("notifications/delete-all", views.delete_all_notifications),
]
