from django.contrib import admin

from .models import Materiel, MouvementMateriel, TypeMateriel

admin.site.register(TypeMateriel)
admin.site.register(Materiel)
admin.site.register(MouvementMateriel)
