import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export function TeamView({ members, onAdd, onDelete }) {
  const [name, setName] = useState("");

  const add = async () => {
    if (name.trim()) { await onAdd({ name: name.trim() }); setName(""); }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Équipe</h2>
      <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
        <div style={{ padding: "12px 16px", background: "var(--bg-hover)", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".1em" }}>
          MEMBRES ({members.length})
        </div>
        {members.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
            <div>Aucun membre pour l'instant.</div>
          </div>
        )}
        {members.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
              {m.name[0]?.toUpperCase() || "?"}
            </div>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{m.name}</span>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: m.color, border: "2px solid var(--border)" }} />
            <button onClick={() => { if (window.confirm(`Retirer ${m.name} de l'équipe ?`)) onDelete(m.id); }} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, padding: 16 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom du nouveau membre…" onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ flex: 1 }} />
          <button onClick={add} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
