// frontend/src/components/tasks/TaskModal.jsx
import { useState, useEffect } from "react";
import { X, Check, AlertTriangle, Plus, Trash2, Calendar, Clock, User, Flag } from "lucide-react";
import { STATUSES } from "../../utils/pert";
import * as api from "../../api/client";

const inp = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1.5px solid var(--border)", fontSize: 13,
  outline: "none", background: "var(--bg-input)", color: "var(--text)",
  fontFamily: "inherit", boxSizing: "border-box",
};
const lbl = {
  fontSize: 10, fontWeight: 700, color: "var(--text-3)",
  marginBottom: 5, display: "block", letterSpacing: ".08em",
};

const PRIORITIES = [
  { value: "normale",  label: "Normale",  color: "#64748b" },
  { value: "haute",    label: "Haute",    color: "#f59e0b" },
  { value: "critique", label: "Critique", color: "#ef4444" },
];

// ── Composant modal pour les membres (lecture + difficultés) ────────────────
function MemberModal({ task, onClose, currentUser, isAssigned }) {
  const [difficulties, setDifficulties] = useState([]);
  const [newDiff, setNewDiff]           = useState("");
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getDifficulties(task.id)
      .then(setDifficulties)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [task.id]);

  const addDifficulty = async () => {
    if (!newDiff.trim()) return;
    try {
      const d = await api.createDifficulty({ task_id: task.id, content: newDiff.trim() });
      setDifficulties((prev) => [d, ...prev]);
      setNewDiff("");
    } catch (e) { alert(e.message); }
  };

  const deleteDifficulty = async (id) => {
    try {
      await api.deleteDifficulty(id);
      setDifficulties((prev) => prev.filter((d) => d.id !== id));
    } catch (e) { alert(e.message); }
  };

  const priorityColor = { normale: "#64748b", haute: "#f59e0b", critique: "#ef4444" };
  const statusLabel   = STATUSES.find((s) => s.value === task.status)?.label || task.status;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 520, maxHeight: "92vh", overflow: "auto", boxShadow: "var(--shadow-md)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-bg)", padding: "2px 8px", borderRadius: 6 }}>{task.id}</span>
            <h3 style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 800, color: "var(--text)", lineHeight: 1.3 }}>{task.description}</h3>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg)", border: "1px solid var(--border)", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", flexShrink: 0, marginLeft: 12 }}>
            <X size={15} />
          </button>
        </div>

        {/* Infos de la tâche en lecture */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24, background: "var(--bg)", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <User size={13} color="var(--text-3)" />
            <div>
              <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>RESPONSABLE</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{task.responsible || "—"}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Flag size={13} color={priorityColor[task.priority] || "#64748b"} />
            <div>
              <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>PRIORITÉ</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: priorityColor[task.priority] || "var(--text)" }}>
                {PRIORITIES.find((p) => p.value === task.priority)?.label || "Normale"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={13} color="var(--text-3)" />
            <div>
              <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>STATUT</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{statusLabel}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={13} color="var(--text-3)" />
            <div>
              <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>DEADLINE</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: task.due_date ? "#ef4444" : "var(--text)" }}>
                {task.due_date ? new Date(task.due_date).toLocaleDateString("fr-FR") : "—"}
              </div>
            </div>
          </div>
          <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>PROJET / ACTIVITÉ</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                {task.project_name || "—"} {task.activity_name ? `· ${task.activity_name}` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Section difficultés */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={15} color="#f59e0b" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Difficultés signalées</span>
            <span style={{ fontSize: 11, color: "var(--text-3)", background: "var(--bg)", padding: "1px 8px", borderRadius: 10, border: "1px solid var(--border)" }}>{difficulties.length}</span>
          </div>

          {/* Formulaire — uniquement si assigné */}
          {isAssigned && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                style={{ ...inp, flex: 1 }}
                value={newDiff}
                onChange={(e) => setNewDiff(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addDifficulty()}
                placeholder="Décrire le blocage rencontré…"
              />
              <button onClick={addDifficulty} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
                <Plus size={13} /> Signaler
              </button>
            </div>
          )}

          {!isAssigned && (
            <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", marginBottom: 12 }}>
              Seul le membre assigné peut signaler une difficulté.
            </div>
          )}

          {loading && <div style={{ fontSize: 12, color: "var(--text-3)" }}>Chargement…</div>}
          {!loading && difficulties.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>Aucune difficulté signalée</div>
          )}
          {difficulties.map((d) => (
            <div key={d.id} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 4 }}>{d.content}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {d.member_name} · {new Date(d.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
              {d.member_id === currentUser?.id && (
                <button onClick={() => deleteDifficulty(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-2)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal admin — formulaire complet ────────────────────────────────────────
export function TaskModal({ mode, initial, tasks, members, projects, activities, onSave, onClose, isAdmin, currentUser }) {
  const isAssigned = currentUser && initial?.responsible === currentUser.name;

  // Si pas admin → afficher le modal simplifié membre
  if (!isAdmin && initial) {
    return <MemberModal task={initial} onClose={onClose} currentUser={currentUser} isAssigned={isAssigned} />;
  }

  const blank = { id: "", project_id: "", activity_id: "", description: "", duration: 1, dependencies: [], responsible: "", status: "todo", priority: "normale", start_date: "", end_date: "", due_date: "" };
  const [f, setF]                       = useState(initial ? { ...blank, ...initial } : blank);
  const [difficulties, setDifficulties] = useState([]);
  const [newDiff, setNewDiff]           = useState("");
  const [loadingDiff, setLoadingDiff]   = useState(false);

  useEffect(() => {
    if (mode === "add" && !f.id) {
      setF((p) => ({ ...p, id: `T${String(tasks.length + 1).padStart(3, "0")}` }));
    }
    if (mode === "edit" && initial?.id) {
      setLoadingDiff(true);
      api.getDifficulties(initial.id)
        .then(setDifficulties)
        .catch(() => {})
        .finally(() => setLoadingDiff(false));
    }
  }, []);

  const set    = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const togDep = (id) => {
    const d = f.dependencies || [];
    set("dependencies", d.includes(id) ? d.filter((x) => x !== id) : [...d, id]);
  };

  const filteredActivities = activities.filter((a) => !f.project_id || a.project_id === Number(f.project_id));
  const avail = tasks.filter((t) => t.id !== f.id);
  const valid = f.id.trim() && f.description.trim();

  const addDifficulty = async () => {
    if (!newDiff.trim() || !initial?.id) return;
    try {
      const d = await api.createDifficulty({ task_id: initial.id, content: newDiff.trim() });
      setDifficulties((prev) => [d, ...prev]);
      setNewDiff("");
    } catch (e) { alert(e.message); }
  };

  const deleteDifficulty = async (id) => {
    try {
      await api.deleteDifficulty(id);
      setDifficulties((prev) => prev.filter((d) => d.id !== id));
    } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 600, maxHeight: "92vh", overflow: "auto", boxShadow: "var(--shadow-md)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text)" }}>
            {mode === "add" ? "Nouvelle tâche" : "Modifier la tâche"}
          </h3>
          <button onClick={onClose} style={{ background: "var(--bg)", border: "1px solid var(--border)", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)" }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>ID DE LA TÂCHE</label>
            <input style={inp} value={f.id} onChange={(e) => set("id", e.target.value)} placeholder="T001" />
          </div>
          <div>
            <label style={lbl}>DURÉE (COUPONS)</label>
            <input style={inp} type="number" min={1} value={f.duration} onChange={(e) => set("duration", Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          <div>
            <label style={lbl}>PROJET</label>
            <select style={inp} value={f.project_id} onChange={(e) => { set("project_id", e.target.value); set("activity_id", ""); }}>
              <option value="">— Choisir —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>ACTIVITÉ</label>
            <select style={inp} value={f.activity_id} onChange={(e) => set("activity_id", e.target.value)}>
              <option value="">— Choisir —</option>
              {filteredActivities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>DESCRIPTION</label>
            <textarea style={{ ...inp, height: 72, resize: "vertical" }} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Décrivez la tâche…" />
          </div>
          <div>
            <label style={lbl}>RESPONSABLE</label>
            <select style={inp} value={f.responsible} onChange={(e) => set("responsible", e.target.value)}>
              <option value="">— Aucun —</option>
              {members.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>STATUT</label>
            <select style={inp} value={f.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>PRIORITÉ</label>
            <select style={inp} value={f.priority} onChange={(e) => set("priority", e.target.value)}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>DATE DÉBUT</label>
            <input style={inp} type="date" value={f.start_date || ""} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>DATE FIN</label>
            <input style={inp} type="date" value={f.end_date || ""} onChange={(e) => set("end_date", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>DEADLINE</label>
            <input style={inp} type="date" value={f.due_date || ""} onChange={(e) => set("due_date", e.target.value)} />
          </div>

          {avail.length > 0 && (
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>DÉPENDANCES</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {avail.map((t) => {
                  const sel = (f.dependencies || []).includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => togDep(t.id)} style={{ padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${sel ? "var(--accent)" : "var(--border)"}`, background: sel ? "var(--accent-bg)" : "transparent", color: sel ? "var(--accent)" : "var(--text-2)", fontSize: 12, fontWeight: sel ? 700 : 400, cursor: "pointer" }}>
                      {t.id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Section difficultés — admin voit tout */}
        {mode === "edit" && (
          <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={15} color="#f59e0b" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Difficultés signalées</span>
              <span style={{ fontSize: 11, color: "var(--text-3)", background: "var(--bg)", padding: "1px 8px", borderRadius: 10, border: "1px solid var(--border)" }}>{difficulties.length}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input style={{ ...inp, flex: 1 }} value={newDiff} onChange={(e) => setNewDiff(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDifficulty()} placeholder="Ajouter une difficulté…" />
              <button onClick={addDifficulty} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
                <Plus size={13} /> Signaler
              </button>
            </div>
            {loadingDiff && <div style={{ fontSize: 12, color: "var(--text-3)" }}>Chargement…</div>}
            {!loadingDiff && difficulties.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>Aucune difficulté signalée</div>}
            {difficulties.map((d) => (
              <div key={d.id} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 4 }}>{d.content}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{d.member_name} · {new Date(d.created_at).toLocaleDateString("fr-FR")}</div>
                </div>
                <button onClick={() => deleteDifficulty(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-2)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Annuler
          </button>
          <button onClick={() => valid && onSave(f)} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: valid ? "var(--accent)" : "var(--bg)", color: valid ? "white" : "var(--text-3)", cursor: valid ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={14} /> {mode === "add" ? "Créer" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}