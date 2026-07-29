# backend/routes/rbac.py
from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_role
from utils.rbac import (
    get_member_permissions, get_member_roles,
    assign_role, revoke_role, grant_permission, revoke_permission
)

rbac_bp = Blueprint("rbac", __name__)


@rbac_bp.route("/roles", methods=["GET"])
@require_role("superadmin")
def list_roles(current_user):
    conn = get_db()
    rows = conn.execute("SELECT * FROM roles").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@rbac_bp.route("/permissions", methods=["GET"])
@require_role("superadmin")
def list_permissions(current_user):
    conn = get_db()
    rows = conn.execute("SELECT * FROM permissions ORDER BY module, code").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@rbac_bp.route("/members/<int:member_id>/roles", methods=["GET"])
@require_role("superadmin")
def member_roles(member_id, current_user):
    return jsonify({
        "roles": get_member_roles(member_id),
        "permissions": get_member_permissions(member_id),
    })


@rbac_bp.route("/members/<int:member_id>/roles", methods=["POST"])
@require_role("superadmin")
def add_member_role(member_id, current_user):
    """Body: { "role": "chef_projet" }"""
    role_code = (request.get_json() or {}).get("role")
    if not role_code:
        return jsonify({"error": "role requis"}), 400
    try:
        assign_role(member_id, role_code, assigned_by=current_user["id"])
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"roles": get_member_roles(member_id)}), 201


@rbac_bp.route("/members/<int:member_id>/roles/<role_code>", methods=["DELETE"])
@require_role("superadmin")
def remove_member_role(member_id, role_code, current_user):
    revoke_role(member_id, role_code)
    return jsonify({"roles": get_member_roles(member_id)})


@rbac_bp.route("/members/<int:member_id>/permissions/<perm_code>", methods=["PUT"])
@require_role("superadmin")
def set_member_permission(member_id, perm_code, current_user):
    """Body: { "granted": true|false } — permission directe (ABAC)."""
    granted = (request.get_json() or {}).get("granted", True)
    try:
        if granted:
            grant_permission(member_id, perm_code)
        else:
            revoke_permission(member_id, perm_code)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"permissions": get_member_permissions(member_id)})
