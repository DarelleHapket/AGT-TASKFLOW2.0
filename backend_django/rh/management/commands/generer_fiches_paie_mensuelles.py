"""BF-26/BF-54 : cron mensuel — sortie salariale automatique + fiche de paie
pour chaque contrat actif. Idempotent (contrainte unique sur FichePaie) —
peut être relancée sans risque de doublon."""
from django.core.management.base import BaseCommand

from rh.services import generer_paie_mensuelle


class Command(BaseCommand):
    help = "Génère les mouvements financiers de sortie salariale et les fiches de paie du mois (BF-26/BF-54)."

    def handle(self, *args, **opts):
        fiches = generer_paie_mensuelle()
        if fiches:
            self.stdout.write(self.style.SUCCESS(f"{len(fiches)} fiche(s) de paie générée(s)."))
        else:
            self.stdout.write("Rien à générer ce mois-ci.")
