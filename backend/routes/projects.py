from flask import Blueprint, request, jsonify
from functools import wraps
from database import get_db
from utils.auth import require_role, require_auth, get_current_user

projects_bp = Blueprint("projects", __name__)


def require_chef_only(f):
    """Écriture projet réservée au Chef de projet (CdC : l'admin est en lecture seule)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user, error = get_current_user()
        if error:
            return jsonify({"error": error}), 401
        role = user.get("role") or ("admin" if user.get("is_admin") else "membre")
        if role != "chef_projet":
            return jsonify({"error": "Réservé au chef de projet"}), 403
        return f(*args, current_user=user, **kwargs)
    return decorated


def row_to_dict(row):
    return dict(row) if row else None


def _demote_if_orphan(conn, member_id):
    """Repasse un membre en 'membre' s'il n'est plus chef d'aucun projet.
    Ne touche jamais un admin."""
    if member_id is None:
        return
    m = conn.execute("SELECT * FROM members WHERE id=?", (member_id,)).fetchone()
    if not m or dict(m).get("is_admin"):
        return
    still_chef = conn.execute(
        "SELECT COUNT(*) FROM projects WHERE chef_id=?", (member_id,)
    ).fetchone()[0]
    if still_chef == 0:
        conn.execute(
            "UPDATE members SET role='membre' WHERE id=? AND role='chef_projet'",
            (member_id,)
        )


@projects_bp.route("/", methods=["GET"])
@require_auth
def list_projects(current_user):
    conn = get_db()
    rows = conn.execute("SELECT * FROM projects ORDER BY name").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@projects_bp.route("/", methods=["POST"])
@require_chef_only
def create_project(current_user):
    data = request.get_json()
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    conn = get_db()
    try:
        c = conn.execute(
            "INSERT INTO projects (name, description) VALUES (?, ?)",
            (name, description)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM projects WHERE id=?", (c.lastrowid,)).fetchone()
        conn.close()
        return jsonify(dict(row)), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409


@projects_bp.route("/<int:pid>", methods=["PUT"])
@require_chef_only
def update_project(pid, current_user):
    data = request.get_json()
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    conn = get_db()
    conn.execute(
        "UPDATE projects SET name=?, description=? WHERE id=?",
        (name, description, pid)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    return jsonify(dict(row)) if row else (jsonify({"error": "not found"}), 404)


@projects_bp.route("/<int:pid>", methods=["DELETE"])
@require_chef_only
def delete_project(pid, current_user):
    conn = get_db()
    # récupérer l'ancien chef pour resynchro éventuelle après suppression
    proj = conn.execute("SELECT chef_id FROM projects WHERE id=?", (pid,)).fetchone()
    old_chef = dict(proj).get("chef_id") if proj else None
    conn.execute("DELETE FROM projects WHERE id=?", (pid,))
    _demote_if_orphan(conn, old_chef)
    conn.commit()
    conn.close()
    return jsonify({"deleted": pid})


# ── Ajout poste B (Darelle) — désignation du chef de projet ─────────────────
# Réservé à l'admin (cf. diagramme de classe : "Admin désigne ChefProjet").
# Additif : ne modifie aucune des routes CRUD ci-dessus.
@projects_bp.route("/<int:pid>/chef", methods=["PUT"])
@require_role("admin")
def set_project_chef(pid, current_user):
    """
    PUT /api/projects/<id>/chef
    Body: { "chef_id": <member_id | null> }
    Désigne (ou retire, si null) le chef d'un projet.
    - Si chef_id fourni : le membre doit exister ; on lui donne le role 'chef_projet'.
    - L'ancien chef, s'il n'est plus chef d'aucun projet, repasse 'membre'.
    """
    data = request.get_json() or {}
    chef_id = data.get("chef_id", None)

    conn = get_db()

    project = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not project:
        conn.close()
        return jsonify({"error": "Projet introuvable"}), 404

    old_chef = dict(project).get("chef_id")

    # Retrait du chef (chef_id = null)
    if chef_id is None:
        conn.execute("UPDATE projects SET chef_id=NULL WHERE id=?", (pid,))
        _demote_if_orphan(conn, old_chef)
        conn.commit()
        row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
        conn.close()
        return jsonify(dict(row))

    # Désignation : le membre doit exister
    member = conn.execute("SELECT * FROM members WHERE id=?", (chef_id,)).fetchone()
    if not member:
        conn.close()
        return jsonify({"error": "Membre introuvable"}), 404

    member = dict(member)

    # Rattacher le nouveau chef au projet
    conn.execute("UPDATE projects SET chef_id=? WHERE id=?", (chef_id, pid))
    # Promouvoir le nouveau chef (sauf admin)
    if not member.get("is_admin"):
        conn.execute(
            "UPDATE members SET role='chef_projet' WHERE id=? AND role != 'admin'",
            (chef_id,)
        )
    # Resynchro de l'ancien chef s'il a été remplacé et n'est plus chef ailleurs
    if old_chef and old_chef != chef_id:
        _demote_if_orphan(conn, old_chef)
    conn.commit()

    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    return jsonify(dict(row))