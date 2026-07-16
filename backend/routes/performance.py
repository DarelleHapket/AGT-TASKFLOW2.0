from flask import Blueprint, request, jsonify
from database import get_db

performance_bp = Blueprint("performance", __name__)


@performance_bp.route("/", methods=["GET"])
def get_performance():
    """
    Retourne les coupons cumulés par membre sur les tâches "done".
    Params optionnels:
      - date_from : ISO date string (ex: 2024-01-01)
      - date_to   : ISO date string (ex: 2024-12-31)
    """
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")

    conditions = ["status = 'done'", "responsible != ''"]
    params = []

    if date_from:
        conditions.append("completed_at >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("completed_at <= ?")
        params.append(date_to + "T23:59:59")

    where = " AND ".join(conditions)
    query = f"""
        SELECT
            responsible as member,
            COUNT(*) as task_count,
            SUM(duration) as total_coupons,
            GROUP_CONCAT(id, ',') as task_ids
        FROM tasks
        WHERE {where}
        GROUP BY responsible
        ORDER BY total_coupons DESC
    """
    conn = get_db()
    rows = conn.execute(query, params).fetchall()

    # Also fetch per-project breakdown
    proj_query = f"""
        SELECT
            responsible as member,
            p.name as project_name,
            COUNT(*) as task_count,
            SUM(t.duration) as total_coupons
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE {where}
        GROUP BY responsible, t.project_id
        ORDER BY responsible, total_coupons DESC
    """
    proj_rows = conn.execute(proj_query, params).fetchall()
    conn.close()

    # Build per-member project breakdown dict
    breakdown = {}
    for r in proj_rows:
        m = r["member"]
        if m not in breakdown:
            breakdown[m] = []
        breakdown[m].append({
            "project": r["project_name"] or "Sans projet",
            "task_count": r["task_count"],
            "total_coupons": r["total_coupons"],
        })

    result = []
    for row in rows:
        m = row["member"]
        result.append({
            "member": m,
            "task_count": row["task_count"],
            "total_coupons": row["total_coupons"] or 0,
            "by_project": breakdown.get(m, []),
        })

    return jsonify(result)