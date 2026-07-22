// frontend/src/components/tasks/TaskModal.jsx
//
// A-04 — Refonte complète (permission full/status_only/read_only)
// A-07 — Affichage des erreurs backend inline :
//   • saveError state capturé lors du onSave (403 projet, 400 responsable, etc.)
//   • Bannière d'erreur rouge affichée dans le modal sans le fermer
//   • Sélecteur de projet : filtre sur les projets où l'utilisateur peut créer
//     (user_role === 'owner' || 'manager') en mode "add"

import { useState, useEffect } from "react";
import { X, Check, AlertTriangle, Plus, Trash2, Network } from "lucide-react";
import { STATUSES } from "../../utils/pert";
import * as api from "../../api/client";

// ── Styles partagés ──────────────────────────────────────────────────────────
const inp = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1.5px solid var(--border)", fontSize: 13,
  outline: "none", background: "var(--bg-input)", color: "var(--text)",
  fontFamily: "inherit", boxSizing: "border-box",
};
const inpDisabled = {
  ...inp, background: "var(--bg)", color: "var(--text-2)",
  cursor: "not-allowed", opacity: 0.65,
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

const STATUS_COLOR = {
  todo: "#64748b", in_progress: "#3b82f6", done: "#22c55e", blocked: "#ef4444",
};
const STATUS_BG = {
  todo: "#f1f5f9", in_progress: "#eff6ff", done: "#f0fdf4", blocked: "#fef2f2",
};
const PRIORITY_COLOR = { normale: "#64748b", haute: "#f59e0b", critique: "#ef4444" };
const PRIORITY_BG    = { normale: "#f1f5f9", haute: "#fffbeb", critique: "#fef2f2" };

// ── Wrapper modal ────────────────────────────────────────────────────────────
function ModalShell({ children, maxWidth = 520 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: "var(--bg-card)", borderRadius: 20, width: "100%",
        maxWidth, maxHeight: "92vh", overflow: "auto",
        boxShadow: "var(--shadow-md)", border: "1px solid var(--border)",
      }}>
        {children}
      </div>
    </div>
  );
}

// ── AdminModal — vue directeur (inchangée) ───────────────────────────────────
function AdminModal({ task, onClose }) {
  const [diffCount, setDiffCount] = useState(0);

  useEffect(() => {
    api.getDifficulties(task.id).then((d) => setDiffCount(d.length)).catch(() => {});
  }, [task.id]);

  const statusLabel   = STATUSES.find((s) => s.value === task.status)?.label || task.status;
  const priorityLabel = PRIORITIES.find((p) => p.value === task.priority)?.label || "Normale";
  const priorityColor = PRIORITY_COLOR[task.priority] || "#64748b";
  const priorityBg    = PRIORITY_BG[task.priority]    || "#f1f5f9";
  const statusColor   = STATUS_COLOR[task.status]     || "#64748b";
  const statusBg      = STATUS_BG[task.status]        || "#f1f5f9";

  const slack   = task.slack ?? null;
  const isCrit  = slack === 0;
  const slackBg = isCrit ? "#fef2f2" : slack !== null && slack <= 2 ? "#fffbeb" : "#f0fdf4";
  const slackClr = isCrit ? "#ef4444" : slack !== null && slack <= 2 ? "#f59e0b" : "#22c55e";
  const pertBg  = isCrit ? "#fef2f2" : "var(--bg)";
  const pertBdr = isCrit ? "#fecaca" : "var(--border)";
  const pertClr = isCrit ? "#ef4444" : "var(--text-2)";

  const fmt = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
  const deadlineColor = task.due_date && task.due_date < new Date().toISOString().slice(0, 10)
    ? "#ef4444" : "var(--text)";
  const initials = (task.responsible || "?")[0].toUpperCase();

  const Info = ({ label, value, color = "var(--text)" }) => (
    <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".07em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color }}>{value}</div>
    </div>
  );

  return (
    <ModalShell maxWidth={500}>
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-bg)", padding: "2px 8px", borderRadius: 6 }}>{task.id}</span>
            <p style={{ margin: "8px 0 2px", fontSize: 15, fontWeight: 800, color: "var(--text)", lineHeight: 1.3 }}>{task.description}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>Vue superviseur</p>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg)", border: "1px solid var(--border)", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1px solid var(--border)" }}>
        {[
          { label: "STATUT",   node: <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: statusBg, padding: "3px 8px", borderRadius: 6 }}>{statusLabel}</span> },
          { label: "PRIORITÉ", node: <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor, background: priorityBg, padding: "3px 8px", borderRadius: 6 }}>{priorityLabel}</span> },
          { label: "DURÉE",    node: <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{task.duration} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-3)" }}>coupon{task.duration > 1 ? "s" : ""}</span></span> },
          { label: "MARGE",    node: slack === null ? <span style={{ fontSize: 13, color: "var(--text-3)" }}>—</span> : <span style={{ fontSize: 14, fontWeight: 800, color: slackClr, background: slackBg, padding: "2px 8px", borderRadius: 6 }}>{slack} {isCrit ? "🔴" : slack <= 2 ? "🟡" : "🟢"}</span> },
        ].map(({ label, node }) => (
          <div key={label} style={{ padding: "12px 14px", borderRight: "1px solid var(--border)" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".08em", marginBottom: 6 }}>{label}</div>
            {node}
          </div>
        ))}
      </div>

      <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".08em", marginBottom: 8 }}>CONTEXTE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Info label="PROJET"   value={task.project_name  || "—"} />
            <Info label="ACTIVITÉ" value={task.activity_name || "—"} />
            <div style={{ gridColumn: "1/-1", background: "var(--bg)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "var(--accent)", flexShrink: 0 }}>
                {initials}
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".07em" }}>RESPONSABLE</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginTop: 1 }}>{task.responsible || "—"}</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".08em", marginBottom: 8 }}>CALENDRIER</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <Info label="DÉBUT"      value={fmt(task.start_date)} />
            <Info label="FIN PRÉVUE" value={fmt(task.end_date)} />
            <Info label="DEADLINE"   value={fmt(task.due_date)} color={deadlineColor} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".08em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Network size={11} /> CHEMIN CRITIQUE (PERT)
          </div>
          <div style={{ background: pertBg, border: `1px solid ${pertBdr}`, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {[{ label: "ES", value: task.es ?? "—" }, { label: "EF", value: task.ef ?? "—" }, { label: "LS", value: task.ls ?? "—" }, { label: "LF", value: task.lf ?? "—" }].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 4, marginRight: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: pertClr, opacity: .7 }}>{label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: pertClr }}>{value}</span>
              </div>
            ))}
            <div style={{ marginLeft: "auto" }}>
              {isCrit
                ? <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", background: "#fee2e2", padding: "3px 10px", borderRadius: 6 }}>Sur le chemin critique</span>
                : slack !== null
                  ? <span style={{ fontSize: 11, fontWeight: 600, color: "#22c55e", background: "#f0fdf4", padding: "3px 10px", borderRadius: 6 }}>Marge disponible : {slack}</span>
                  : null
              }
            </div>
          </div>
        </div>

        {diffCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
            <AlertTriangle size={15} color="#f59e0b" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
              {diffCount} signalement{diffCount > 1 ? "s" : ""} de blocage sur cette tâche
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 24px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-2)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Fermer
        </button>
      </div>
    </ModalShell>
  );
}

// ── Modal principal ──────────────────────────────────────────────────────────

export function TaskModal({
  mode, initial, tasks, members, projects, activities,
  onSave, onStatusChange, onClose, isAdmin, currentUser,
}) {
  if (isAdmin && initial) {
    return <AdminModal task={initial} onClose={onClose} />;
  }

  const permission   = mode === "add" ? "full" : (initial?.permission || "read_only");
  const isFull       = permission === "full";
  const isStatusOnly = permission === "status_only";
  const isReadOnly   = permission === "read_only";
  const isAssigned   = currentUser && initial?.responsible === currentUser.name;

  const blank = {
    id: "", project_id: "", activity_id: "", description: "",
    duration: 1, dependencies: [], responsible: "", status: "todo",
    priority: "normale", start_date: "", end_date: "", due_date: "",
  };

  const [f,             setF]           = useState(initial ? { ...blank, ...initial } : blank);
  const [difficulties,  setDifficulties] = useState([]);
  const [newDiff,       setNewDiff]      = useState("");
  const [loadingDiff,   setLoadingDiff]  = useState(false);
  const [saveError,     setSaveError]    = useState(null);   // A-07 : erreur backend
  const [saving,        setSaving]       = useState(false);

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

  const set    = (k, v) => { setSaveError(null); setF((p) => ({ ...p, [k]: v })); };
  const togDep = (id) => {
    const d = f.dependencies || [];
    set("dependencies", d.includes(id) ? d.filter((x) => x !== id) : [...d, id]);
  };

  // En mode "add", filtrer les projets sur lesquels l'utilisateur peut créer
  const creatableProjects = mode === "add"
    ? projects.filter((p) => p.user_role === "owner" || p.user_role === "manager")
    : projects;

  const filteredActivities = activities.filter(
    (a) => !f.project_id || a.project_id === Number(f.project_id)
  );
  const avail = tasks.filter((t) => t.id !== f.id);
  const valid = f.id.trim() && f.description.trim() && (mode !== "add" || !!f.project_id);

  // ── Sauvegarde avec gestion d'erreur ────────────────────────────────────────
  const handleSave = async () => {
    if (!valid || saving) return;
    setSaveError(null);
    setSaving(true);
    try {
      await onSave(f);
      // Si onSave ne lève pas d'erreur, le modal est fermé par App.jsx
    } catch (e) {
      setSaveError(e.message || "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

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

  const fieldProps = (extra = {}) => ({
    style: isFull ? inp : inpDisabled,
    disabled: !isFull,
    ...extra,
  });

  const handleStatusChange = (newStatus) => {
    if (isStatusOnly) {
      onStatusChange(f.id, newStatus);
      set("status", newStatus);
    } else {
      set("status", newStatus);
    }
  };

  const modalTitle = mode === "add"
    ? "Nouvelle tâche"
    : isFull ? "Modifier la tâche" : "Détails de la tâche";

  return (
    <ModalShell maxWidth={600}>
      {/* Header */}
      <div style={{
        padding: "20px 28px 16px", borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text)" }}>
          {modalTitle}
        </h3>
        <button onClick={onClose} style={{
          background: "var(--bg)", border: "1px solid var(--border)",
          width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-2)",
        }}>
          <X size={15} />
        </button>
      </div>

      {/* Bannière de permission */}
      {(isStatusOnly || isReadOnly) && (
        <div style={{
          margin: "16px 28px 0", padding: "8px 12px",
          background: isStatusOnly ? "var(--accent-bg)" : "var(--bg)",
          border: "1px solid var(--border)", borderRadius: 8,
          fontSize: 12, color: "var(--text-2)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {isStatusOnly
            ? <>🔓 Vous êtes responsable de cette tâche : vous pouvez modifier son <b>statut</b> ci-dessous.</>
            : <>🔒 Lecture seule — vous n'avez pas de droits d'édition sur cette tâche.</>
          }
        </div>
      )}

      {/* Bannière d'erreur backend (A-07) */}
      {saveError && (
        <div style={{
          margin: "12px 28px 0", padding: "10px 14px",
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 8, fontSize: 13, color: "#dc2626",
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{saveError}</span>
        </div>
      )}

      {/* Formulaire */}
      <div style={{ padding: "20px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>ID DE LA TÂCHE</label>
            <input {...fieldProps({ value: f.id, onChange: (e) => set("id", e.target.value), placeholder: "T001" })} />
          </div>
          <div>
            <label style={lbl}>DURÉE (COUPONS)</label>
            <input {...fieldProps({ type: "number", min: 1, value: f.duration, onChange: (e) => set("duration", Math.max(1, parseInt(e.target.value) || 1)) })} />
          </div>
          <div>
            <label style={lbl}>PROJET {mode === "add" && <span style={{ color: "#ef4444" }}>*</span>}</label>
            <select {...fieldProps({ value: f.project_id, onChange: (e) => { set("project_id", e.target.value); set("activity_id", ""); } })}>
              {mode === "add" ? (
                <>
                  <option value="" disabled>-- Sélectionner un projet (obligatoire) --</option>
                  {creatableProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </>
              ) : (
                <>
                  <option value="">-- Aucun --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </>
              )}
            </select>
            {mode === "add" && creatableProjects.length === 0 && (
              <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                Aucun projet disponible. Créez d'abord un projet ou demandez à en rejoindre un en tant que manager.
              </div>
            )}
          </div>
          <div>
            <label style={lbl}>ACTIVITÉ</label>
            <select {...fieldProps({ value: f.activity_id, onChange: (e) => set("activity_id", e.target.value) })}>
              <option value="">— Choisir —</option>
              {filteredActivities.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>DESCRIPTION</label>
            <textarea {...fieldProps({
              style: { ...(isFull ? inp : inpDisabled), height: 72, resize: "vertical" },
              value: f.description,
              onChange: (e) => set("description", e.target.value),
              placeholder: "Décrivez la tâche…",
            })} />
          </div>
          <div>
            <label style={lbl}>RESPONSABLE</label>
            <select {...fieldProps({ value: f.responsible, onChange: (e) => set("responsible", e.target.value) })}>
              <option value="">— Aucun —</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>STATUT</label>
            <select
              value={f.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isReadOnly}
              style={isReadOnly ? inpDisabled : inp}
            >
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>PRIORITÉ</label>
            <select {...fieldProps({ value: f.priority, onChange: (e) => set("priority", e.target.value) })}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>DATE DÉBUT</label>
            <input {...fieldProps({ type: "date", value: f.start_date || "", onChange: (e) => set("start_date", e.target.value) })} />
          </div>
          <div>
            <label style={lbl}>DATE FIN</label>
            <input {...fieldProps({ type: "date", value: f.end_date || "", onChange: (e) => set("end_date", e.target.value) })} />
          </div>
          <div>
            <label style={lbl}>DEADLINE</label>
            <input {...fieldProps({ type: "date", value: f.due_date || "", onChange: (e) => set("due_date", e.target.value) })} />
          </div>
          {avail.length > 0 && (
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>DÉPENDANCES</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {avail.map((t) => {
                  const sel = (f.dependencies || []).includes(t.id);
                  return (
                    <button
                      key={t.id} type="button"
                      onClick={() => isFull && togDep(t.id)}
                      disabled={!isFull}
                      style={{
                        padding: "4px 10px", borderRadius: 6,
                        border: `1.5px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                        background: sel ? "var(--accent-bg)" : "transparent",
                        color: sel ? "var(--accent)" : "var(--text-2)",
                        fontSize: 12, fontWeight: sel ? 700 : 400,
                        cursor: isFull ? "pointer" : "not-allowed",
                        opacity: isFull ? 1 : 0.65,
                      }}
                    >
                      {t.id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Section difficultés (mode édition uniquement) */}
        {mode === "edit" && (
          <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={15} color="#f59e0b" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                Difficultés signalées
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)", background: "var(--bg)", padding: "1px 8px", borderRadius: 10, border: "1px solid var(--border)" }}>
                {difficulties.length}
              </span>
            </div>

            {isAssigned ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  style={{ ...inp, flex: 1 }}
                  value={newDiff}
                  onChange={(e) => setNewDiff(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDifficulty()}
                  placeholder="Décrire le blocage rencontré…"
                />
                <button onClick={addDifficulty} style={{
                  background: "var(--accent)", color: "white",
                  border: "none", borderRadius: 8, padding: "0 14px",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  gap: 5, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
                }}>
                  <Plus size={13} /> Signaler
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", marginBottom: 12 }}>
                Seul le membre assigné peut signaler une difficulté.
              </div>
            )}

            {loadingDiff && <div style={{ fontSize: 12, color: "var(--text-3)" }}>Chargement…</div>}
            {!loadingDiff && difficulties.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>
                Aucune difficulté signalée
              </div>
            )}
            {difficulties.map((d) => (
              <div key={d.id} style={{
                background: "#fffbeb", border: "1px solid #fde68a",
                borderRadius: 8, padding: "10px 12px", marginBottom: 8,
                display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 4 }}>{d.content}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {d.member_name} · {new Date(d.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                {String(d.member_id) === String(currentUser?.id) && (
                  <button onClick={() => deleteDifficulty(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "0 28px 20px" }}>
        <button onClick={onClose} style={{
          padding: "9px 18px", borderRadius: 10,
          border: "1px solid var(--border)", background: "var(--bg)",
          color: "var(--text-2)", cursor: "pointer", fontSize: 13, fontWeight: 600,
        }}>
          {isFull ? "Annuler" : "Fermer"}
        </button>
        {isFull && (
          <button
            onClick={handleSave}
            disabled={!valid || saving}
            style={{
              padding: "9px 18px", borderRadius: 10, border: "none",
              background: valid && !saving ? "var(--accent)" : "var(--bg)",
              color: valid && !saving ? "white" : "var(--text-3)",
              cursor: valid && !saving ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Check size={14} />
            {saving ? "Enregistrement…" : mode === "add" ? "Créer" : "Enregistrer"}
          </button>
        )}
      </div>
    </ModalShell>
  );
}
