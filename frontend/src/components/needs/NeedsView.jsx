import { useState } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

const PREDEFINED_TYPES = ["Matériel", "Logiciel", "Humain", "Autre"];
const STATUSES = [
  { value: "initié",   label: "Initié",   color: "#64748b" },
  { value: "demandé",  label: "Demandé",  color: "#f59e0b" },
  { value: "couvert",  label: "Couvert",  color: "#22c55e" },
];

function StatusBadge({ status }) {
  const s = STATUSES.find((x) => x.value === status) || STATUSES[0];
  return (
    <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.color + "18", color: s.color, border: `1px solid ${s.color}33` }}>
      {s.label}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent)33", letterSpacing: ".04em" }}>
      {type}
    </span>
  );
}

const inp = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, outline: "none", background: "var(--bg-input)", color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box" };
const lbl = { fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 4, display: "block", letterSpacing: ".08em" };

function NeedForm({ initial, projects, activities, onSave, onCancel }) {
  const [f, setF] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    type: initial?.type || "Autre",
    customType: "",
    status: initial?.status || "initié",
    project_id: initial?.project_id ? String(initial.project_id) : "",
    activity_id: initial?.activity_id ? String(initial.activity_id) : "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isCustom = !PREDEFINED_TYPES.includes(f.type);
  const filteredActs = activities.filter((a) => !f.project_id || String(a.project_id) === f.project_id);

  const handleSave = () => {
    if (!f.title.trim()) return;
    const type = isCustom ? f.customType.trim() || "Autre" : f.type;
    onSave({ ...f, type, project_id: f.project_id || null, activity_id: f.activity_id || null });
  };

  return (
    <div style={{ padding: 20, background: "var(--accent-bg)", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={lbl}>TITRE DU BESOIN *</label>
          <input style={inp} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex: Licence Adobe XD" />
        </div>
        <div>
          <label style={lbl}>TYPE</label>
          <select style={inp} value={isCustom ? "__custom__" : f.type} onChange={(e) => set("type", e.target.value === "__custom__" ? f.customType || "" : e.target.value)}>
            {PREDEFINED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value="__custom__">Personnalisé…</option>
          </select>
        </div>
        <div>
          <label style={lbl}>STATUT</label>
          <select style={inp} value={f.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {(isCustom || f.type === "__custom__") && (
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>TYPE PERSONNALISÉ</label>
            <input style={inp} value={f.customType} onChange={(e) => set("customType", e.target.value)} placeholder="Ex: Formation, Infrastructure…" />
          </div>
        )}
        <div>
          <label style={lbl}>PROJET (optionnel)</label>
          <select style={inp} value={f.project_id} onChange={(e) => { set("project_id", e.target.value); set("activity_id", ""); }}>
            <option value="">— Général —</option>
            {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>ACTIVITÉ (optionnel)</label>
          <select style={inp} value={f.activity_id} onChange={(e) => set("activity_id", e.target.value)}>
            <option value="">— Aucune —</option>
            {filteredActs.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={lbl}>DESCRIPTION</label>
          <textarea style={{ ...inp, height: 64, resize: "vertical" }} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Détails du besoin…" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ border: "1px solid var(--border)", background: "white", borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center", gap: 5 }}><X size={13} /> Annuler</button>
        <button onClick={handleSave} style={{ background: "var(--accent)", border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer", color: "white", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}><Check size={13} /> Enregistrer</button>
      </div>
    </div>
  );
}

export function NeedsView({ needs, projects, activities, onAdd, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const visible = filterStatus === "all" ? needs : needs.filter((n) => n.status === filterStatus);

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Besoins</h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{needs.length} besoin{needs.length !== 1 ? "s" : ""}</span>
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); }} style={{ background: "var(--accent)", color: "white", border: "none", padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Nouveau besoin
        </button>
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, padding: "10px 14px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", alignSelf: "center" }}>STATUT</span>
        {["all", ...STATUSES.map((s) => s.value)].map((sv) => {
          const label = sv === "all" ? "Tous" : STATUSES.find((s) => s.value === sv)?.label;
          const active = filterStatus === sv;
          return (
            <button key={sv} onClick={() => setFilterStatus(sv)} style={{ padding: "3px 12px", borderRadius: 20, border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent)" : "transparent", color: active ? "white" : "var(--text-2)", cursor: "pointer", fontSize: 11, fontWeight: active ? 700 : 400 }}>{label}</button>
          );
        })}
      </div>

      <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
        {adding && <NeedForm projects={projects} activities={activities} onSave={async (d) => { await onAdd(d); setAdding(false); }} onCancel={() => setAdding(false)} />}
        {visible.length === 0 && !adding && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
            <div>Aucun besoin enregistré.</div>
          </div>
        )}
        {visible.map((n) =>
          editing?.id === n.id ? (
            <NeedForm key={n.id} initial={n} projects={projects} activities={activities}
              onSave={async (d) => { await onUpdate(n.id, d); setEditing(null); }}
              onCancel={() => setEditing(null)} />
          ) : (
            <div key={n.id} style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                  <TypeBadge type={n.type} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{n.title}</span>
                  <StatusBadge status={n.status} />
                </div>
                {n.description && <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>{n.description}</div>}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {n.project_name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>📁 {n.project_name}</span>}
                  {n.activity_name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>🔖 {n.activity_name}</span>}
                  {!n.project_name && <span style={{ fontSize: 11, color: "var(--text-3)" }}>🌐 Général</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => setEditing(n)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center" }}><Pencil size={13} /></button>
                <button onClick={() => { if (window.confirm("Supprimer ce besoin ?")) onDelete(n.id); }} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}><Trash2 size={13} /></button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}