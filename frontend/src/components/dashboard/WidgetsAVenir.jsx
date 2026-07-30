// frontend/src/components/dashboard/WidgetsAVenir.jsx
//
// Encarts vides annonçant les modules pas encore construits (Matériel S2,
// RH S3, Finances S4, Documents S5). À supprimer un par un au fur et à
// mesure que chaque module est livré, sans toucher au reste du dashboard.

function WidgetVide({ label }) {
  return (
    <div style={{
      background: "var(--bg-hover)", border: "1.5px dashed var(--border-2, #cbd5e1)",
      borderRadius: "var(--radius-lg)", padding: 18, textAlign: "center",
      color: "var(--text-3)", fontSize: 12,
    }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>▢</div>
      {label}
    </div>
  );
}

export function WidgetsAVenir() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
      <WidgetVide label="Matériel — S2" />
      <WidgetVide label="RH — S3" />
      <WidgetVide label="Finances — S4" />
      <WidgetVide label="Documents — S5" />
    </div>
  );
}
