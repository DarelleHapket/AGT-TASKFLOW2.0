"""Génération de données de rapport — port de backend/routes/reports.py.
Le PDF/TXT reste généré côté client (jsPDF), comme dans le Flask actuel :
cette app fournit uniquement les données JSON.

BUG export PDF superadmin (déjà corrigé côté Flask) : le rôle superadmin est
traité ici comme admin dès le départ — non-régression assurée par construction."""
from datetime import date, timedelta

from rest_framework.decorators import api_view
from rest_framework.response import Response

from authentification.models import User
from projets.acces import is_admin_role
from projets.models import Projet, Tache


def _date_range(period):
    today = date.today()
    if period == "today":
        return today.isoformat(), today.isoformat()
    if period == "week":
        monday = today - timedelta(days=today.weekday())
        return monday.isoformat(), (monday + timedelta(days=6)).isoformat()
    if period == "month":
        first = today.replace(day=1)
        next_first = today.replace(year=today.year + 1, month=1, day=1) if today.month == 12 \
            else today.replace(month=today.month + 1, day=1)
        return first.isoformat(), (next_first - timedelta(days=1)).isoformat()
    return None, None


def _has_full_access(user):
    return is_admin_role(user) or user.is_superadmin()


def _task_dict(t):
    """Objet tâche complet pour les listes de rapport — port de backend/routes/reports.py
    (le frontend jsPDF/TXT lit t.id/t.description/t.project_name/t.completed_at/t.due_date)."""
    return {
        "id": t.id, "description": t.description,
        "project_name": t.projet.nom if t.projet else "Sans projet",
        "responsible": t.responsable.display_name() if t.responsable else None,
        "completed_at": t.date_completion.date().isoformat() if t.date_completion else None,
        "due_date": t.date_echeance.isoformat() if t.date_echeance else None,
    }


def _difficulties_for(taches):
    difficultes = []
    for t in taches:
        diffs = list(t.difficultes.select_related("membre"))
        if diffs:
            difficultes.append({
                "task_id": t.id, "task_description": t.description,
                "project_name": t.projet.nom if t.projet else "Sans projet",
                "items": [{"content": d.contenu, "member_name": d.membre.display_name(), "created_at": d.cree_le} for d in diffs],
            })
    return difficultes


def _member_report(member, date_from, date_to):
    taches = Tache.objects.filter(responsable=member, est_archivee=False).select_related("projet", "activite")
    done = [t for t in taches if t.statut == Tache.DONE and t.date_completion
            and (not date_from or t.date_completion.date().isoformat() >= date_from)
            and (not date_to or t.date_completion.date().isoformat() <= date_to)]
    in_progress = [t for t in taches if t.statut == Tache.IN_PROGRESS]
    blocked = [t for t in taches if t.statut == Tache.BLOCKED]
    today_str = date.today().isoformat()
    overdue = [t for t in taches if t.date_echeance and t.date_echeance.isoformat() < today_str and t.statut != Tache.DONE]

    return {
        "id": member.id, "name": member.display_name(), "color": member.color,
        "summary": {
            "total_assigned": taches.count(), "total_done": len(done),
            "total_in_progress": len(in_progress), "total_blocked": len(blocked),
            "total_overdue": len(overdue), "total_coupons": sum(t.duree for t in done),
        },
        "done_tasks": [_task_dict(t) for t in done],
        "in_progress_tasks": [_task_dict(t) for t in in_progress],
        "blocked_tasks": [_task_dict(t) for t in blocked],
        "overdue_tasks": [_task_dict(t) for t in overdue],
        "difficulties": _difficulties_for(taches),
    }


@api_view(["GET"])
def report_data(request):
    period = request.query_params.get("period", "week")
    member_id = request.query_params.get("member_id")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")
    if not date_from or not date_to:
        date_from, date_to = _date_range(period)

    user = request.user
    if _has_full_access(user):
        allowed_ids = None
    elif "chef_projet" in user.roles_codes():
        allowed_ids = set(
            Tache.objects.filter(projet__membres__utilisateur=user, projet__membres__role="owner")
            .values_list("responsable_id", flat=True)
        )
        allowed_ids.add(user.id)
    else:
        allowed_ids = {user.id}

    if allowed_ids is not None and member_id and int(member_id) not in allowed_ids:
        return Response({"error": "Accès non autorisé à ce membre"}, status=403)

    if member_id:
        membres = User.objects.filter(pk=member_id)
    elif allowed_ids is None:
        membres = User.objects.all().order_by("username")
    else:
        membres = User.objects.filter(pk__in=allowed_ids)

    return Response({
        "generated_at": date.today().isoformat(), "generated_by": user.display_name(),
        "period": period, "date_from": date_from, "date_to": date_to,
        "members": [_member_report(m, date_from, date_to) for m in membres],
    })


@api_view(["GET"])
def project_report(request):
    user = request.user
    if not (_has_full_access(user) or "chef_projet" in user.roles_codes()):
        return Response({"error": "Rapport par projet réservé aux chefs de projet et à l'admin"}, status=403)

    projet_id = request.query_params.get("project_id")
    period = request.query_params.get("period", "week")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")
    if not date_from or not date_to:
        date_from, date_to = _date_range(period)
    if not projet_id:
        return Response({"error": "project_id requis"}, status=400)

    projet = Projet.objects.filter(pk=projet_id).first()
    if not projet:
        return Response({"error": "Projet introuvable"}, status=404)

    if not _has_full_access(user):
        est_owner = projet.membres.filter(utilisateur=user, role="owner").exists()
        if not est_owner:
            return Response({"error": "Ce projet n'est pas dans votre périmètre"}, status=403)

    taches = Tache.objects.filter(projet=projet, est_archivee=False).select_related("responsable", "projet")
    today_str = date.today().isoformat()
    done = [t for t in taches if t.statut == Tache.DONE]
    in_progress = [t for t in taches if t.statut == Tache.IN_PROGRESS]
    blocked = [t for t in taches if t.statut == Tache.BLOCKED]
    overdue = [t for t in taches if t.date_echeance and t.date_echeance.isoformat() < today_str and t.statut != Tache.DONE]

    by_member = {}
    for t in taches:
        who = t.responsable.display_name() if t.responsable else "—"
        entry = by_member.setdefault(who, {"name": who, "total": 0, "done": 0, "coupons": 0})
        entry["total"] += 1
        if t.statut == Tache.DONE:
            entry["done"] += 1
            entry["coupons"] += t.duree

    owner = projet.membres.filter(role="owner").select_related("utilisateur").first()

    return Response({
        "generated_at": date.today().isoformat(), "generated_by": user.display_name(),
        "period": period, "date_from": date_from, "date_to": date_to,
        "project": {"id": projet.id, "name": projet.nom, "description": projet.description,
                    "chef_name": owner.utilisateur.display_name() if owner else None},
        "summary": {
            "total_tasks": taches.count(), "total_done": len(done), "total_in_progress": len(in_progress),
            "total_blocked": len(blocked), "total_overdue": len(overdue),
            "total_coupons": sum(t.duree for t in done),
        },
        "members": list(by_member.values()),
        "done_tasks": [_task_dict(t) for t in done],
        "in_progress_tasks": [_task_dict(t) for t in in_progress],
        "blocked_tasks": [_task_dict(t) for t in blocked],
        "overdue_tasks": [_task_dict(t) for t in overdue],
        "difficulties": _difficulties_for(taches),
    })
