"use client";

// Port fidèle de frontend/src/components/rbac/RBACView.jsx, enrichi d'un
// détail par permission (rbac/membres/<id>/permissions) pour distinguer
// visuellement ce qui vient d'un rôle de ce qui a été accordé directement
// (IBAC, indépendant des rôles) — l'original ne montrait qu'une liste
// fusionnée "permissions effectives", sans indiquer la source. Inspiré de
// team-tool (deux groupes "Rôles" / "Permissions directes" sur sa page
// Membres), adapté au modèle IBAC plus riche d'AGT (un retrait direct prime
// toujours sur un rôle qui accorderait la même permission).
import { Fragment, useState } from "react";
import * as api from "@/lib/api";
import type { PermissionDetail, Role, Utilisateur } from "@/lib/types";

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  superadmin: { bg: "var(--accent-bg)", color: "var(--accent)" },
  admin: { bg: "#f3e8ff", color: "#9333ea" },
  chef_projet: { bg: "#fff7ed", color: "#f59e0b" },
  membre: { bg: "var(--bg-hover)", color: "var(--text-2)" },
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin", admin: "Admin", chef_projet: "Chef de projet", membre: "Membre",
};

const MODULE_LABELS: Record<string, string> = {
  membres: "Membres", rbac: "Rôles & permissions", projets: "Projets",
  dashboard: "Tableau de bord", admin: "Administration", ops: "Opérations",
};

type Bucket = "role" | "direct" | "none";

function bucketOf(p: PermissionDetail): Bucket {
  if (!p.granted) return "none";
  return p.source === "direct" ? "direct" : "role";
}

const BUCKET_LABEL: Record<Bucket, string> = {
  role: "VIA RÔLE", direct: "DIRECTES (INDÉPENDANTES DU RÔLE)", none: "NON ACCORDÉES",
};
const BUCKET_COLOR: Record<Bucket, string> = { role: "var(--accent)", direct: "#9333ea", none: "var(--text-3)" };

function chipStyle(bucket: Bucket): React.CSSProperties {
  if (bucket === "none") {
    return { fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-3)", cursor: "pointer" };
  }
  const color = BUCKET_COLOR[bucket];
  return { fontSize: 11, padding: "4px 10px", borderRadius: 20, border: `1.5px solid ${color}`, background: color, color: "white", cursor: "pointer" };
}

export function RBACView({ members, roles, onReload }: {
  members: Utilisateur[]; roles: Role[]; onReload: () => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, PermissionDetail[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);

  const handleAddRole = async (memberId: number, roleCode: string) => {
    if (!roleCode) return;
    await api.assignRole(memberId, roleCode);
    onReload();
  };

  const handleRemoveRole = async (memberId: number, roleCode: string) => {
    if (roleCode === "superadmin") { alert("Le rôle superadmin ne peut pas être retiré."); return; }
    await api.revokeRole(memberId, roleCode);
    onReload();
  };

  const loadDetail = async (memberId: number) => {
    setLoadingDetail(memberId);
    try {
      const d = await api.getMemberPermissionsDetail(memberId);
      setDetail((prev) => ({ ...prev, [memberId]: d }));
    } finally {
      setLoadingDetail((v) => (v === memberId ? null : v));
    }
  };

  const toggleExpand = (memberId: number) => {
    if (expanded === memberId) { setExpanded(null); return; }
    setExpanded(memberId);
    if (!detail[memberId]) loadDetail(memberId);
  };

  const handleTogglePermission = async (memberId: number, permCode: string, currentlyGranted: boolean) => {
    // Ne PAS appeler onReload() ici : il fait passer la page parente en
    // loading=true, qui démonte RBACView entier et referme le panneau —
    // loadDetail() suffit à rafraîchir ce qui est affiché ici (les rôles,
    // seuls affectés par onReload, ne changent pas quand on bascule une
    // permission directe).
    await api.setMemberPermission(memberId, permCode, !currentlyGranted);
    await loadDetail(memberId);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Rôles &amp; permissions</h2>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>Gestion des rôles multiples et des permissions directes, réservée au Superadmin</span>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-hover)" }}>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>MEMBRE</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>RÔLES</th>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>AJOUTER UN RÔLE</th>
              <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 11, color: "var(--text-3)", fontWeight: 700 }} />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const memberRoles = m.roles;
              const isSuperadminMember = memberRoles.includes("superadmin");
              // Superadmin a déjà un accès total : le rôle Admin (lecture
              // seule) n'a pas de sens en plus et n'est donc pas proposable.
              const availableToAdd = roles.filter((r) => !memberRoles.includes(r.code) && r.code !== "superadmin" && !(r.code === "admin" && isSuperadminMember));
              const memberDetail = detail[m.id];
              const permsByModule = (memberDetail || []).reduce<Record<string, PermissionDetail[]>>((acc, p) => {
                (acc[p.module] = acc[p.module] || []).push(p);
                return acc;
              }, {});

              return (
                <Fragment key={m.id}>
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{m.name}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {memberRoles.map((r) => (
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
                        <option value="">Ajouter</option>
                        {availableToAdd.map((r) => (<option key={r.code} value={r.code}>{ROLE_LABELS[r.code] || r.code}</option>))}
                      </select>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <button onClick={() => toggleExpand(m.id)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}>
                        {expanded === m.id ? "Masquer" : "Permissions"}
                      </button>
                    </td>
                  </tr>
                  {expanded === m.id && (
                    <tr>
                      <td colSpan={4} style={{ padding: "0 14px 14px", background: "var(--bg-hover)" }}>
                        <div style={{ padding: 12, background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)" }}>
                          {isSuperadminMember ? (
                            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                              Superadmin : accès total à toutes les permissions, quels que soient les rôles ou attributions directes.
                            </div>
                          ) : loadingDetail === m.id || !memberDetail ? (
                            <div style={{ fontSize: 12, color: "var(--text-3)" }}>Chargement…</div>
                          ) : (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", marginBottom: 10 }}>
                                PERMISSIONS PAR MODULE (cliquer pour accorder/retirer directement, indépendamment du rôle)
                              </div>
                              {Object.entries(permsByModule).map(([module, perms]) => (
                                <div key={module} style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text)", marginBottom: 6, textTransform: "uppercase" }}>{MODULE_LABELS[module] || module}</div>
                                  {(["role", "direct", "none"] as Bucket[]).map((bucket) => {
                                    const bucketPerms = perms.filter((p) => bucketOf(p) === bucket);
                                    if (bucketPerms.length === 0) return null;
                                    return (
                                      <div key={bucket} style={{ marginBottom: 6 }}>
                                        <div style={{ fontSize: 9.5, fontWeight: 700, color: BUCKET_COLOR[bucket], marginBottom: 3, letterSpacing: ".04em" }}>
                                          {BUCKET_LABEL[bucket]}
                                        </div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                          {bucketPerms.map((p) => (
                                            <button key={p.code} onClick={() => handleTogglePermission(m.id, p.code, p.granted)} title={p.description}
                                              style={chipStyle(bucket)}>
                                              {p.description || p.code}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
