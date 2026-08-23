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
import { Plus, X } from "lucide-react";
import * as api from "@/lib/api";
import type { Permission, PermissionDetail, Role, Utilisateur } from "@/lib/types";

const rbacCard: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)" };
const rbacInp: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" };

// Catalogue Rôles + Permissions — ajouté pour permettre de créer de nouvelles
// permissions/rôles (même logique que team-tool, frontend/src/app/rbac/page.tsx),
// en plus de la gestion par membre déjà en place ci-dessous. Cliquer un badge
// de permission sur un rôle bascule le PATCH permission_ids de CE rôle (les
// permissions par défaut, copiées à l'attribution — BF-05), indépendant des
// retraits/ajouts directs par membre (IBAC, table du bas).
function RoleCatalog({ roles, permissions, onReload }: { roles: Role[]; permissions: Permission[]; onReload: () => void }) {
  const [newRole, setNewRole] = useState("");
  const [newPerm, setNewPerm] = useState({ verbe: "", ressource: "" });
  const [error, setError] = useState<string | null>(null);

  async function creerRole() {
    if (!newRole.trim()) return;
    setError(null);
    try { await api.createRole({ code: newRole.trim() }); setNewRole(""); onReload(); }
    catch (e) { setError(api.errorMessage(e, "Création impossible")); }
  }

  async function supprimerRole(r: Role) {
    if (r.code === "superadmin") return;
    await api.deleteRole(r.id).catch((e) => setError(api.errorMessage(e, "Suppression impossible")));
    onReload();
  }

  async function basculerPermRole(r: Role, permId: number) {
    const ids = r.permissions.map((p) => p.id);
    const suivants = ids.includes(permId) ? ids.filter((x) => x !== permId) : [...ids, permId];
    await api.setRolePermissions(r.id, suivants).catch((e) => setError(api.errorMessage(e, "Mise à jour impossible")));
    onReload();
  }

  async function creerPermission() {
    const verbe = newPerm.verbe.trim().toLowerCase();
    const ressource = newPerm.ressource.trim().toLowerCase();
    if (!verbe || !ressource) return;
    setError(null);
    // Style team-tool : "verbe:ressource" (ex: gerer:conges) — module = ressource,
    // utilisé uniquement pour le regroupement d'affichage (MODULE_LABELS).
    try { await api.createPermission({ code: `${verbe}:${ressource}`, module: ressource }); setNewPerm({ verbe: "", ressource: "" }); onReload(); }
    catch (e) { setError(api.errorMessage(e, "Création impossible")); }
  }

  async function supprimerPermission(p: Permission) {
    await api.deletePermission(p.id).catch((e) => setError(api.errorMessage(e, "Suppression impossible")));
    onReload();
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {error && <p style={{ marginBottom: 10, fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16, alignItems: "start" }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", margin: "0 0 8px" }}>Rôles (catalogue)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {roles.map((r) => (
              <div key={r.id} style={{ ...rbacCard, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <b style={{ fontSize: 13, color: "var(--text)" }}>{ROLE_LABELS[r.code] || r.code}</b>
                  {r.code !== "superadmin" && (
                    <button onClick={() => supprimerRole(r)} title="Supprimer ce rôle" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}><X size={14} /></button>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {permissions.map((p) => {
                    const active = r.permissions.some((x) => x.id === p.id);
                    return (
                      <button key={p.id} onClick={() => basculerPermRole(r, p.id)} title={p.description}
                        style={{
                          fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                          background: active ? "var(--accent)" : "transparent",
                          color: active ? "white" : "var(--text-3)", fontWeight: active ? 700 : 400,
                        }}>
                        {p.code}
                      </button>
                    );
                  })}
                  {permissions.length === 0 && <span style={{ fontSize: 11, color: "var(--text-3)" }}>Aucune permission dans le catalogue.</span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ ...rbacCard, padding: 12, marginTop: 10, display: "flex", gap: 6 }}>
            <input style={{ ...rbacInp, flex: 1 }} placeholder="Nom du rôle (ex: comptable)" value={newRole} onChange={(e) => setNewRole(e.target.value)} onKeyDown={(e) => e.key === "Enter" && creerRole()} />
            <button onClick={creerRole} disabled={!newRole.trim()} style={{ ...rbacInp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}><Plus size={13} /></button>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", margin: "0 0 8px" }}>Permissions (catalogue)</h3>
          <div style={{ ...rbacCard, padding: 12 }}>
            {permissions.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                <span style={{ color: "var(--text)" }}>{p.code} <span style={{ color: "var(--text-3)" }}>({p.module})</span></span>
                <button onClick={() => supprimerPermission(p)} title="Supprimer cette permission" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}><X size={13} /></button>
              </div>
            ))}
            {permissions.length === 0 && <p style={{ fontSize: 12, color: "var(--text-3)" }}>Aucune permission.</p>}
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input style={{ ...rbacInp, flex: 1 }} placeholder="Verbe (ex: gerer)" value={newPerm.verbe} onChange={(e) => setNewPerm({ ...newPerm, verbe: e.target.value })} />
              <input style={{ ...rbacInp, flex: 1 }} placeholder="Ressource (ex: conges)" value={newPerm.ressource} onChange={(e) => setNewPerm({ ...newPerm, ressource: e.target.value })} />
              <button onClick={creerPermission} disabled={!newPerm.verbe.trim() || !newPerm.ressource.trim()} style={{ ...rbacInp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}><Plus size={13} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Catalogue réduit à 2 rôles par défaut (superadmin + user, 2026-08-19) —
// tout autre code est un rôle personnalisé créé via cet écran, affiché avec
// la couleur/le libellé de repli (fallback) au point d'appel.
export const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  superadmin: { bg: "var(--accent-bg)", color: "var(--accent)" },
  user: { bg: "var(--bg-hover)", color: "var(--text-2)" },
};

export const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin", user: "Utilisateur",
};

export const MODULE_LABELS: Record<string, string> = {
  membres: "Membres", rbac: "Rôles & permissions", projets: "Projets",
  dashboard: "Tableau de bord", admin: "Administration", ops: "Opérations",
  rh: "RH & Profils", finances: "Finances", materiel: "Matériel", pilotage: "Pilotage (PERT/tâches)",
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

export function RBACView({ members, roles, permissions, onReload }: {
  members: Utilisateur[]; roles: Role[]; permissions: Permission[]; onReload: () => void;
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

      <RoleCatalog roles={roles} permissions={permissions} onReload={onReload} />

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
       <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
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
              // Catalogue réduit à 2 rôles par défaut (superadmin + user,
              // 2026-08-19) — superadmin a déjà un accès total, jamais
              // proposable en plus. Tout autre rôle listé ici est un rôle
              // personnalisé créé par le Superadmin, sans contrainte
              // d'unicité particulière.
              const availableToAdd = roles.filter((r) => !memberRoles.includes(r.code) && r.code !== "superadmin");
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
    </div>
  );
}
