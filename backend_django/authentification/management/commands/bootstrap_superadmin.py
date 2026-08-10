"""BF-01 du CDC : « un superadmin unique est créé automatiquement au
démarrage de l'application. » Idempotent — ne fait rien si un superadmin
existe déjà. Lu depuis SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD (variables
d'environnement), avec un mot de passe par défaut en dev uniquement."""
import os

from django.core.management.base import BaseCommand

from authentification.models import StatutCompte, User
from authentification.services import assign_role


class Command(BaseCommand):
    help = "Crée le superadmin unique s'il n'existe pas déjà (BF-01)."

    def handle(self, *args, **opts):
        if User.objects.filter(attributionrole__role__code="superadmin").exists():
            self.stdout.write("Superadmin déjà présent — rien à faire.")
            return

        email = os.environ.get("SUPERADMIN_EMAIL", "superadmin@ag-technologies.tech")
        password = os.environ.get("SUPERADMIN_PASSWORD", "ChangeMoi@2026")
        username = email.split("@")[0]

        user, created = User.objects.get_or_create(
            email=email,
            defaults={"username": username, "statut": StatutCompte.ACTIF, "is_active": True,
                      "first_name": "Superadmin", "doit_changer_mdp": True},
        )
        if created:
            user.set_password(password)
            user.save()
        assign_role(user, "superadmin")
        self.stdout.write(self.style.SUCCESS(f"Superadmin prêt : {email} (changement de mot de passe forcé à la 1ʳᵉ connexion)."))
