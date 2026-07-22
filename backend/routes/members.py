# backend/routes/members.py
#
# B-01 — Validation des demandes de compte (pending / validate)
# A-07 — Finalisation gestion équipe :
#   • GET /          → SELECT explicite : password_hash exclu de la réponse
#   • GET /suspended → admin only : liste les comptes suspendus
#   • PUT /<id>/toggle-active → admin only : suspend / réactive un compte
#   • DELETE /<id>   → guards : interdit sur soi-même et sur un admin

from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_admin, require_auth

members_bp = Blueprint("members", __name__)

COLORS = [
    "#6366f1", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6",
    "#f97316", "#06b6d4", "#84cc16", "#ef4444", "#3b82f6",
]

# Colonnes safe à exposer (password_hash exclue)
_SAFE_COLS = "id, name, email, role, color, is_active, is_admin, status"


# ── GET /api/members/ ────────────────────────────────────────────────────────
# Retourne uniquement les membres actifs (status = 'active').
# password_hash est volontairement exclu.

@members_bp.route("/", methods=["GET"])
def list_members():
    conn = get_db()
    rows = conn.execute(
        f"SELECT {_SAFE_COLS} FROM members "
        "WHERE status IS NULL OR status = 'active' "
        "ORDER BY name COLLATE NOCASE"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ── GET /api/members/pending ─────────────────────────────────────────────────
# Admin only — demandes de compte en attente de validation.

@members_bp.route("/pending", methods=["GET"])
@require_admin
def list_pending(current_user):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name, email, status FROM members "
        "WHERE status = 'pending' ORDER BY id"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ── GET /api/members/suspended ───────────────────────────────────────────────
# Admin only — comptes suspendus (is_active = 0, status = 'suspended').

@members_bp.route("/suspended", methods=["GET"])
@require_admin
def list_suspended(current_user):
    conn = get_db()
    rows = conn.execute(
        f"SELECT {_SAFE_COLS} FROM members "
        "WHERE status = 'suspended' "
        "ORDER BY name COLLATE NOCASE"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ── POST /api/members/ ───────────────────────────────────────────────────────
# Création directe (legacy — les nouveaux comptes passent par /auth/register).

@members_bp.route("/", methods=["POST"])
def create_member():
    data  = request.get_json()
    name  = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    conn  = get_db()
    count = conn.execute("SELECT COUNT(*) FROM members").fetchone()[0]
    color = data.get("color") or COLORS[count % len(COLORS)]
    try:
        c = conn.execute(
            "INSERT INTO members (name, color) VALUES (?, ?)", (name, color)
        )
        conn.commit()
        row = conn.execute(
            f"SELECT {_SAFE_COLS} FROM members WHERE id = ?", (c.lastrowid,)
        ).fetchone()
        conn.close()
        return jsonify(dict(row)), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


# ── PUT /api/members/<id>/validate ───────────────────────────────────────────
# Admin only — approuver ou rejeter une demande de compte.

@members_bp.route("/<int:mid>/validate", methods=["PUT"])
@require_admin
def validate_member(current_user, mid):
    data   = request.get_json() or {}
    action = (data.get("action") or "").strip().lower()
    if action not in ("approve", "reject"):
        return jsonify({"error": "action doit être 'approve' ou 'reject'"}), 400

    conn = get_db()
    row  = conn.execute(
        "SELECT * FROM members WHERE id = ? AND status = 'pending'", (mid,)
    ).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Demande introuvable ou déjà traitée"}), 404

    if action == "approve":
        conn.execute(
            "UPDATE members SET status = 'active', is_active = 1 WHERE id = ?", (mid,)
        )
    else:
        conn.execute(
            "UPDATE members SET status = 'rejected', is_active = 0 WHERE id = ?", (mid,)
        )
    conn.commit()
    out = conn.execute(
        "SELECT id, name, email, status, is_active FROM members WHERE id = ?", (mid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(out))


# ── PUT /api/members/<id>/role ───────────────────────────────────────────────
# Admin only — promouvoir / rétrograder le rôle global (membre ↔ chef_projet).
# Ne touche jamais un compte admin.

@members_bp.route("/<int:mid>/role", methods=["PUT"])
@require_admin
def set_member_role(current_user, mid):
    data = request.get_json() or {}
    role = (data.get("role") or "").strip()
    if role not in ("membre", "chef_projet"):
        return jsonify({"error": "role doit être 'membre' ou 'chef_projet'"}), 400

    conn   = get_db()
    member = conn.execute("SELECT * FROM members WHERE id = ?", (mid,)).fetchone()
    if not member:
        conn.close()
        return jsonify({"error": "Membre introuvable"}), 404

    member = dict(member)
    if member.get("is_admin") or member.get("role") == "admin":
        conn.close()
        return jsonify({"error": "Impossible de modifier le rôle d'un administrateur"}), 403

    conn.execute("UPDATE members SET role = ? WHERE id = ?", (role, mid))
    conn.commit()
    out = conn.execute(
        f"SELECT {_SAFE_COLS} FROM members WHERE id = ?", (mid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(out))


# ── PUT /api/members/<id>/toggle-active ──────────────────────────────────────
# Admin only — suspend ou réactive un compte.
# Interdit sur soi-même et sur un autre admin.
#
# Transition :
#   active (is_active=1, status='active')     → suspendu (is_active=0, status='suspended')
#   suspendu (is_active=0, status='suspended') → active  (is_active=1, status='active')

@members_bp.route("/<int:mid>/toggle-active", methods=["PUT"])
@require_admin
def toggle_member_active(current_user, mid):
    if mid == current_user["id"]:
        return jsonify({"error": "Vous ne pouvez pas suspendre votre propre compte."}), 403

    conn   = get_db()
    member = conn.execute("SELECT * FROM members WHERE id = ?", (mid,)).fetchone()
    if not member:
        conn.close()
        return jsonify({"error": "Membre introuvable"}), 404

    member = dict(member)
    if member.get("is_admin") or member.get("role") == "admin":
        conn.close()
        return jsonify({"error": "Impossible de suspendre un compte administrateur."}), 403

    currently_active = bool(member.get("is_active", 1))
    new_active       = not currently_active
    new_status       = "active" if new_active else "suspended"

    conn.execute(
        "UPDATE members SET is_active = ?, status = ? WHERE id = ?",
        (1 if new_active else 0, new_status, mid)
    )
    conn.commit()
    out = conn.execute(
        f"SELECT {_SAFE_COLS} FROM members WHERE id = ?", (mid,)
    ).fetchone()
    conn.close()
    return jsonify(dict(out))


# ── DELETE /api/members/<id> ─────────────────────────────────────────────────
# Admin only — suppression définitive.
# Interdit sur soi-même et sur un autre admin.

@members_bp.route("/<int:mid>", methods=["DELETE"])
@require_admin
def delete_member(current_user, mid):
    if mid == current_user["id"]:
        return jsonify({"error": "Vous ne pouvez pas supprimer votre propre compte."}), 403

    conn   = get_db()
    member = conn.execute("SELECT * FROM members WHERE id = ?", (mid,)).fetchone()
    if not member:
        conn.close()
        return jsonify({"error": "Membre introuvable"}), 404

    member = dict(member)
    if member.get("is_admin") or member.get("role") == "admin":
        conn.close()
        return jsonify({"error": "Impossible de supprimer un compte administrateur."}), 403

    conn.execute("DELETE FROM members WHERE id = ?", (mid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": mid})