import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

function ActivityForm({ initial, projects, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [desc, setDesc] = useState(initial?.description || "");
  const [pid, setPid] = useState(initial?.project_id ? String(initial.project_id) : "");

  return (
    <div style={{ padding: "14px 16px", background: "var(--accent-bg)", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>PROJET</label>
        <select value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">— Choisir —</option>
          {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>NOM DE L'ACTIVITÉ</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Backend" />
      </div>
      <div style={{ flex: 2, minWidth: 180 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>DESCRIPTION</label>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description optionnelle…" />
      </div>
      <div style={{ display: "flex", gap: 8, paddingBottom: 1 }}>
        <button onClick={onCancel} style={{ border: "1px solid var(--border)", background: "white", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center" }}>
          <X size={14} />
        </button>
        <button
          onClick={() => name.trim() && pid && onSave({ name: name.trim(), description: desc.trim(), project_id: Number(pid) })}
          style={{ background: "var(--accent)", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: "white", display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 13 }}
        >
          <Check size={14} /> Enregistrer
        </button>
      </div>
    </div>
  );
}

export function ActivitiesView({ activities, projects, onAdd, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterPid, setFilterPid] = useState("all");

  const visible = filterPid === "all" ? activities : activities.filter((a) => String(a.project_id) === filterPid);

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Activités</h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{activities.length} activité{activities.length !== 1 ? "s" : ""}</span>
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); }} style={{ background: "var(--accent)", color: "white", border: "none", padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Nouvelle activité
        </button>
      </div>

      {/* Filter by project */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, padding: "10px 14px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", alignSelf: "center" }}>PROJET</span>
        {["all", ...projects.map((p) => String(p.id))].map((pid) => {
          const label = pid === "all" ? "Tous" : projects.find((p) => String(p.id) === pid)?.name;
          return (
            <button key={pid} onClick={() => setFilterPid(pid)} style={{ padding: "3px 12px", borderRadius: 20, border: `1.5px solid ${filterPid === pid ? "var(--accent)" : "var(--border)"}`, background: filterPid === pid ? "var(--accent)" : "transparent", color: filterPid === pid ? "white" : "var(--text-2)", cursor: "pointer", fontSize: 11, fontWeight: filterPid === pid ? 700 : 400 }}>{label}</button>
          );
        })}
      </div>

      <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
        {adding && (
          <ActivityForm projects={projects} onSave={async (d) => { await onAdd(d); setAdding(false); }} onCancel={() => setAdding(false)} />
        )}
        {visible.length === 0 && !adding && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔖</div>
            <div>Aucune activité pour ce filtre.</div>
          </div>
        )}
        {visible.map((a) =>
          editing?.id === a.id ? (
            <ActivityForm key={a.id} initial={a} projects={projects} onSave={async (d) => { await onUpdate(a.id, d); setEditing(null); }} onCancel={() => setEditing(null)} />
          ) : (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🔖</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>📁 {a.project_name}{a.description ? ` · ${a.description}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditing(a)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center" }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => { if (window.confirm(`Supprimer l'activité "${a.name}" ?`)) onDelete(a.id); }} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
