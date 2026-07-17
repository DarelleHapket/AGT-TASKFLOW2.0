from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_admin

members_bp = Blueprint("members", __name__)

COLORS = ["#6366f1","#f59e0b","#10b981","#ec4899","#8b5cf6",
          "#f97316","#06b6d4","#84cc16","#ef4444","#3b82f6"]


@members_bp.route("/", methods=["GET"])
def list_members():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM members "
        "WHERE status IS NULL OR status='active' "
        "ORDER BY name"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@members_bp.route("/", methods=["POST"])
def create_member():
    data = request.get_json()
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM members").fetchone()[0]
    color = data.get("color") or COLORS[count % len(COLORS)]
    try:
        c = conn.execute(
            "INSERT INTO members (name, color) VALUES (?, ?)", (name, color)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM members WHERE id=?", (c.lastrowid,)).fetchone()
        conn.close()
        return jsonify(dict(row)), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


# ── BF-03 — Validation des demandes de compte (Admin) ──────────────────────

@members_bp.route("/pending", methods=["GET"])
@require_admin
def list_pending(current_user):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name, email, status FROM members "
        "WHERE status='pending' ORDER BY id"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@members_bp.route("/<int:mid>/validate", methods=["PUT"])
@require_admin
def validate_member(current_user, mid):
    data = request.get_json() or {}
    action = (data.get("action") or "").strip().lower()
    if action not in ("approve", "reject"):
        return jsonify({"error": "action doit être 'approve' ou 'reject'"}), 400

    conn = get_db()
    row = conn.execute(
        "SELECT * FROM members WHERE id=? AND status='pending'", (mid,)
    ).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Demande introuvable ou déjà traitée"}), 404

    if action == "approve":
        conn.execute(
            "UPDATE members SET status='active', is_active=1 WHERE id=?", (mid,)
        )
    else:
        conn.execute(
            "UPDATE members SET status='rejected', is_active=0 WHERE id=?", (mid,)
        )
    conn.commit()
    out = conn.execute(
        "SELECT id, name, email, status, is_active FROM members WHERE id=?", (mid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(out))


@members_bp.route("/<int:mid>", methods=["DELETE"])
@require_admin
def delete_member(current_user, mid):
    conn = get_db()
    conn.execute("DELETE FROM members WHERE id=?", (mid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": mid})