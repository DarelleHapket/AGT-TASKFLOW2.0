// frontend/src/components/dashboard/SectionMembresRoles.jsx
//
// Vue résumée des membres et de leurs rôles depuis le dashboard. La
// gestion complète (attribution/retrait de rôle) reste dans l'écran
// "Membres" dédié — ici c'est une consultation rapide + lien vers l'écran
// complet, sauf si canManage est faux (ex. Admin peut consulter mais pas
// gérer les rôles, réservé au Superadmin selon le CdC).

const ROLE_META = {
  superadmin:  { label: "Superadmin",     bg: "var(--accent-bg)", color: "var(--accent)" },
  admin:       { label: "Admin",          bg: "#f3e8ff", color: "#9333ea" },
  chef_projet: { label: "Chef de projet", bg: "#fff7ed", color: "var(--warning, #f59e0b)" },
  membre:      { label: "Membre",         bg: "var(--bg-hover)", color: "var(--text-2)" },
};

const STATUS_META = {
  active:    { label: "Actif",     bg: "#dcfce7", color: "#16a34a" },
  suspended: { label: "Suspendu",  bg: "var(--danger-bg)", color: "var(--danger)" },
  pending:   { label: "En attente",bg: "#fef9c3", color: "#ca8a04" },
};

export function SectionMembresRoles({ members, canManage, onManageRoles }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: 18, marginBottom: 16,
      boxShadow: "var(--shadow)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Membres &amp; rôles</div>
        {canManage ? (
          <button onClick={onManageRoles} style={{
            fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 10,
            border: "none", background: "var(--accent)", color: "white", cursor: "pointer",
          }}>
            + Gérer les rôles
          </button>
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            Gestion des rôles réservée au Superadmin
          </span>
        )}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            <th style={thStyle}>Membre</th>
            <th style={thStyle}>Rôle global</th>
            <th style={thStyle}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const roleMeta = ROLE_META[m.role] || ROLE_META.membre;
            const statusKey = m.is_active === 0 ? "suspended" : (m.status === "pending" ? "pending" : "active");
            const statusMeta = STATUS_META[statusKey];
            return (
              <tr key={m.id}>
                <td style={tdStyle}>{m.name}</td>
                <td style={tdStyle}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                    background: roleMeta.bg, color: roleMeta.color,
                  }}>
                    {roleMeta.label}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                    background: statusMeta.bg, color: statusMeta.color,
                  }}>
                    {statusMeta.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  textAlign: "left", padding: "8px 10px", color: "var(--text-3)",
  fontWeight: 700, fontSize: 10.5, letterSpacing: ".04em",
  borderBottom: "1px solid var(--border)",
};
const tdStyle = { padding: 10, borderBottom: "1px solid var(--border)" };
