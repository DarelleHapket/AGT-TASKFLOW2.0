from flask import Blueprint, request, jsonify
from database import get_db

performance_bp = Blueprint("performance", __name__)

try:
    from utils.auth import require_auth
except Exception:  # pragma: no cover
    require_auth = None


def _role(user):
    return user.get("role") or ("admin" if user.get("is_admin") else "membre")


def _allowed_members(conn, user):
    """
    Retourne :
      - None  -> aucune restriction (admin voit tout)
      - liste de noms (responsible) autorisés selon le rôle
    """
    role = _role(user)
    if role == "admin":
        return None  # tout le monde

    if role == "chef_projet":
        # membres responsables d'au moins une tâche dans les projets dont il est chef,
        # + lui-même
        rows = conn.execute(
            """SELECT DISTINCT t.responsible
               FROM tasks t
               JOIN projects p ON t.project_id = p.id
               WHERE p.chef_id = ? AND t.responsible != ''""",
            (user["id"],)
        ).fetchall()
        names = {r["responsible"] for r in rows}
        names.add(user["name"])
        return names

    # membre : uniquement ses propres stats
    return {user["name"]}


def _build(conn, where_extra, params, allowed):
    conditions = ["status = 'done'", "responsible != ''"] + where_extra
    where = " AND ".join(conditions)

    rows = conn.execute(f"""
        SELECT responsible as member, COUNT(*) as task_count,
               SUM(duration) as total_coupons
        FROM tasks WHERE {where}
        GROUP BY responsible ORDER BY total_coupons DESC
    """, params).fetchall()

    proj_rows = conn.execute(f"""
        SELECT responsible as member, p.name as project_name,
               COUNT(*) as task_count, SUM(t.duration) as total_coupons
        FROM tasks t LEFT JOIN projects p ON t.project_id = p.id
        WHERE {where}
        GROUP BY responsible, t.project_id
        ORDER BY responsible, total_coupons DESC
    """, params).fetchall()

    breakdown = {}
    for r in proj_rows:
        m = r["member"]
        if allowed is not None and m not in allowed:
            continue
        breakdown.setdefault(m, []).append({
            "project": r["project_name"] or "Sans projet",
            "task_count": r["task_count"],
            "total_coupons": r["total_coupons"],
        })

    result = []
    for row in rows:
        m = row["member"]
        if allowed is not None and m not in allowed:
            continue
        result.append({
            "member": m,
            "task_count": row["task_count"],
            "total_coupons": row["total_coupons"] or 0,
            "by_project": breakdown.get(m, []),
        })
    return result


def _handler(current_user):
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    where_extra, params = [], []
    if date_from:
        where_extra.append("completed_at >= ?"); params.append(date_from)
    if date_to:
        where_extra.append("completed_at <= ?"); params.append(date_to + "T23:59:59")

    conn = get_db()
    allowed = _allowed_members(conn, current_user)
    result = _build(conn, where_extra, params, allowed)
    conn.close()
    return jsonify(result)


if require_auth:
    @performance_bp.route("/", methods=["GET"])
    @require_auth
    def get_performance(current_user):
        return _handler(current_user)
else:  # fallback si require_auth indisponible
    @performance_bp.route("/", methods=["GET"])
    def get_performance():
        return jsonify({"error": "auth indisponible"}), 500