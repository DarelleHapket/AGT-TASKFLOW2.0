// frontend/src/components/tasks/TasksView.jsx
import { useState, useEffect } from "react";
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Eye, AlertTriangle, Archive, ArchiveRestore } from "lucide-react";
import { FilterBar } from "../shared/FilterBar";
import { StatusBadge, CriticalBadge, MemberBadge, TaskIdBadge } from "../shared/Badges";
import * as api from "../../api/client";
import { useSeenDifficulties } from "../../hooks/useSeenDifficulties";

export function TasksView({ tasks, projects, activities, members, pert, filters, setFilters, memberColor, onAdd, onEdit, onDelete, onArchive, onUnarchive, isAdmin }) {
  const [collapsed, setCollapsed]       = useState({});
  const [diffCounts, setDiffCounts]     = useState({});
  const { markAsSeen, hasUnseen }       = useSeenDifficulties();

  const tog = (k) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  useEffect(() => {
    if (!isAdmin) return;
    const loadCounts = async () => {
      const counts = {};
      await Promise.all(
        tasks.map(async (t) => {
          try {
            const diffs = await api.getDifficulties(t.id);
            if (diffs.length > 0) counts[t.id] = diffs.length;
          } catch { }
        })
      );
      setDiffCounts(counts);
    };
    loadCounts();
  }, [tasks, isAdmin]);

  const handleOpen = (t) => {
    if (isAdmin && diffCounts[t.id]) markAsSeen(t.id, diffCounts[t.id]);
    onEdit(t);
  };

  // Group by project → activity
  const grouped = {};
  tasks.forEach((t) => {
    const pName = t.project_name || "Sans projet";
    const aName = t.activity_name || "Sans activité";
    if (!grouped[pName]) grouped[pName] = {};
    if (!grouped[pName][aName]) grouped[pName][aName] = [];
    grouped[pName][aName].push(t);
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Tâches</h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {tasks.length} tâche{tasks.length !== 1 ? "s" : ""} affichée{tasks.length !== 1 ? "s" : ""}
          </span>
        </div>
        {isAdmin && (
          <button onClick={onAdd} style={{ background: "var(--accent)", color: "white", border: "none", padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Nouvelle tâche
          </button>
        )}
      </div>

      <FilterBar filters={filters} setFilters={setFilters} projects={projects} members={members} />

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
                const slack      = pert.slack[t.id] ?? null;
                const isCrit     = slack === 0;
                const isDone     = t.status === "done";
                const isArchived = t.is_archived;
                const diffCount  = diffCounts[t.id] || 0;
                const showBadge  = isAdmin && hasUnseen(t.id, diffCount);

                return (
                  <div key={t.id} style={{
                    padding: "11px 16px 11px 40px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", gap: 12,
                    borderLeft: isCrit ? "3px solid #ef4444" : isArchived ? "3px solid #94a3b8" : "3px solid transparent",
                    background: isArchived ? "#f8fafc" : isDone ? "#f1f5f9" : isCrit ? "#fff8f8" : "var(--bg-card)",
                    opacity: isDone || isArchived ? 0.65 : 1,
                    transition: "opacity .15s",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <TaskIdBadge id={t.id} />
                        <span style={{
                          fontWeight: 600, fontSize: 14,
                          textDecoration: isDone || isArchived ? "line-through" : "none",
                          color: isDone || isArchived ? "var(--text-3)" : "var(--text)",
                        }}>
                          {t.description}
                        </span>
                        {isCrit && !isDone && <CriticalBadge />}
                        {isArchived && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, padding: "1px 6px" }}>
                            Archivée
                          </span>
                        )}
                        {showBadge && (
                          <span title={`${diffCount} difficulté(s) non lue(s)`} style={{
                            display: "flex", alignItems: "center", gap: 4,
                            background: "#fff7ed", border: "1px solid #fed7aa",
                            borderRadius: 6, padding: "2px 7px",
                            fontSize: 11, fontWeight: 700, color: "#ea580c",
                          }}>
                            <AlertTriangle size={11} /> {diffCount}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                          ⏱ <b style={{ color: "var(--text-2)" }}>{t.duration}</b> coupon{t.duration > 1 ? "s" : ""}
                        </span>
                        {t.dependencies?.length > 0 && (
                          <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "'DM Mono',monospace" }}>
                            ↤ {t.dependencies.join(", ")}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "'DM Mono',monospace" }}>
                          ES:{pert.ES[t.id] ?? "-"} EF:{pert.EF[t.id] ?? "-"}
                        </span>
                        {slack !== null && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: isCrit ? "#ef4444" : slack <= 2 ? "#f59e0b" : "#22c55e" }}>
                            marge:{slack}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <MemberBadge name={t.responsible} color={memberColor(t.responsible)} />
                      <StatusBadge status={t.status} />

                      {/* Bouton voir/modifier — visible par TOUS */}
                      <button
                        onClick={() => handleOpen(t)}
                        title={isAdmin ? "Modifier la tâche" : "Voir les détails"}
                        style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center" }}
                      >
                        {isAdmin ? <Pencil size={13} /> : <Eye size={13} />}
                      </button>

                      {/* Boutons admin uniquement */}
                      {isAdmin && (
                        <>
                          {/* Archiver / Désarchiver */}
                          {isArchived ? (
                            <button
                              onClick={() => onUnarchive(t.id)}
                              title="Désarchiver cette tâche"
                              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#16a34a", display: "flex", alignItems: "center" }}
                            >
                              <ArchiveRestore size={13} />
                            </button>
                          ) : (
                            <button
                              onClick={() => { if (window.confirm("Archiver cette tâche ?")) onArchive(t.id); }}
                              title="Archiver cette tâche"
                              style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "var(--text-3)", display: "flex", alignItems: "center" }}
                            >
                              <Archive size={13} />
                            </button>
                          )}

                          {/* Supprimer */}
                          <button
                            onClick={() => { if (window.confirm("Supprimer cette tâche ?")) onDelete(t.id); }}
                            style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}