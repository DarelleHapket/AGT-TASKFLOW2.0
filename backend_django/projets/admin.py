from django.contrib import admin

from .models import Activite, Difficulte, MembreProjet, Projet, Tache

admin.site.register(Projet)
admin.site.register(MembreProjet)
admin.site.register(Activite)
admin.site.register(Tache)
admin.site.register(Difficulte)
