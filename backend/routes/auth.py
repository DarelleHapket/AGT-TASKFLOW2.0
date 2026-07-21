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
        status = member.get("status")
        if status == "pending":
            return jsonify({"error": "Compte en attente de validation par l'administrateur"}), 403
        if status == "rejected":
            return jsonify({"error": "Demande de compte refusée. Contactez votre Lead Technique"}), 403
        return jsonify({"error": "Compte désactivé. Contactez votre Lead Technique"}), 403

    if not verify_password(password, member.get("password_hash", "")):
        return jsonify({"error": "Identifiants invalides"}), 401

    token = encode_token({
        "member_id": member["id"],
        "name": member["name"],
        "is_admin": bool(member.get("is_admin", 0)),
        "role": member.get("role") or ("admin" if member.get("is_admin") else "membre")
    })

    return jsonify({
        "access_token": token,
        "user": {
            "id": member["id"],
            "name": member["name"],
            "email": member["email"],
            "is_admin": bool(member.get("is_admin", 0)),
            "role": member.get("role") or ("admin" if member.get("is_admin") else "membre")
        }
    })


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    POST /api/auth/register  (public — BF-02)
    Body: { "name": "...", "email": "...", "password": "..." }
    Crée une demande de compte en attente de validation admin.
    """
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Nom, email et mot de passe requis"}), 400
    if len(password) < 6:
        return jsonify({"error": "Le mot de passe doit faire au moins 6 caractères"}), 400

    conn = get_db()
    exists = conn.execute(
        "SELECT 1 FROM members WHERE LOWER(email)=? OR LOWER(name)=?",
        (email, name.lower())
    ).fetchone()
    if exists:
        conn.close()
        return jsonify({"error": "Un compte avec ce nom ou cet email existe déjà"}), 409

    try:
        conn.execute(
            """INSERT INTO members (name, email, password_hash, is_admin, is_active, status, role)
               VALUES (?, ?, ?, 0, 0, 'pending', 'membre')""",
            (name, email, hash_password(password))
        )
        conn.commit()

        # A-06 — Notification aux admins actifs
        from utils.notif import notify as _notify
        new_member = conn.execute(
            "SELECT id FROM members WHERE LOWER(email)=?", (email,)
        ).fetchone()
        admins = conn.execute(
            "SELECT id FROM members WHERE is_admin=1 AND is_active=1"
        ).fetchall()
        if new_member:
            for admin in admins:
                _notify(
                    conn,
                    recipient_id=admin["id"],
                    sender_id=new_member["id"],
                    type_="register_request",
                    title=f"Demande de compte : {name}",
                    body=f"{name} ({email}) a soumis une demande de création de compte.",
                )
            conn.commit()

        conn.close()
        return jsonify({"message": "Demande envoyée. En attente de validation par l'administrateur."}), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


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
        "is_admin": bool(current_user.get("is_admin", 0)),
        "role": current_user.get("role") or ("admin" if current_user.get("is_admin") else "membre")
    })


@auth_bp.route("/logout", methods=["POST"])
@require_auth
def logout(current_user):
    """
    POST /api/auth/logout
    Côté client le token est supprimé — pas de blacklist nécessaire ici.
    """
    return jsonify({"message": f"Au revoir {current_user['name']} !"})