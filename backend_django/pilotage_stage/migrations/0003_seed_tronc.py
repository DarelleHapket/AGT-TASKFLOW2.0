"""Seed du gabarit 'tronc' (workflow commun) — port de team-tool
backend/seeds/arbre.json (branche 'tronc' uniquement ; les branches A/B/C/D
spécifiques au stage de team-tool ne sont pas reprises, l'équipe pourra les
recréer via l'API si besoin)."""
from django.db import migrations

NODES = [
    (1, "start", "À faire", 80, 260, False, "Le livrable existe, pas encore commencé."),
    (2, "work", "En cours", 330, 260, False, "Le responsable travaille en autonomie."),
    (3, "valid", "En validation", 590, 260, True, "Examen du livrable-clé. BLOQUANT."),
    (4, "work", "Corrections", 850, 260, False, "Boucle autonome sur les retours."),
    (5, "auto", "Juge mécanique", 1110, 260, False, "check / tests verts obligatoires."),
    (6, "valid", "Validation finale", 1370, 260, True, "Validation de la PR. BLOQUANT."),
    (7, "final", "Clôturé", 1640, 260, False, "Fiche de clôture signée."),
]
EDGES = [(1, 2, ""), (2, 3, ""), (3, 4, ""), (4, 5, ""), (5, 6, ""), (6, 7, ""), (3, 2, "rejet"), (6, 4, "rejet")]


def seed(apps, schema_editor):
    Branch = apps.get_model("pilotage_stage", "Branch")
    Node = apps.get_model("pilotage_stage", "Node")
    Edge = apps.get_model("pilotage_stage", "Edge")

    branch, _ = Branch.objects.get_or_create(slug="tronc", defaults={"nom": "Tronc commun"})
    for num, kind, titre, x, y, blocking, detail in NODES:
        Node.objects.get_or_create(branch=branch, num=num, defaults={
            "kind": kind, "titre": titre, "x": x, "y": y, "blocking": blocking, "detail": detail,
        })
    for from_num, to_num, label in EDGES:
        Edge.objects.get_or_create(branch=branch, from_num=from_num, to_num=to_num, defaults={"label": label})


def unseed(apps, schema_editor):
    Branch = apps.get_model("pilotage_stage", "Branch")
    Branch.objects.filter(slug="tronc").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("pilotage_stage", "0002_seed_permissions"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
