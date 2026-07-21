import { useState } from "react";
import { Plus, Pencil, Trash2, X, Check, FileText } from "lucide-react";

const inp = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, outline: "none", background: "var(--bg-input)", color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box" };
const lbl = { fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 4, display: "block", letterSpacing: ".08em" };

function NoteForm({ initial, projects, activities, tasks, onSave, onCancel }) {
  const [f, setF] = useState({
    title: initial?.title || "",
    content: initial?.content || "",
    project_id: initial?.project_id ? String(initial.project_id) : "",
    activity_id: initial?.activity_id ? String(initial.activity_id) : "",
    task_id: initial?.task_id || "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const filteredActs = activities.filter((a) => !f.project_id || String(a.project_id) === f.project_id);
  const filteredTasks = tasks.filter((t) => !f.project_id || String(t.project_id) === f.project_id);

  return (
    <div style={{ padding: 20, background: "#f0fdf4", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={lbl}>TITRE *</label>
          <input style={inp} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Titre de la note…" />
        </div>
        <div>
          <label style={lbl}>PROJET (optionnel)</label>
          <select style={inp} value={f.project_id} onChange={(e) => { set("project_id", e.target.value); set("activity_id", ""); set("task_id", ""); }}>
            <option value="">— Note générale —</option>
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
          <label style={lbl}>TÂCHE LIÉE (optionnel)</label>
          <select style={inp} value={f.task_id} onChange={(e) => set("task_id", e.target.value)}>
            <option value="">— Aucune —</option>
            {filteredTasks.map((t) => <option key={t.id} value={t.id}>{t.id} — {(t.description || "").slice(0, 40)}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={lbl}>CONTENU</label>
          <textarea style={{ ...inp, height: 100, resize: "vertical" }} value={f.content} onChange={(e) => set("content", e.target.value)} placeholder="Contenu de la note…" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ border: "1px solid var(--border)", background: "white", borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center", gap: 5 }}><X size={13} /> Annuler</button>
        <button onClick={() => f.title.trim() && onSave({ ...f, project_id: f.project_id || null, activity_id: f.activity_id || null, task_id: f.task_id || null })}
          style={{ background: "#16a34a", border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer", color: "white", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
          <Check size={13} /> Enregistrer
        </button>
      </div>
    </div>
  );
}

export function NotesView({ notes, projects, activities, tasks, user, onAdd, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterPid, setFilterPid] = useState("all");

  const visible = filterPid === "all" ? notes
    : filterPid === "general" ? notes.filter((n) => !n.project_id)
    : notes.filter((n) => String(n.project_id) === filterPid);

  const fmt = (dt) => dt ? new Date(dt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  // Une note m'appartient si je suis l'auteur (ou si elle n'a pas d'auteur — ancienne note)
  const isMine = (n) => n.member_id == null || String(n.member_id) === String(user?.id);

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Notes</h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); }} style={{ background: "#16a34a", color: "white", border: "none", padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Nouvelle note
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, padding: "10px 14px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", alignSelf: "center" }}>FILTRER</span>
        {[{ v: "all", l: "Toutes" }, { v: "general", l: "Générales" }, ...projects.map((p) => ({ v: String(p.id), l: p.name }))].map(({ v, l }) => {
          const active = filterPid === v;
          return <button key={v} onClick={() => setFilterPid(v)} style={{ padding: "3px 12px", borderRadius: 20, border: `1.5px solid ${active ? "#16a34a" : "var(--border)"}`, background: active ? "#16a34a" : "transparent", color: active ? "white" : "var(--text-2)", cursor: "pointer", fontSize: 11, fontWeight: active ? 700 : 400 }}>{l}</button>;
        })}
      </div>

      <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
        {adding && <NoteForm projects={projects} activities={activities} tasks={tasks} onSave={async (d) => { await onAdd(d); setAdding(false); }} onCancel={() => setAdding(false)} />}
        {visible.length === 0 && !adding && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📝</div>
            <div>Aucune note pour ce filtre.</div>
          </div>
        )}
        {visible.map((n) =>
          editing?.id === n.id ? (
            <NoteForm key={n.id} initial={n} projects={projects} activities={activities} tasks={tasks}
              onSave={async (d) => { await onUpdate(n.id, d); setEditing(null); }}
              onCancel={() => setEditing(null)} />
          ) : (
            <div key={n.id} style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={15} color="#16a34a" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 3 }}>{n.title}</div>
                {n.content && <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 5, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{n.content.slice(0, 200)}{n.content.length > 200 ? "…" : ""}</div>}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "var(--text-3)" }}>
                  {n.author_name && <span style={{ fontWeight: 600, color: "var(--text-2)" }}>✍️ {n.author_name}</span>}
                  {n.project_name ? <span>📁 {n.project_name}</span> : <span>🌐 Générale</span>}
                  {n.activity_name && <span>🔖 {n.activity_name}</span>}
                  {n.task_id && <span>📋 {n.task_id}</span>}
                  <span style={{ marginLeft: "auto" }}>🕐 {fmt(n.updated_at)}</span>
                </div>
              </div>
              {/* Actions : uniquement sur MES notes */}
              {isMine(n) ? (
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setEditing(n)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center" }}><Pencil size={13} /></button>
                  <button onClick={() => { if (window.confirm("Supprimer cette note ?")) onDelete(n.id); }} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}><Trash2 size={13} /></button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", flexShrink: 0, fontSize: 10, color: "var(--text-3)", fontStyle: "italic", padding: "0 6px" }}>
                  lecture seule
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}