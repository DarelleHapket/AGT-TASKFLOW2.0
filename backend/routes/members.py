from flask import Blueprint, request, jsonify
from database import get_db

members_bp = Blueprint("members", __name__)

COLORS = ["#6366f1","#f59e0b","#10b981","#ec4899","#8b5cf6",
          "#f97316","#06b6d4","#84cc16","#ef4444","#3b82f6"]


@members_bp.route("/", methods=["GET"])
def list_members():
    conn = get_db()
    rows = conn.execute("SELECT * FROM members ORDER BY name").fetchall()
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


@members_bp.route("/<int:mid>", methods=["DELETE"])
def delete_member(mid):
    conn = get_db()
    conn.execute("DELETE FROM members WHERE id=?", (mid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": mid})
