# backend/routes/members.py
#
# A-07 — Finalisation gestion équipe admin
# A-08 — Soft delete :
#   • DELETE /<id> → UPDATE SET status='deleted', is_active=0, deleted_at=now
#   • GET / et GET /suspended filtrent deleted_at IS NULL
#   • _SAFE_COLS expose deleted_at pour la traçabilité

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_admin, require_auth

members_bp = Blueprint("members", __name__)

COLORS = [
    "#6366f1", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6",
    "#f97316", "#06b6d4", "#84cc16", "#ef4444", "#3b82f6",
]

# Colonnes safe — password_hash exclu · deleted_at inclus
_SAFE_COLS = "id, name, email, role, color, is_active, is_admin, status, deleted_at"


@members_bp.route("/", methods=["GET"])
def list_members():
    conn = get_db()
    rows = conn.execute(
        f"SELECT {_SAFE_COLS} FROM members "
        "WHERE (status IS NULL OR status = 'active') "
        "  AND is_admin = 0 AND deleted_at IS NULL "
        "ORDER BY name COLLATE NOCASE"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@members_bp.route("/pending", methods=["GET"])
@require_admin
def list_pending(current_user):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name, email, status FROM members "
        "WHERE status = 'pending' AND deleted_at IS NULL ORDER BY id"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@members_bp.route("/suspended", methods=["GET"])
@require_admin
def list_suspended(current_user):
    conn = get_db()
    rows = conn.execute(
        f"SELECT {_SAFE_COLS} FROM members "
        "WHERE status = 'suspended' AND deleted_at IS NULL "
        "ORDER BY name COLLATE NOCASE"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@members_bp.route("/deleted", methods=["GET"])
@require_admin
def list_deleted(current_user):
    conn = get_db()
    rows = conn.execute(
        f"SELECT {_SAFE_COLS} FROM members "
        "WHERE deleted_at IS NOT NULL "
        "ORDER BY deleted_at DESC"
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
        c = conn.execute("INSERT INTO members (name, color) VALUES (?, ?)", (name, color))
        conn.commit()
        row = conn.execute(f"SELECT {_SAFE_COLS} FROM members WHERE id = ?", (c.lastrowid,)).fetchone()
        conn.close()
        return jsonify(dict(row)), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


@members_bp.route("/<int:mid>/validate", methods=["PUT"])
@require_admin
def validate_member(current_user, mid):
    data   = request.get_json() or {}
    action = (data.get("action") or "").strip().lower()
    if action not in ("approve", "reject"):
        return jsonify({"error": "action doit être 'approve' ou 'reject'"}), 400
    conn = get_db()
    row  = conn.execute(
        "SELECT * FROM members WHERE id = ? AND status = 'pending' AND deleted_at IS NULL", (mid,)
    ).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Demande introuvable ou déjà traitée"}), 404
    if action == "approve":
        conn.execute("UPDATE members SET status = 'active', is_active = 1 WHERE id = ?", (mid,))
    else:
        conn.execute("UPDATE members SET status = 'rejected', is_active = 0 WHERE id = ?", (mid,))
    conn.commit()
    out = conn.execute("SELECT id, name, email, status, is_active FROM members WHERE id = ?", (mid,)).fetchone()
    conn.close()
    return jsonify(dict(out))


@members_bp.route("/<int:mid>/role", methods=["PUT"])
@require_admin
def set_member_role(current_user, mid):
    data = request.get_json() or {}
    role = (data.get("role") or "").strip()
    if role not in ("membre", "chef_projet"):
        return jsonify({"error": "role doit être 'membre' ou 'chef_projet'"}), 400
    conn   = get_db()
    member = conn.execute("SELECT * FROM members WHERE id = ? AND deleted_at IS NULL", (mid,)).fetchone()
    if not member:
        conn.close()
        return jsonify({"error": "Membre introuvable"}), 404
    member = dict(member)
    if member.get("is_admin") or member.get("role") == "admin":
        conn.close()
        return jsonify({"error": "Impossible de modifier le rôle d'un administrateur"}), 403
    conn.execute("UPDATE members SET role = ? WHERE id = ?", (role, mid))
    conn.commit()
    out = conn.execute(f"SELECT {_SAFE_COLS} FROM members WHERE id = ?", (mid,)).fetchone()
    conn.close()
    return jsonify(dict(out))


@members_bp.route("/<int:mid>/toggle-active", methods=["PUT"])
@require_admin
def toggle_member_active(current_user, mid):
    if mid == current_user["id"]:
        return jsonify({"error": "Vous ne pouvez pas suspendre votre propre compte."}), 403
    conn   = get_db()
    member = conn.execute("SELECT * FROM members WHERE id = ? AND deleted_at IS NULL", (mid,)).fetchone()
    if not member:
        conn.close()
        return jsonify({"error": "Membre introuvable"}), 404
    member = dict(member)
    if member.get("is_admin") or member.get("role") == "admin":
        conn.close()
        return jsonify({"error": "Impossible de suspendre un compte administrateur."}), 403
    new_active = not bool(member.get("is_active", 1))
    new_status = "active" if new_active else "suspended"
    conn.execute(
        "UPDATE members SET is_active = ?, status = ? WHERE id = ?",
        (1 if new_active else 0, new_status, mid)
    )
    conn.commit()
    out = conn.execute(f"SELECT {_SAFE_COLS} FROM members WHERE id = ?", (mid,)).fetchone()
    conn.close()
    return jsonify(dict(out))


# ── DELETE — SOFT DELETE ─────────────────────────────────────────────────────
# La ligne reste en base. La traçabilité dans project_members est préservée.
# Le token du membre est invalidé car get_current_user vérifie deleted_at IS NULL.

@members_bp.route("/<int:mid>", methods=["DELETE"])
@require_admin
def delete_member(current_user, mid):
    if mid == current_user["id"]:
        return jsonify({"error": "Vous ne pouvez pas supprimer votre propre compte."}), 403

    conn = get_db()
    try:
        member = conn.execute(
            "SELECT * FROM members WHERE id = ? AND deleted_at IS NULL", (mid,)
        ).fetchone()
        if not member:
            return jsonify({"error": "Membre introuvable ou déjà supprimé"}), 404

        member = dict(member)
        if member.get("is_admin") or member.get("role") == "admin":
            return jsonify({"error": "Impossible de supprimer un compte administrateur."}), 403

        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "UPDATE members SET is_active = 0, status = 'deleted', deleted_at = ? WHERE id = ?",
            (now, mid)
        )
        conn.commit()
        return jsonify({"deleted": mid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()  # toujours exécuté, même en cas d'exception