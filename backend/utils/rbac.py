# backend/utils/rbac.py
# Logique RBAC : rôles multiples + permissions directes (ABAC).
# Permission effective = member_permissions.granted=1 (peu importe source).
from database import get_db


def get_member_permissions(member_id):
    """Retourne la liste des codes de permissions effectives d'un membre."""
    conn = get_db()
    rows = conn.execute(
        """SELECT p.code FROM member_permissions mp
           JOIN permissions p ON p.id = mp.permission_id
           WHERE mp.member_id=? AND mp.granted=1""",
        (member_id,)
    ).fetchall()
    conn.close()
    return [r["code"] for r in rows]


def has_permission(member_id, code):
    conn = get_db()
    row = conn.execute(
        """SELECT 1 FROM member_permissions mp
           JOIN permissions p ON p.id = mp.permission_id
           WHERE mp.member_id=? AND p.code=? AND mp.granted=1""",
        (member_id, code)
    ).fetchone()
    conn.close()
    return bool(row)


def get_member_roles(member_id):
    conn = get_db()
    rows = conn.execute(
        """SELECT r.code FROM member_roles mr
           JOIN roles r ON r.id = mr.role_id
           WHERE mr.member_id=?""",
        (member_id,)
    ).fetchall()
    conn.close()
    return [r["code"] for r in rows]


PRINCIPAL_ROLES = {"admin", "chef_projet", "membre"}


def assign_role(member_id, role_code, assigned_by=None):
    """Attribue un rôle : copie ses permissions par défaut (source='role').
    Si le rôle est un rôle "principal" (admin/chef_projet/membre), synchronise
    aussi la colonne legacy members.role pour que TeamView/Dashboard reflètent
    le changement immédiatement."""
    conn = get_db()
    role = conn.execute("SELECT id FROM roles WHERE code=?", (role_code,)).fetchone()
    if not role:
        conn.close()
        raise ValueError("Rôle inconnu")
    conn.execute(
        "INSERT OR IGNORE INTO member_roles (member_id, role_id, assigned_by) VALUES (?, ?, ?)",
        (member_id, role["id"], assigned_by)
    )
    perms = conn.execute(
        "SELECT permission_id FROM role_permissions WHERE role_id=?", (role["id"],)
    ).fetchall()
    for p in perms:
        conn.execute(
            """INSERT INTO member_permissions (member_id, permission_id, granted, source)
               VALUES (?, ?, 1, 'role')
               ON CONFLICT(member_id, permission_id) DO UPDATE SET granted=1""",
            (member_id, p["permission_id"])
        )
    if role_code in PRINCIPAL_ROLES:
        is_admin_flag = 1 if role_code == "admin" else 0
        conn.execute(
            "UPDATE members SET role=?, is_admin=? WHERE id=?",
            (role_code, is_admin_flag, member_id)
        )
    conn.commit()
    conn.close()


def revoke_role(member_id, role_code):
    """Retire un rôle. Les permissions déjà copiées restent (découplées, D-05 CDC).
    Si le rôle retiré est celui reflété dans la colonne legacy members.role,
    on retombe sur 'membre' par défaut."""
    conn = get_db()
    role = conn.execute("SELECT id FROM roles WHERE code=?", (role_code,)).fetchone()
    if role:
        conn.execute(
            "DELETE FROM member_roles WHERE member_id=? AND role_id=?",
            (member_id, role["id"])
        )
        if role_code in PRINCIPAL_ROLES:
            current = conn.execute(
                "SELECT role FROM members WHERE id=?", (member_id,)
            ).fetchone()
            if current and current["role"] == role_code:
                conn.execute(
                    "UPDATE members SET role='membre' WHERE id=?", (member_id,)
                )
        conn.commit()
    conn.close()


def grant_permission(member_id, perm_code):
    """Accorde une permission directe (ABAC), indépendamment des rôles."""
    conn = get_db()
    perm = conn.execute("SELECT id FROM permissions WHERE code=?", (perm_code,)).fetchone()
    if not perm:
        conn.close()
        raise ValueError("Permission inconnue")
    conn.execute(
        """INSERT INTO member_permissions (member_id, permission_id, granted, source)
           VALUES (?, ?, 1, 'direct')
           ON CONFLICT(member_id, permission_id) DO UPDATE SET granted=1, source='direct'""",
        (member_id, perm["id"])
    )
    conn.commit()
    conn.close()


def revoke_permission(member_id, perm_code):
    """Retire une permission (même héritée d'un rôle) sans toucher au rôle."""
    conn = get_db()
    perm = conn.execute("SELECT id FROM permissions WHERE code=?", (perm_code,)).fetchone()
    if perm:
        conn.execute(
            """INSERT INTO member_permissions (member_id, permission_id, granted, source)
               VALUES (?, ?, 0, 'direct')
               ON CONFLICT(member_id, permission_id) DO UPDATE SET granted=0, source='direct'""",
            (member_id, perm["id"])
        )
        conn.commit()
    conn.close()
