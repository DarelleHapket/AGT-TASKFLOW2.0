# backend/routes/auth.py
import hashlib
from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import encode_token, decode_token, require_auth

auth_bp = Blueprint("auth", __name__)


def hash_password(password: str) -> str:
    """Hash SHA-256 simple — suffisant pour usage interne."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    POST /api/auth/login
    Body: { "email": "...", "password": "..." }
    Retourne: { "access_token": "...", "user": { id, name, email, is_admin } }
    """
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email et mot de passe requis"}), 400

    conn = get_db()
    row = conn.execute(
        "SELECT * FROM members WHERE LOWER(email)=?", (email,)
    ).fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Identifiants invalides"}), 401

    member = dict(row)

    if not member.get("is_active", 1):
        return jsonify({"error": "Compte désactivé. Contactez votre Lead Technique"}), 403

    if not verify_password(password, member.get("password_hash", "")):
        return jsonify({"error": "Identifiants invalides"}), 401

    token = encode_token({
        "member_id": member["id"],
        "name": member["name"],
        "is_admin": bool(member.get("is_admin", 0))
    })

    return jsonify({
        "access_token": token,
        "user": {
            "id": member["id"],
            "name": member["name"],
            "email": member["email"],
            "is_admin": bool(member.get("is_admin", 0))
        }
    })


@auth_bp.route("/me", methods=["GET"])
@require_auth
def me(current_user):
    """
    GET /api/auth/me
    Retourne le profil du membre connecté.
    """
    return jsonify({
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "is_admin": bool(current_user.get("is_admin", 0))
    })


@auth_bp.route("/logout", methods=["POST"])
@require_auth
def logout(current_user):
    """
    POST /api/auth/logout
    Côté client le token est supprimé — pas de blacklist nécessaire ici.
    """
    return jsonify({"message": f"Au revoir {current_user['name']} !"})