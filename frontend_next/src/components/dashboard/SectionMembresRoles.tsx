// Port fidèle de SectionMembresRoles.jsx.
import { ROLE_COLORS, ROLE_LABELS } from "@/components/rbac/RBACView";
import type { Utilisateur } from "@/lib/types";

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  ACTIF: { label: "Actif", bg: "#dcfce7", color: "#16a34a" },
  SUSPENDU: { label: "Suspendu", bg: "var(--danger-bg)", color: "var(--danger)" },
  EN_ATTENTE: { label: "En attente", bg: "#fef9c3", color: "#ca8a04" },
};

export function SectionMembresRoles({ members, canManage, onManageRoles }: {
  members: Utilisateur[]; canManage: boolean; onManageRoles?: () => void;
}) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18, marginBottom: 16, boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Membres &amp; rôles</div>
        {canManage ? (
          <button onClick={onManageRoles} style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 10, border: "none", background: "var(--accent)", color: "white", cursor: "pointer" }}>
            + Gérer les rôles
          </button>
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>Gestion des rôles réservée au Superadmin</span>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 360 }}>
        <thead>
          <tr>
            <th style={thStyle}>Membre</th>
            <th style={thStyle}>Rôle global</th>
            <th style={thStyle}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const roleCode = m.roles[0] || "user";
            const roleLabel = ROLE_LABELS[roleCode] || roleCode;
            const roleColors = ROLE_COLORS[roleCode] || ROLE_COLORS.user;
            const statusMeta = STATUS_META[m.statut] || STATUS_META.ACTIF;
            return (
              <tr key={m.id}>
                <td style={tdStyle}>{m.name}</td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: roleColors.bg, color: roleColors.color }}>{roleLabel}</span>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: statusMeta.bg, color: statusMeta.color }}>{statusMeta.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: "left", padding: "8px 10px", color: "var(--text-3)", fontWeight: 700, fontSize: 10.5, letterSpacing: ".04em", borderBottom: "1px solid var(--border)" };
const tdStyle: React.CSSProperties = { padding: 10, borderBottom: "1px solid var(--border)" };
