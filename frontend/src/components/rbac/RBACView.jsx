import { useState, useEffect } from "react";
import * as api from "../../api/client";

const ROLE_COLORS = {
  superadmin: { bg: "var(--accent-bg)", color: "var(--accent)" },
  admin: { bg: "#f3e8ff", color: "#9333ea" },
  chef_projet: { bg: "#fff7ed", color: "#f59e0b" },
  membre: { bg: "var(--bg-hover)", color: "var(--text-2)" },
};

const ROLE_LABELS = {
  superadmin: "Superadmin",
  admin: "Admin",
  chef_projet: "Chef de projet",
  membre: "Membre",
};

const MODULE_LABELS = {
  membres: "Membres", rbac: "Rôles & permissions", projets: "Projets",
  dashboard: "Tableau de bord", admin: "Administration", ops: "Opérations",
};

export function RBACView({ members }) {
  const [allRoles, setAllRoles] = useState([]);
  const [allPerms, setAllPerms] = useState([]);
  const [memberData, setMemberData] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [roles, perms] = await Promise.all([api.getRoles(), api.getAllPermissions()]);
      setAllRoles(roles);
      setAllPerms(perms);
      const data = {};
      await Promise.all(members.map(async (m) => { data[m.id] = await api.getMemberRoles(m.id); }));
      setMemberData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [members]);

  const handleAddRole = async (memberId, roleCode) => {
    if (!roleCode) return;
    await api.assignMemberRole(memberId, roleCode);
    load();
  };

  const handleRemoveRole = async (memberId, roleCode) => {
    if (roleCode === "superadmin") { alert("Le rôle superadmin ne peut pas être retiré."); return; }
    await api.revokeMemberRole(memberId, roleCode);
    load();
  };

  const handleTogglePermission = async (memberId, permCode, currentlyGranted) => {
    await api.setMemberPermission(memberId, permCode, !currentlyGranted);
    load();
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Chargement…</div>;
  }

  const permsByModule = allPerms.reduce((acc, p) => { (acc[p.module] = acc[p.module] || []).push(p); return acc; }, {});

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Rôles &amp; permissions</h2>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>Gestion des rôles multiples et des permissions directes — réservé au Superadmin</span>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-hover)" }}>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>MEMBRE</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>RÔLES</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>AJOUTER UN RÔLE</th>
              <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const data = memberData[m.id] || { roles: [], permissions: [] };
              const availableToAdd = allRoles.filter((r) => !data.roles.includes(r.code) && r.code !== "superadmin");
              return (
                <>
                  <tr key={m.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{m.name}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {data.roles.map((r) => (
                          <span key={r} style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: ROLE_COLORS[r]?.bg || "var(--bg-hover)", color: ROLE_COLORS[r]?.color || "var(--text-2)", display: "flex", alignItems: "center", gap: 5 }}>
                            {ROLE_LABELS[r] || r}
                            {r !== "superadmin" && (
                              <button onClick={() => handleRemoveRole(m.id, r)} style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", fontSize: 11, padding: 0, lineHeight: 1 }}>×</button>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <select onChange={(e) => { handleAddRole(m.id, e.target.value); e.target.value = ""; }} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="">— Ajouter —</option>
                        {availableToAdd.map((r) => (<option key={r.code} value={r.code}>{ROLE_LABELS[r.code] || r.code}</option>))}
                      </select>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <button onClick={() => setExpanded(expanded === m.id ? null : m.id)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}>
                        {expanded === m.id ? "Masquer" : "Permissions"}
                      </button>
                    </td>
                  </tr>
                  {expanded === m.id && (
                    <tr>
                      <td colSpan={4} style={{ padding: "0 14px 14px", background: "var(--bg-hover)" }}>
                        <div style={{ padding: 12, background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", marginBottom: 8 }}>PERMISSIONS EFFECTIVES (rôle + directes)</div>
                          {Object.entries(permsByModule).map(([module, perms]) => (
                            <div key={MODULE_LABELS[module] || module} style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent)", marginBottom: 4, textTransform: "uppercase" }}>{MODULE_LABELS[module] || module}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {perms.map((p) => {
                                  const granted = data.permissions.includes(p.code);
                                  return (
                                    <button key={p.description || p.code} onClick={() => handleTogglePermission(m.id, p.code, granted)} title={p.description}
                                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: `1.5px solid ${granted ? "var(--accent)" : "var(--border)"}`, background: granted ? "var(--accent)" : "transparent", color: granted ? "white" : "var(--text-3)", cursor: "pointer" }}>
                                      {p.description || p.code}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
