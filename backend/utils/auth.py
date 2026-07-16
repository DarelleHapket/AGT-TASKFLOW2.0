# backend/utils/auth.py
import jwt
import os
from functools import wraps
from flask import request, jsonify
from database import get_db

SECRET_KEY = os.environ.get("JWT_SECRET", "agt-secret-dev-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 heures


def encode_token(payload: dict) -> str:
    """Génère un JWT signé."""
    import datetime
    payload = payload.copy()
    payload["exp"] = datetime.datetime.utcnow() + datetime.timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Décode et vérifie un JWT. Lève une exception si invalide."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_current_user():
    """Extrait et retourne le membre connecté depuis le token JWT."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, "Token manquant"
    token = auth_header.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        member_id = payload.get("member_id")
        conn = get_db()
        row = conn.execute(
            "SELECT * FROM members WHERE id=? AND is_active=1", (member_id,)
        ).fetchone()
        conn.close()
        if not row:
            return None, "Membre introuvable ou inactif"
        return dict(row), None
    except jwt.ExpiredSignatureError:
        return None, "Token expiré"
    except jwt.InvalidTokenError:
        return None, "Token invalide"


def require_auth(f):
    """Décorateur — protège un endpoint, injecte current_user."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user, error = get_current_user()
        if error:
            return jsonify({"error": error}), 401
        return f(*args, current_user=user, **kwargs)
    return decorated


def require_admin(f):
    """Décorateur — réservé à Gabriel (is_admin=True)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user, error = get_current_user()
        if error:
            return jsonify({"error": error}), 401
        if not user.get("is_admin"):
            return jsonify({"error": "Accès réservé à l'administrateur"}), 403
        return f(*args, current_user=user, **kwargs)
    return decorated