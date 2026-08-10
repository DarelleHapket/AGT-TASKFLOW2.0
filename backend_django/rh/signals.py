"""BF-15 : chaque membre a un profil, créé automatiquement à l'activation du
compte — jamais à la main (couvre à la fois la validation Module 1 et
l'embauche directe via recrutement, cf. services.py::embaucher)."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from authentification.models import StatutCompte, User


@receiver(post_save, sender=User)
def creer_profil_si_actif(sender, instance, **kwargs):
    if instance.statut != StatutCompte.ACTIF:
        return
    from .models import Profil
    Profil.objects.get_or_create(utilisateur=instance)
