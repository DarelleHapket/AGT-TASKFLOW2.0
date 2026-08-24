"use client";

// Port fidèle de frontend/src/components/tasks/TasksView.jsx — même
// groupement Projet → Activité, mêmes couleurs/interactions, même logique
// de permission (full/status_only/read_only calculée côté backend).
import { useState } from "react";
import { Plus, ChevronDown, ChevronRight, Pencil, Eye, Trash2, List, LayoutGrid } from "lucide-react";
import { FilterBar, type TaskFilters } from "@/components/shared/FilterBar";
import { StatusBadge, MemberBadge } from "@/components/shared/Badges";
import { STATUSES } from "@/lib/pert";
import type { Activite, Projet, StatutTache, Tache, Utilisateur } from "@/lib/types";

const statusSelectStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, padding: "3px 6px", borderRadius: 6,
  border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit",
};

interface Props {
  tasks: Tache[]; projects: Projet[]; activities: Activite[]; members: Utilisateur[];
  filters: TaskFilters; setFilters: (u: (f: TaskFilters) => TaskFilters) => void;
  onAdd: () => void; onEdit: (t: Tache) => void; onDelete: (id: string) => void;
  onStatusChange: (id: string, statut: StatutTache) => void;
}

export function TasksView({ tasks, projects, activities, members, filters, setFilters, onAdd, onEdit, onDelete, onStatusChange }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"liste" | "tableau">("liste");

  const tog = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  const projetNom = (id: number | null) => projects.find((p) => p.id === id)?.nom || "Sans projet";
  const activiteNom = (id: number | null) => activities.find((a) => a.id === id)?.nom || "Sans activité";
  const membreNom = (id: number | null) => members.find((m) => m.id === id)?.name || null;
  const membreColor = () => "#6366f1"; // pas de couleur par membre côté Django pour l'instant

  const grouped: Record<string, Record<string, Tache[]>> = {};
  tasks.forEach((t) => {
    const pName = projetNom(t.projet);
    const aName = activiteNom(t.activite);
    if (!grouped[pName]) grouped[pName] = {};
    if (!grouped[pName][aName]) grouped[pName][aName] = [];
    grouped[pName][aName].push(t);
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Tâches</h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{tasks.length} tâche{tasks.length !== 1 ? "s" : ""} affichée{tasks.length !== 1 ? "s" : ""}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <button onClick={() => setViewMode("liste")} title="Vue liste"
              style={{ display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", padding: "8px 12px", fontSize: 12, fontWeight: 700, background: viewMode === "liste" ? "var(--accent)" : "var(--bg-card)", color: viewMode === "liste" ? "white" : "var(--text-2)" }}>
              <List size={13} /> Liste
            </button>
            <button onClick={() => setViewMode("tableau")} title="Vue tableau"
              style={{ display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", padding: "8px 12px", fontSize: 12, fontWeight: 700, background: viewMode === "tableau" ? "var(--accent)" : "var(--bg-card)", color: viewMode === "tableau" ? "white" : "var(--text-2)" }}>
              <LayoutGrid size={13} /> Tableau
            </button>
          </div>

          <button onClick={onAdd} style={{ background: "var(--accent)", color: "white", border: "none", padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Nouvelle tâche
          </button>
        </div>
      </div>

      <FilterBar filters={filters} setFilters={setFilters} projects={projects} members={members} compact />

      {viewMode === "tableau" ? (
        <TableauView tasks={tasks} members={members} onOpen={onEdit} />
      ) : (
      <>
      {Object.entries(grouped).length === 0 && (
        <div style={{ textAlign: "center", padding: 80, color: "var(--text-3)", background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: "var(--text-2)" }}>Aucune tâche</div>
          <div style={{ fontSize: 13 }}>Créez votre première tâche pour démarrer</div>
        </div>
      )}

      {Object.entries(grouped).map(([proj, acts]) => (
        <div key={proj} style={{ marginBottom: 10, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <div onClick={() => tog(proj)} style={{ background: "var(--bg-hover)", padding: "11px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: collapsed[proj] ? "none" : "1px solid var(--border)" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
              {collapsed[proj] ? <ChevronRight size={14} /> : <ChevronDown size={14} />} 📁 {proj}
            </span>
            <span style={{ fontSize: 11, background: "var(--bg-card)", color: "var(--text-3)", padding: "2px 10px", borderRadius: 20, border: "1px solid var(--border)" }}>
              {Object.values(acts).flat().length} tâche{Object.values(acts).flat().length !== 1 ? "s" : ""}
            </span>
          </div>

          {!collapsed[proj] && Object.entries(acts).map(([act, atasks]) => (
            <div key={act}>
              <div onClick={() => tog(`${proj}/${act}`)} style={{ background: "var(--bg-card)", padding: "7px 16px 7px 28px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)" }}>
                {collapsed[`${proj}/${act}`] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>🔖 {act}</span>
                <span style={{ fontSize: 10, color: "var(--text-3)", background: "var(--bg)", padding: "1px 8px", borderRadius: 10, border: "1px solid var(--border)" }}>{atasks.length}</span>
              </div>

              {!collapsed[`${proj}/${act}`] && atasks.map((t) => {
                const isDone = t.statut === "done";
                const canFullEdit = t.permission === "full";
                const isStatusOnly = t.permission === "status_only";

                return (
                  <div key={t.id} style={{
                    padding: "11px 16px 11px 40px", borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    background: "var(--bg-card)",
                  }}>
                    <span style={{ fontWeight: 600, fontSize: 14, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--text-3)" : "var(--text)" }}>
                      {t.description}
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <MemberBadge name={membreNom(t.responsable)} color={membreColor()} />

                      {isStatusOnly ? (
                        <select value={t.statut} onChange={(e) => onStatusChange(t.id, e.target.value as StatutTache)} onClick={(e) => e.stopPropagation()} title="Modifier le statut de votre tâche" style={statusSelectStyle}>
                          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      ) : (
                        <StatusBadge statut={t.statut} />
                      )}

                      <button onClick={() => onEdit(t)} title={canFullEdit ? "Modifier la tâche" : "Voir la tâche"}
                        style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center" }}>
                        {canFullEdit ? <Pencil size={13} /> : <Eye size={13} />}
                      </button>

                      {canFullEdit && (
                        <button onClick={() => { if (window.confirm("Supprimer cette tâche ?")) onDelete(t.id); }} title="Supprimer cette tâche"
                          style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
      </>
      )}
    </div>
  );
}

// ── Vue Tableau — colonnes par membre (D-08, port depuis team-tool) ─────────
function TableauView({ tasks, members, onOpen }: { tasks: Tache[]; members: Utilisateur[]; onOpen: (t: Tache) => void }) {
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
      {members.map((m) => {
        const liste = tasks.filter((t) => t.responsable === m.id);
        const faits = liste.filter((t) => t.statut === "done").length;
        const bloques = liste.filter((t) => t.statut === "blocked").length;
        return (
          <div key={m.id} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderTop: `3px solid ${m.color || "#6366f1"}`, borderRadius: "var(--radius-lg)",
            padding: 12, boxShadow: "var(--shadow)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <b style={{ fontSize: 13, color: "var(--text)" }}>{m.name}</b>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                {faits} fait{faits !== 1 ? "s" : ""} · {bloques} bloqué{bloques !== 1 ? "s" : ""}
              </span>
            </div>

            {liste.map((t) => (
              <button key={t.id} onClick={() => onOpen(t)} style={{
                display: "block", width: "100%", textAlign: "left",
                background: "var(--bg)", border: "1px solid var(--border)",
                borderRadius: 8, padding: 8, marginBottom: 8, cursor: "pointer",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: "var(--text)",
                    textDecoration: t.statut === "done" ? "line-through" : "none",
                  }}>
                    {t.description}
                  </span>
                  <StatusBadge statut={t.statut} />
                </div>
              </button>
            ))}
            {liste.length === 0 && <p style={{ fontSize: 11, color: "var(--text-3)" }}>Aucune tâche</p>}
          </div>
        );
      })}
    </div>
  );
}
