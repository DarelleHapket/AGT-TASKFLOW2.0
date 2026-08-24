from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter(trailing_slash=False)
router.register("membres", views.MembreViewSet, basename="membres")
router.register("roles", views.RoleViewSet, basename="roles")
router.register("permissions", views.PermissionViewSet, basename="permissions")

urlpatterns = [
    path("auth/login", views.login),
    path("auth/register", views.register),
    path("auth/token/refresh", TokenRefreshView.as_view()),
    path("auth/me", views.me),
    path("auth/changer-mdp", views.changer_mdp),
    path("membres/<int:pk>/validate", views.validate_member),
    path("membres/<int:pk>/toggle-active", views.toggle_active),
    path("rbac/membres/<int:pk>/roles", views.assign_member_role),
    path("rbac/membres/<int:pk>/roles/<str:role_code>", views.revoke_member_role),
    path("rbac/membres/<int:pk>/permissions", views.member_permissions_detail),
    path("rbac/membres/<int:pk>/permissions/<str:perm_code>", views.set_member_permission),
] + router.urls
