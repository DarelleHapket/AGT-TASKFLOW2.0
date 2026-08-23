"use client";

// Port fidèle de frontend/src/components/tasks/TaskModal.jsx — AdminModal
// (vue superviseur lecture seule), permissions full/status_only/read_only,
// création multi-responsables (plusieurs tâches en une fois), difficultés
// inline. Champs adaptés aux noms Django (statut/priorite/duree/date_*) et
// responsable = FK utilisateur au lieu d'un nom en texte libre.
import { useEffect, useState } from "react";
import { X, Check, AlertTriangle, Plus, Trash2, Network } from "lucide-react";
import { STATUSES } from "@/lib/pert";
import * as api from "@/lib/api";
import type { Difficulte } from "@/lib/api";
import type { Activite, Projet, StatutTache, Tache, Utilisateur } from "@/lib/types";
import { useAuth } from "@/lib/auth";

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13,
  outline: "none", background: "var(--bg-input)", color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box",
};
const inpDisabled: React.CSSProperties = { ...inp, background: "var(--bg)", color: "var(--text-2)", cursor: "not-allowed", opacity: 0.65 };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 5, display: "block", letterSpacing: ".08em" };

const PRIORITIES = [
  { value: "normale", label: "Normale", color: "#64748b" },
  { value: "haute", label: "Haute", color: "#f59e0b" },
  { value: "critique", label: "Critique", color: "#ef4444" },
];
const STATUS_COLOR: Record<string, string> = { todo: "#64748b", in_progress: "#3b82f6", done: "#22c55e", blocked: "#ef4444" };
const STATUS_BG: Record<string, string> = { todo: "#f1f5f9", in_progress: "#eff6ff", done: "#f0fdf4", blocked: "#fef2f2" };
const PRIORITY_COLOR: Record<string, string> = { normale: "#64748b", haute: "#f59e0b", critique: "#ef4444" };
const PRIORITY_BG: Record<string, string> = { normale: "#f1f5f9", haute: "#fffbeb", critique: "#fef2f2" };

function ModalShell({ children, maxWidth = 520 }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 20, width: "100%", maxWidth, maxHeight: "92vh", overflow: "auto", boxShadow: "var(--shadow-md)", border: "1px solid var(--border)" }}>
        {children}
      </div>
    </div>
  );
}

function AdminModal({ task, projectName, activityName, responsibleName, onClose }: {
  task: Tache; projectName: string; activityName: string; responsibleName: string; onClose: () => void;
}) {
  const [diffCount, setDiffCount] = useState(0);

  useEffect(() => {
    api.getDifficulties(task.id).then((d) => setDiffCount(d.length)).catch(() => {});
  }, [task.id]);

  const statusLabel = STATUSES.find((s) => s.value === task.statut)?.label || task.statut;
  const priorityLabel = PRIORITIES.find((p) => p.value === task.priorite)?.label || "Normale";
  const priorityColor = PRIORITY_COLOR[task.priorite] || "#64748b";
  const priorityBg = PRIORITY_BG[task.priorite] || "#f1f5f9";
  const statusColor = STATUS_COLOR[task.statut] || "#64748b";
  const statusBg = STATUS_BG[task.statut] || "#f1f5f9";

  const slack = task.slack ?? null;
  const isCrit = slack === 0;
  const slackBg = isCrit ? "#fef2f2" : slack !== null && slack <= 2 ? "#fffbeb" : "#f0fdf4";
  const slackClr = isCrit ? "#ef4444" : slack !== null && slack <= 2 ? "#f59e0b" : "#22c55e";
  const pertBg = isCrit ? "#fef2f2" : "var(--bg)";
  const pertBdr = isCrit ? "#fecaca" : "var(--border)";
  const pertClr = isCrit ? "#ef4444" : "var(--text-2)";

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");
  const deadlineColor = task.date_echeance && task.date_echeance < new Date().toISOString().slice(0, 10) ? "#ef4444" : "var(--text)";
  const initials = (responsibleName || "?")[0].toUpperCase();

  const Info = ({ label, value, color = "var(--text)" }: { label: string; value: string; color?: string }) => (
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

      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ borderBottom: "1px solid var(--border)" }}>
        {[
          { label: "STATUT", node: <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: statusBg, padding: "3px 8px", borderRadius: 6 }}>{statusLabel}</span> },
          { label: "PRIORITÉ", node: <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor, background: priorityBg, padding: "3px 8px", borderRadius: 6 }}>{priorityLabel}</span> },
          { label: "DURÉE", node: <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{task.duree} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-3)" }}>coupon{task.duree > 1 ? "s" : ""}</span></span> },
          { label: "MARGE", node: slack === null ? <span style={{ fontSize: 13, color: "var(--text-3)" }}>n/d</span> : <span style={{ fontSize: 14, fontWeight: 800, color: slackClr, background: slackBg, padding: "2px 8px", borderRadius: 6 }}>{slack} {isCrit ? "🔴" : slack <= 2 ? "🟡" : "🟢"}</span> },
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
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 8 }}>
            <Info label="PROJET" value={projectName || "Aucun"} />
            <Info label="ACTIVITÉ" value={activityName || "Aucune"} />
            <div style={{ gridColumn: "1/-1", background: "var(--bg)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "var(--accent)", flexShrink: 0 }}>{initials}</div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".07em" }}>RESPONSABLE</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginTop: 1 }}>{responsibleName || "Non assigné"}</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".08em", marginBottom: 8 }}>CALENDRIER</div>
          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 8 }}>
            <Info label="DÉBUT" value={fmt(task.date_debut)} />
            <Info label="FIN PRÉVUE" value={fmt(task.date_fin)} />
            <Info label="DEADLINE" value={fmt(task.date_echeance)} color={deadlineColor} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".08em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Network size={11} /> CHEMIN CRITIQUE (PERT)
          </div>
          <div style={{ background: pertBg, border: `1px solid ${pertBdr}`, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {[{ label: "ES", value: task.es ?? "n/d" }, { label: "EF", value: task.ef ?? "n/d" }, { label: "LS", value: task.ls ?? "n/d" }, { label: "LF", value: task.lf ?? "n/d" }].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 4, marginRight: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: pertClr, opacity: 0.7 }}>{label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: pertClr }}>{value}</span>
              </div>
            ))}
            <div style={{ marginLeft: "auto" }}>
              {isCrit ? (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", background: "#fee2e2", padding: "3px 10px", borderRadius: 6 }}>Sur le chemin critique</span>
              ) : slack !== null ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#22c55e", background: "#f0fdf4", padding: "3px 10px", borderRadius: 6 }}>Marge disponible : {slack}</span>
              ) : null}
            </div>
          </div>
        </div>

        {diffCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
            <AlertTriangle size={15} color="#f59e0b" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>{diffCount} signalement{diffCount > 1 ? "s" : ""} de blocage sur cette tâche</span>
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

interface FormState {
  id: string; projet: string; activite: string; description: string;
  duree: number; dependances: string[]; responsable: string; statut: StatutTache;
  priorite: "critique" | "haute" | "normale"; date_debut: string; date_fin: string; date_echeance: string;
}

interface Props {
  mode: "add" | "edit";
  initial: Tache | null;
  tasks: Tache[];
  members: Utilisateur[];
  projects: Projet[];
  activities: Activite[];
  onSave: (data: Partial<Tache> & { id: string }) => Promise<void>;
  onStatusChange: (id: string, statut: StatutTache) => void;
  onClose: () => void;
}

export function TaskModal(props: Props) {
  // Composant "aiguilleur" sans hooks propres : la vue superviseur (lecture
  // seule, plus riche — chemin critique PERT etc.) et le formulaire éditable
  // sont deux composants distincts, chacun appelant ses hooks de façon
  // inconditionnelle (règle des Hooks React). L'original mélangeait les deux
  // dans une seule fonction avec un retour anticipé avant les useState/
  // useEffect — ça passait en Vite/CRA sans lint strict, mais Next.js le
  // bloque à raison. Le choix entre les deux vues suit désormais la
  // permission calculée côté serveur pour CETTE tâche (`permission`), pas un
  // rôle global — tout viewer en lecture seule (pas seulement un ex-"admin")
  // profite de la vue superviseur, plus informative qu'un formulaire désactivé.
  const { initial, projects, activities, members, onClose } = props;
  if (initial?.permission === "read_only") {
    const projectName = projects.find((p) => p.id === initial.projet)?.nom || "";
    const activityName = activities.find((a) => a.id === initial.activite)?.nom || "";
    const responsibleName = members.find((m) => m.id === initial.responsable)?.name || "";
    return <AdminModal task={initial} projectName={projectName} activityName={activityName} responsibleName={responsibleName} onClose={onClose} />;
  }
  return <EditableTaskModal {...props} />;
}

function EditableTaskModal({ mode, initial, tasks, members, projects, activities, onSave, onStatusChange, onClose }: Props) {
  const { user: currentUser } = useAuth();

  const permission = mode === "add" ? "full" : (initial?.permission || "read_only");
  const isFull = permission === "full";
  const isStatusOnly = permission === "status_only";
  const isReadOnly = permission === "read_only";
  const isAssigned = !!currentUser && initial?.responsable === currentUser.id;

  const blank: FormState = {
    id: "", projet: "", activite: "", description: "", duree: 1, dependances: [],
    responsable: "", statut: "todo", priorite: "normale", date_debut: "", date_fin: "", date_echeance: "",
  };

  const [f, setF] = useState<FormState>(initial ? {
    ...blank,
    id: initial.id, projet: String(initial.projet ?? ""), activite: String(initial.activite ?? ""),
    description: initial.description, duree: initial.duree, dependances: initial.dependances,
    responsable: String(initial.responsable ?? ""), statut: initial.statut, priorite: initial.priorite,
    date_debut: initial.date_debut ?? "", date_fin: initial.date_fin ?? "", date_echeance: initial.date_echeance ?? "",
  } : blank);
  const [difficulties, setDifficulties] = useState<Difficulte[]>([]);
  const [newDiff, setNewDiff] = useState("");
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [responsables, setResponsables] = useState<number[]>([]);

  useEffect(() => {
    if (mode === "add" && !f.id) {
      setF((p) => ({ ...p, id: `T${String(tasks.length + 1).padStart(3, "0")}` }));
    }
    if (mode === "edit" && initial?.id) {
      setLoadingDiff(true);
      api.getDifficulties(initial.id).then(setDifficulties).catch(() => {}).finally(() => setLoadingDiff(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setSaveError(null); setF((p) => ({ ...p, [k]: v })); };
  const togDep = (id: string) => {
    const d = f.dependances || [];
    set("dependances", d.includes(id) ? d.filter((x) => x !== id) : [...d, id]);
  };

  const creatableProjects = mode === "add" ? projects.filter((p) => p.user_role === "owner" || p.user_role === "manager") : projects;
  const filteredActivities = activities.filter((a) => !f.projet || a.projet === Number(f.projet));
  const avail = tasks.filter((t) => t.id !== f.id);
  const valid = f.id.trim() && f.description.trim() && (mode !== "add" || (!!f.projet && !!f.activite));

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaveError(null); setSaving(true);
    try {
      if (mode === "add" && responsables.length > 1) {
        for (let i = 0; i < responsables.length; i++) {
          const suffix = i === 0 ? "" : `-${String.fromCharCode(97 + i)}`;
          await onSave(buildPayload({ ...f, id: `${f.id}${suffix}` }, responsables[i]));
        }
      } else {
        const single = mode === "add" && responsables.length === 1 ? responsables[0] : (f.responsable ? Number(f.responsable) : null);
        await onSave(buildPayload(f, single));
      }
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  function buildPayload(form: FormState, responsableId: number | null) {
    return {
      id: form.id, description: form.description, projet: form.projet ? Number(form.projet) : null,
      activite: form.activite ? Number(form.activite) : null, responsable: responsableId,
      duree: form.duree, statut: form.statut, priorite: form.priorite,
      date_debut: form.date_debut || null, date_fin: form.date_fin || null, date_echeance: form.date_echeance || null,
      dependances: form.dependances,
    };
  }

  const addDifficulty = async () => {
    if (!newDiff.trim() || !initial?.id) return;
    try {
      const d = await api.createDifficulty(initial.id, newDiff.trim());
      setDifficulties((prev) => [d, ...prev]);
      setNewDiff("");
    } catch (e) { alert(e instanceof Error ? e.message : "Erreur"); }
  };

  const deleteDifficulty = async (id: number) => {
    try {
      await api.deleteDifficulty(id);
      setDifficulties((prev) => prev.filter((d) => d.id !== id));
    } catch (e) { alert(e instanceof Error ? e.message : "Erreur"); }
  };

  const fieldStyle = isFull ? inp : inpDisabled;

  const handleStatusChange = (newStatus: StatutTache) => {
    if (isStatusOnly) onStatusChange(f.id, newStatus);
    set("statut", newStatus);
  };

  const modalTitle = mode === "add" ? "Nouvelle tâche" : isFull ? "Modifier la tâche" : "Détails de la tâche";

  return (
    <ModalShell maxWidth={600}>
      <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{modalTitle}</h3>
        <button onClick={onClose} style={{ background: "var(--bg)", border: "1px solid var(--border)", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)" }}>
          <X size={15} />
        </button>
      </div>

      {(isStatusOnly || isReadOnly) && (
        <div style={{ margin: "16px 28px 0", padding: "8px 12px", background: isStatusOnly ? "var(--accent-bg)" : "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 6 }}>
          {isStatusOnly ? <>🔓 Vous êtes responsable de cette tâche : vous pouvez modifier son <b>statut</b> ci-dessous.</> : <>🔒 Lecture seule : vous n&apos;avez pas de droits d&apos;édition sur cette tâche.</>}
        </div>
      )}

      {saveError && (
        <div style={{ margin: "12px 28px 0", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{saveError}</span>
        </div>
      )}

      <div style={{ padding: "20px 28px" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14 }}>
          <div>
            <label style={lbl}>ID DE LA TÂCHE</label>
            <input style={fieldStyle} disabled={!isFull} value={f.id} onChange={(e) => set("id", e.target.value)} placeholder="T001" />
          </div>
          <div>
            <label style={lbl}>DURÉE (COUPONS)</label>
            <input style={fieldStyle} disabled={!isFull} type="number" min={1} value={f.duree} onChange={(e) => set("duree", Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          <div>
            <label style={lbl}>PROJET {mode === "add" && <span style={{ color: "#ef4444" }}>*</span>}</label>
            <select style={fieldStyle} disabled={!isFull} value={f.projet} onChange={(e) => { set("projet", e.target.value); set("activite", ""); }}>
              {mode === "add" ? (
                <>
                  <option value="" disabled>-- Sélectionner un projet (obligatoire) --</option>
                  {creatableProjects.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </>
              ) : (
                <>
                  <option value="">-- Aucun --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </>
              )}
            </select>
            {mode === "add" && creatableProjects.length === 0 && (
              <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>Aucun projet disponible. Créez d&apos;abord un projet ou demandez à en rejoindre un en tant que manager.</div>
            )}
          </div>
          <div>
            <label style={lbl}>ACTIVITÉ</label>
            <select style={fieldStyle} disabled={!isFull} value={f.activite} onChange={(e) => set("activite", e.target.value)}>
              <option value="">Choisir</option>
              {filteredActivities.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>DESCRIPTION</label>
            <textarea style={{ ...fieldStyle, height: 72, resize: "vertical" }} disabled={!isFull} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Décrivez la tâche…" />
          </div>
          <div>
            <label style={lbl}>RESPONSABLE</label>
            {mode === "add" ? (
              <div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <button type="button" onClick={() => setResponsables(members.map((m) => m.id))} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--accent-bg)", color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>Tous</button>
                  <button type="button" onClick={() => setResponsables([])} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-3)", cursor: "pointer" }}>Aucun</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {members.map((m) => {
                    const selected = responsables.includes(m.id);
                    return (
                      <button key={m.id} type="button" onClick={() => setResponsables((prev) => selected ? prev.filter((n) => n !== m.id) : [...prev, m.id])}
                        style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`, background: selected ? "var(--accent)" : "transparent", color: selected ? "white" : "var(--text-2)", cursor: "pointer", fontWeight: selected ? 700 : 400 }}>
                        {m.name}
                      </button>
                    );
                  })}
                </div>
                {responsables.length > 1 && (
                  <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 6 }}>
                    {responsables.length} tâches seront créées ({responsables.map((id) => members.find((m) => m.id === id)?.name).join(", ")})
                  </div>
                )}
              </div>
            ) : (
              <select style={fieldStyle} disabled={!isFull} value={f.responsable} onChange={(e) => set("responsable", e.target.value)}>
                <option value="">Aucun</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label style={lbl}>STATUT</label>
            <select value={f.statut} onChange={(e) => handleStatusChange(e.target.value as StatutTache)} disabled={isReadOnly} style={isReadOnly ? inpDisabled : inp}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>PRIORITÉ</label>
            <select style={fieldStyle} disabled={!isFull} value={f.priorite} onChange={(e) => set("priorite", e.target.value as FormState["priorite"])}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>DATE DÉBUT</label>
            <input style={fieldStyle} disabled={!isFull} type="date" value={f.date_debut || ""} onChange={(e) => set("date_debut", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>DATE FIN</label>
            <input style={fieldStyle} disabled={!isFull} type="date" value={f.date_fin || ""} onChange={(e) => set("date_fin", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>DEADLINE</label>
            <input style={fieldStyle} disabled={!isFull} type="date" value={f.date_echeance || ""} onChange={(e) => set("date_echeance", e.target.value)} />
          </div>
          {avail.length > 0 && (
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>DÉPENDANCES</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {avail.map((t) => {
                  const sel = (f.dependances || []).includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => isFull && togDep(t.id)} disabled={!isFull}
                      style={{ padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${sel ? "var(--accent)" : "var(--border)"}`, background: sel ? "var(--accent-bg)" : "transparent", color: sel ? "var(--accent)" : "var(--text-2)", fontSize: 12, fontWeight: sel ? 700 : 400, cursor: isFull ? "pointer" : "not-allowed", opacity: isFull ? 1 : 0.65 }}>
                      {t.id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {mode === "edit" && (
          <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={15} color="#f59e0b" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Difficultés signalées</span>
              <span style={{ fontSize: 11, color: "var(--text-3)", background: "var(--bg)", padding: "1px 8px", borderRadius: 10, border: "1px solid var(--border)" }}>{difficulties.length}</span>
            </div>

            {isAssigned ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input style={{ ...inp, flex: 1 }} value={newDiff} onChange={(e) => setNewDiff(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDifficulty()} placeholder="Décrire le blocage rencontré…" />
                <button onClick={addDifficulty} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
                  <Plus size={13} /> Signaler
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", marginBottom: 12 }}>Seul le membre assigné peut signaler une difficulté.</div>
            )}

            {loadingDiff && <div style={{ fontSize: 12, color: "var(--text-3)" }}>Chargement…</div>}
            {!loadingDiff && difficulties.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>Aucune difficulté signalée</div>}
            {difficulties.map((d) => (
              <div key={d.id} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 4 }}>{d.contenu}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{d.member_name} · {new Date(d.cree_le).toLocaleDateString("fr-FR")}</div>
                </div>
                {d.membre === currentUser?.id && (
                  <button onClick={() => deleteDifficulty(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "0 28px 20px" }}>
        <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-2)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          {isFull ? "Annuler" : "Fermer"}
        </button>
        {isFull && (
          <button onClick={handleSave} disabled={!valid || saving} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: valid && !saving ? "var(--accent)" : "var(--bg)", color: valid && !saving ? "white" : "var(--text-3)", cursor: valid && !saving ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={14} /> {saving ? "Enregistrement…" : mode === "add" ? "Créer" : "Enregistrer"}
          </button>
        )}
      </div>
    </ModalShell>
  );
}
