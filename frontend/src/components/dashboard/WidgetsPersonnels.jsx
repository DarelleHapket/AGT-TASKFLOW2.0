// frontend/src/components/dashboard/WidgetsPersonnels.jsx
//
// Widgets de vue restreinte (chef de projet / membre) : chiffres centrés
// sur l'activité propre de l'utilisateur, pas sur toute la plateforme.

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

// Vue Chef de projet : ses projets, son équipe, ses tâches en cours.
export function WidgetsChef({ mesProjets, monEquipe, tachesEnCours, difficultesSignalees }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
      <Widget label="MES PROJETS" value={mesProjets} />
      <Widget label="MON ÉQUIPE" value={monEquipe} />
      <Widget label="TÂCHES EN COURS" value={tachesEnCours} />
      <Widget label="DIFFICULTÉS SIGNALÉES" value={difficultesSignalees} color="var(--warning, #f59e0b)" />
    </div>
  );
}

// Vue Membre : ses propres tâches uniquement.
export function WidgetsMembre({ mesTaches, enCours, terminees, enRetard }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
      <Widget label="MES TÂCHES" value={mesTaches} />
      <Widget label="EN COURS" value={enCours} color="#2563eb" />
      <Widget label="TERMINÉES" value={terminees} color="var(--success, #22c55e)" />
      <Widget label="EN RETARD" value={enRetard} color={enRetard > 0 ? "var(--danger)" : "var(--text)"} />
    </div>
  );
}
