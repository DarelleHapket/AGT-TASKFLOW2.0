from flask import Blueprint, request, jsonify
from database import get_db
from utils.auth import require_role

projects_bp = Blueprint("projects", __name__)


def row_to_dict(row):
    return dict(row) if row else None


@projects_bp.route("/", methods=["GET"])
def list_projects():
    conn = get_db()
    rows = conn.execute("SELECT * FROM projects ORDER BY name").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@projects_bp.route("/", methods=["POST"])
def create_project():
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
def update_project(pid):
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
def delete_project(pid):
    conn = get_db()
    conn.execute("DELETE FROM projects WHERE id=?", (pid,))
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
    Si chef_id fourni : le membre doit exister ; on lui donne le role 'chef_projet'.
    """
    data = request.get_json() or {}
    chef_id = data.get("chef_id", None)

    conn = get_db()

    # Le projet doit exister
    project = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not project:
        conn.close()
        return jsonify({"error": "Projet introuvable"}), 404

    # Retrait du chef (chef_id = null)
    if chef_id is None:
        conn.execute("UPDATE projects SET chef_id=NULL WHERE id=?", (pid,))
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

    # On rattache le chef au projet
    conn.execute("UPDATE projects SET chef_id=? WHERE id=?", (chef_id, pid))
    # On promeut le membre en chef_projet (sauf s'il est déjà admin)
    if not member.get("is_admin"):
        conn.execute(
            "UPDATE members SET role='chef_projet' WHERE id=? AND role != 'admin'",
            (chef_id,)
        )
    conn.commit()

    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    return jsonify(dict(row))