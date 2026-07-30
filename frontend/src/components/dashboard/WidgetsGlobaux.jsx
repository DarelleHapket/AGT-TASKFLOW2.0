// frontend/src/components/dashboard/WidgetsGlobaux.jsx
//
// Widgets de vue globale (superadmin / admin) : chiffres clés de toute
// la plateforme. Composant isolé pour rester facile à étendre (ajouter un
// 5e widget plus tard sans toucher au reste du dashboard).

function Widget({ label, value, color }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

export function WidgetsGlobaux({ membersActifs, demandesEnAttente, projetsCount, rolesActifs }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
      <Widget label="MEMBRES ACTIFS" value={membersActifs} />
      <Widget label="DEMANDES EN ATTENTE" value={demandesEnAttente} />
      <Widget label="PROJETS" value={projetsCount} />
      <Widget label="RÔLES ACTIFS" value={rolesActifs} />
    </div>
  );
}
