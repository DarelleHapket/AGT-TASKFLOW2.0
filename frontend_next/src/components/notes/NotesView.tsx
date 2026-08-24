"use client";

// Port fidèle de frontend/src/components/notes/NotesView.jsx. n.title ->
// n.titre ; n.content -> n.contenu ; n.project_id/activity_id/task_id ->
// n.projet/n.activite/n.tache ; n.member_id -> n.auteur ; n.updated_at ->
// n.mis_a_jour_le (author/edit enforcement déjà vérifié côté serveur, voir
// operations/views.py::NoteViewSet._guard).
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Check, FileText } from "lucide-react";
import { ConfirmDialog, type ConfirmData } from "@/components/ui/ConfirmDialog";
import type { Activite, Note, Projet, Tache, Utilisateur } from "@/lib/types";

const DRAFT_KEY = "agt_notes_draft";
const inp: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, outline: "none", background: "var(--bg-input)", color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 4, display: "block", letterSpacing: ".08em" };

interface NoteFormData { titre: string; contenu: string; projet: number | null; activite: number | null; tache: string | null }
interface NoteDraft { titre: string; contenu: string; projet: string; activite: string; tache: string }

function NoteForm({ initial, projects, activities, tasks, onSave, onCancel }: {
  initial?: Partial<Note>; projects: Projet[]; activities: Activite[]; tasks: Tache[];
  onSave: (d: NoteFormData) => void; onCancel: () => void;
}) {
  const defaultF: NoteDraft = {
    titre: initial?.titre || "", contenu: initial?.contenu || "",
    projet: initial?.projet ? String(initial.projet) : "",
    activite: initial?.activite ? String(initial.activite) : "",
    tache: initial?.tache || "",
  };

  const [f, setF] = useState<NoteDraft>(() => {
    if (initial) return defaultF;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : defaultF;
    } catch { return defaultF; }
  });

  const set = <K extends keyof NoteDraft>(k: K, v: NoteDraft[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!initial) localStorage.setItem(DRAFT_KEY, JSON.stringify(f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, initial]);

  const handleSave = (d: NoteFormData) => {
    if (!initial) localStorage.removeItem(DRAFT_KEY);
    onSave(d);
  };

  const handleCancel = () => {
    if (!initial) localStorage.removeItem(DRAFT_KEY);
    onCancel();
  };

  const filteredActs = activities.filter((a) => !f.projet || String(a.projet) === f.projet);
  const filteredTasks = tasks.filter((t) => !f.projet || String(t.projet) === f.projet);

  return (
    <div style={{ padding: 20, background: "#f0fdf4", borderBottom: "1px solid var(--border)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={lbl}>TITRE *</label>
          <input style={inp} value={f.titre} onChange={(e) => set("titre", e.target.value)} placeholder="Titre de la note…" />
        </div>
        <div>
          <label style={lbl}>PROJET (optionnel)</label>
          <select style={inp} value={f.projet} onChange={(e) => { set("projet", e.target.value); set("activite", ""); set("tache", ""); }}>
            <option value="">Note générale</option>
            {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.nom}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>ACTIVITÉ (optionnel)</label>
          <select style={inp} value={f.activite} onChange={(e) => set("activite", e.target.value)}>
            <option value="">Aucune</option>
            {filteredActs.map((a) => <option key={a.id} value={String(a.id)}>{a.nom}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={lbl}>TÂCHE LIÉE (optionnel)</label>
          <select style={inp} value={f.tache} onChange={(e) => set("tache", e.target.value)}>
            <option value="">Aucune</option>
            {filteredTasks.map((t) => <option key={t.id} value={t.id}>{t.id} : {(t.description || "").slice(0, 40)}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={lbl}>CONTENU</label>
          <textarea style={{ ...inp, height: 100, resize: "vertical" }} value={f.contenu} onChange={(e) => set("contenu", e.target.value)} placeholder="Contenu de la note…" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={handleCancel} style={{ border: "1px solid var(--border)", background: "white", borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center", gap: 5 }}><X size={13} /> Annuler</button>
        <button onClick={() => f.titre.trim() && handleSave({ titre: f.titre.trim(), contenu: f.contenu, projet: f.projet ? Number(f.projet) : null, activite: f.activite ? Number(f.activite) : null, tache: f.tache || null })}
          style={{ background: "#16a34a", border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer", color: "white", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
          <Check size={13} /> Enregistrer
        </button>
      </div>
    </div>
  );
}

export function NotesView({ notes, projects, activities, tasks, user, onAdd, onUpdate, onDelete }: {
  notes: Note[]; projects: Projet[]; activities: Activite[]; tasks: Tache[]; user: Utilisateur | null;
  onAdd: (d: NoteFormData) => Promise<void>;
  onUpdate: (id: number, d: NoteFormData) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [adding, setAdding] = useState(() => { try { return !!localStorage.getItem(DRAFT_KEY); } catch { return false; } });
  const [editing, setEditing] = useState<Note | null>(null);
  const [filterPid, setFilterPid] = useState("all");
  const [confirm, setConfirm] = useState<ConfirmData | null>(null);

  const visible = filterPid === "all" ? notes : filterPid === "general" ? notes.filter((n) => !n.projet) : notes.filter((n) => String(n.projet) === filterPid);
  const fmt = (dt: string | null) => dt ? new Date(dt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const isMine = (n: Note) => n.auteur == null || String(n.auteur) === String(user?.id);

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
        {[{ v: "all", l: "Toutes" }, { v: "general", l: "Générales" }, ...projects.map((p) => ({ v: String(p.id), l: p.nom }))].map(({ v, l }) => {
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
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 3 }}>{n.titre}</div>
                {n.contenu && <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 5, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{n.contenu.slice(0, 200)}{n.contenu.length > 200 ? "…" : ""}</div>}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "var(--text-3)" }}>
                  {n.author_name && <span style={{ fontWeight: 600, color: "var(--text-2)" }}>✍️ {n.author_name}</span>}
                  {n.project_name ? <span>📁 {n.project_name}</span> : <span>🌐 Générale</span>}
                  {n.activity_name && <span>🔖 {n.activity_name}</span>}
                  {n.tache && <span>📋 {n.tache}</span>}
                  <span style={{ marginLeft: "auto" }}>🕐 {fmt(n.mis_a_jour_le)}</span>
                </div>
              </div>
              {isMine(n) ? (
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setEditing(n)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center" }}><Pencil size={13} /></button>
                  <button onClick={() => setConfirm({ title: "Supprimer la note", message: `"${n.titre}" sera supprimée définitivement.`, confirmLabel: "Supprimer", danger: true, onConfirm: () => onDelete(n.id) })}
                    style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}><Trash2 size={13} /></button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", flexShrink: 0, fontSize: 10, color: "var(--text-3)", fontStyle: "italic", padding: "0 6px" }}>lecture seule</div>
              )}
            </div>
          )
        )}
      </div>
      <ConfirmDialog data={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
