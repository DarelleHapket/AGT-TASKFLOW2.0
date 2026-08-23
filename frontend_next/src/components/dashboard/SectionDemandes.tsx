"use client";

// Port fidèle de SectionDemandes.jsx.
import { useState } from "react";

interface Demande { id: number; name: string; email: string }

export function SectionDemandes({ demandes, onValidate, onGoToTeam, canValidate }: {
  demandes: Demande[]; onValidate: (id: number, action: "approve" | "reject") => Promise<void>;
  onGoToTeam?: () => void; canValidate: boolean;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleValidate = async (id: number) => {
    setBusyId(id);
    try { await onValidate(id, "approve"); } finally { setBusyId(null); }
  };

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18, marginBottom: 16, boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Demandes de compte en attente</div>
        {onGoToTeam && (
          <button onClick={onGoToTeam} style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}>
            Voir tout
          </button>
        )}
      </div>

      {demandes.length === 0 ? (
        <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>Aucune demande en attente.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 420 }}>
          <thead>
            <tr>
              <th style={thStyle}>Nom</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Statut</th>
              {canValidate && <th style={thStyle}></th>}
            </tr>
          </thead>
          <tbody>
            {demandes.map((d) => (
              <tr key={d.id}>
                <td style={tdStyle}>{d.name}</td>
                <td style={tdStyle}>{d.email}</td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#fef9c3", color: "#ca8a04" }}>En attente</span>
                </td>
                {canValidate && (
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <button onClick={() => handleValidate(d.id)} disabled={busyId === d.id} style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", cursor: busyId === d.id ? "not-allowed" : "pointer" }}>
                      Valider
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: "left", padding: "8px 10px", color: "var(--text-3)", fontWeight: 700, fontSize: 10.5, letterSpacing: ".04em", borderBottom: "1px solid var(--border)" };
const tdStyle: React.CSSProperties = { padding: 10, borderBottom: "1px solid var(--border)" };
