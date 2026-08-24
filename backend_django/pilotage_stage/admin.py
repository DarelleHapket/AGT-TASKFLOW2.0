from django.contrib import admin

from .models import Branch, Edge, Node, PertStatut, PertTask, Sollicitation, SousTache, Tache, Transition

for m in (Branch, Edge, Node, PertStatut, PertTask, Sollicitation, SousTache, Tache, Transition):
    admin.site.register(m)
