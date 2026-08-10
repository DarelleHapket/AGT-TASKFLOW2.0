"use client";

// Port fidèle de frontend/src/components/pert/PERTView.jsx (diagramme PERT
// SVG fait main). t.dependencies -> t.dependances ; t.project_id -> t.projet ;
// project.name -> projet.nom.
import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Download, Trash2 } from "lucide-react";
import { FilterBar, type TaskFilters } from "@/components/shared/FilterBar";
import { computePERT, STATUSES, type PertResult } from "@/lib/pert";
import type { Projet, StatutTache, Tache, Utilisateur } from "@/lib/types";

const statusSelectStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, padding: "3px 6px", borderRadius: 6,
  border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit",
};

// Table éditable + stats — même structure que team-tool (frontend/src/app/pert/page.tsx) :
// # | Nom | Prédécesseurs | Durée | Statut | Tâches liées | Supprimer, avec
// "Durée du projet" / "Tâches critiques" en tête et un export JSON. Le
// catalogue de statuts personnalisables de team-tool (PertStatut, "Gérer les
// statuts") n'a pas d'équivalent ici : AGT n'a qu'un seul statut par tâche
// (todo/in_progress/done/blocked, partagé avec la page Tâches), pas de
// catalogue par projet — la colonne Statut réutilise donc STATUSES.
function PERTTable({ tasks, pert, onStatusChange, onDelete }: {
  tasks: Tache[]; pert: PertResult;
  onStatusChange?: (id: string, statut: StatutTache) => void;
  onDelete?: (id: string) => void;
}) {
  const dureeProjet = pert.end;
  const tachesCritiques = tasks.filter((t) => pert.slack[t.id] === 0).length;

  function exporterJSON() {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pert.json"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "var(--text-2)" }}>
          Durée du projet : <b style={{ color: "var(--text)" }}>{dureeProjet}</b>
        </span>
        <span style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "var(--text-2)" }}>
          Tâches critiques : <b style={{ color: "#ef4444" }}>{tachesCritiques}</b>
        </span>
        <button onClick={exporterJSON} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
          <Download size={13} /> Exporter JSON
        </button>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "auto", boxShadow: "var(--shadow)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg-hover)" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>#</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>NOM DE LA TÂCHE</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>PRÉDÉCESSEURS</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>DURÉE</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>STATUT</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, color: "var(--text-3)", fontWeight: 700 }}>MARGE</th>
              <th style={{ padding: "8px 12px" }} />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const isCrit = pert.slack[t.id] === 0;
              const canFullEdit = t.permission === "full";
              return (
                <tr key={t.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 700, color: isCrit ? "#ef4444" : "var(--text)" }}>{t.id}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text)" }}>{t.description}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-3)", fontFamily: "'DM Mono',monospace" }}>{t.dependances?.join(", ") || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-2)" }}>{t.duree}</td>
                  <td style={{ padding: "8px 12px" }}>
                    {onStatusChange ? (
                      <select value={t.statut} onChange={(e) => onStatusChange(t.id, e.target.value as StatutTache)} style={statusSelectStyle}>
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    ) : (
                      STATUSES.find((s) => s.value === t.statut)?.label || t.statut
                    )}
                  </td>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: isCrit ? "#ef4444" : (t.slack ?? 0) <= 2 ? "#f59e0b" : "#22c55e" }}>
                    {t.slack ?? "—"}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    {onDelete && canFullEdit && (
                      <button onClick={() => { if (window.confirm("Supprimer cette tâche ?")) onDelete(t.id); }} title="Supprimer"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {tasks.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--text-3)" }}>Aucune tâche.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const NW = 120, NH = 100, HG = 180, VG = 140;

function buildLayout(tasks: Tache[]) {
  if (!tasks.length) return { pos: {} as Record<string, { x: number; y: number }>, SW: 0, SH: 0 };

  const map: Record<string, Tache> = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const order: string[] = [];
  const dfs = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    (map[id]?.dependances || []).filter((d) => map[d]).forEach(dfs);
    order.push(id);
  };
  tasks.forEach((t) => dfs(t.id));

  const levels: Record<string, number> = {};
  order.forEach((id) => {
    const deps = (map[id]?.dependances || []).filter((d) => map[d]);
    levels[id] = deps.length ? Math.max(...deps.map((d) => (levels[d] ?? 0) + 1)) : 0;
  });

  const cols: Record<number, string[]> = {};
  tasks.forEach((t) => {
    const l = levels[t.id] ?? 0;
    if (!cols[l]) cols[l] = [];
    cols[l].push(t.id);
  });

  const pos: Record<string, { x: number; y: number }> = {};
  Object.entries(cols).forEach(([col, ids]) => {
    ids.forEach((id, row) => { pos[id] = { x: Number(col) * HG + 20, y: row * VG + 20 }; });
  });

  const maxX = Math.max(0, ...Object.values(pos).map((p) => p.x)) + NW + 40;
  const maxY = Math.max(0, ...Object.values(pos).map((p) => p.y)) + NH + 40;
  return { pos, SW: maxX, SH: maxY };
}

function PERTDiagram({ tasks, pert, uid = "main" }: { tasks: Tache[]; pert: PertResult; uid?: string }) {
  const cycleSet = new Set(pert.cycles || []);
  const filtered = tasks.filter((t) => !cycleSet.has(t.id));
  const { pos, SW, SH } = buildLayout(filtered);

  if (filtered.length === 0) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Aucune tâche active</div>
    </div>
  );

  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 12, overflow: "auto", border: "1px solid var(--border)", padding: 8 }}>
      <svg width={SW} height={SH}>
        <defs>
          <marker id={`pa-${uid}`} markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto">
            <polygon points="0 0, 8 4, 0 8" fill="#94a3b8" />
          </marker>
          <marker id={`ca-${uid}`} markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto">
            <polygon points="0 0, 8 4, 0 8" fill="#ef4444" />
          </marker>
        </defs>

        {filtered.map((t) =>
          (t.dependances || []).map((did) => {
            if (!pos[did] || !pos[t.id]) return null;
            const fr = pos[did], to = pos[t.id];
            const x1 = fr.x + NW, y1 = fr.y + NH / 2;
            const x2 = to.x, y2 = to.y + NH / 2;
            const isCrit = pert.slack[did] === 0 && pert.slack[t.id] === 0;
            return (
              <path key={`${did}>${t.id}`}
                d={`M${x1},${y1} C${x1 + HG * 0.55},${y1} ${x2 - HG * 0.55},${y2} ${x2},${y2}`}
                fill="none"
                stroke={isCrit ? "#ef4444" : "#cbd5e1"}
                strokeWidth={isCrit ? 2.5 : 1.5}
                markerEnd={`url(#${isCrit ? `ca-${uid}` : `pa-${uid}`})`}
              />
            );
          })
        )}

        {filtered.map((t) => {
          const p = pos[t.id]; if (!p) return null;
          const slack = pert.slack[t.id] ?? null;
          const isCrit = slack === 0;
          const bc = isCrit ? "#ef4444" : "var(--accent)";
          const bg = isCrit ? "#fff8f8" : "#ffffff";
          const es = pert.ES[t.id] ?? "-", ef = pert.EF[t.id] ?? "-";
          const ls = pert.LS[t.id] ?? "-", lf = pert.LF[t.id] ?? "-";
          const desc = (t.description || "").slice(0, 21) + ((t.description || "").length > 21 ? "…" : "");

          return (
            <g key={t.id} transform={`translate(${p.x},${p.y})`}>
              <rect width={NW} height={NH} rx={8} fill={bg} stroke={bc} strokeWidth={isCrit ? 2.5 : 1.5} />
              <rect width={NW} height={32} rx={7} fill={isCrit ? "#fef2f2" : "#f8fafc"} />
              <line x1={NW / 2} y1={0} x2={NW / 2} y2={32} stroke={bc} strokeWidth={1} />
              <text x={NW / 4} y={11} textAnchor="middle" fontSize={8} fill={bc} fontWeight={700} letterSpacing=".06em">ES</text>
              <text x={NW * 3 / 4} y={11} textAnchor="middle" fontSize={8} fill={bc} fontWeight={700} letterSpacing=".06em">EF</text>
              <text x={NW / 4} y={26} textAnchor="middle" fontSize={15} fill={bc} fontWeight={800}>{es}</text>
              <text x={NW * 3 / 4} y={26} textAnchor="middle" fontSize={15} fill={bc} fontWeight={800}>{ef}</text>
              <line x1={0} y1={32} x2={NW} y2={32} stroke={bc} strokeWidth={0.8} />
              <text x={NW / 2} y={46} textAnchor="middle" fontSize={11} fill="#0f172a" fontWeight={800}>{t.id}</text>
              <text x={NW / 2} y={59} textAnchor="middle" fontSize={9.5} fill="#64748b">{desc}</text>
              <line x1={0} y1={65} x2={NW} y2={65} stroke={bc} strokeWidth={0.8} />
              <line x1={NW / 2} y1={65} x2={NW / 2} y2={NH} stroke={bc} strokeWidth={1} />
              <text x={NW / 4} y={74} textAnchor="middle" fontSize={8} fill="#94a3b8" letterSpacing=".06em">LS</text>
              <text x={NW * 3 / 4} y={74} textAnchor="middle" fontSize={8} fill="#94a3b8" letterSpacing=".06em">LF</text>
              <text x={NW / 4} y={90} textAnchor="middle" fontSize={15} fill={isCrit ? "#ef4444" : "#64748b"} fontWeight={800}>{ls}</text>
              <text x={NW * 3 / 4} y={90} textAnchor="middle" fontSize={15} fill={isCrit ? "#ef4444" : "#64748b"} fontWeight={800}>{lf}</text>
              {slack !== null && (
                <g transform={`translate(${NW - 2},-10)`}>
                  <rect width={32} height={18} rx={9} fill={isCrit ? "#ef4444" : slack <= 2 ? "#f59e0b" : "#22c55e"} x={-32} />
                  <text x={-16} y={13} textAnchor="middle" fontSize={9} fill="white" fontWeight={800}>m={slack}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function getWeekDays(weekOffset = 0) {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
  const monday = new Date(new Date().setDate(diff));
  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      label: `${dayNames[i]} ${d.getDate()}/${d.getMonth() + 1}`,
      short: `${dayNames[i].slice(0, 3)} ${d.getDate()}/${d.getMonth() + 1}`,
    };
  });
}

function filterTasksByDate(tasks: Tache[], date: string) {
  return tasks.filter((t) => {
    const s = t.date_debut, e = t.date_fin || t.date_echeance;
    if (!s && !e) return true;
    if (s && s > date) return false;
    if (e && e < date) return false;
    return true;
  });
}

export function PERTView({ tasks, projects, pert, filters, setFilters, members, onStatusChange, onDelete }: {
  tasks: Tache[]; projects: Projet[]; pert: PertResult;
  filters: TaskFilters; setFilters: (updater: (f: TaskFilters) => TaskFilters) => void;
  members: Utilisateur[];
  onStatusChange?: (id: string, statut: StatutTache) => void;
  onDelete?: (id: string) => void;
}) {
  const [pf, setPf] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayIndex, setDayIndex] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });

  const today = new Date().toISOString().slice(0, 10);
  const isSideBySide = filters?.period === "week";
  const isSingleDay = filters?.period === "day" && filters?.single_date;
  const weekDays = getWeekDays(weekOffset);
  const currentDay = weekDays[dayIndex];

  const cycleSet = new Set(pert.cycles || []);
  const allProjects = ["all", ...Array.from(new Set(tasks.map((t) => String(t.projet)).filter(Boolean)))];
  const projectFiltered = pf === "all" ? tasks : tasks.filter((t) => String(t.projet) === pf);

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
        Diagramme PERT
      </h2>

      {filters && setFilters && (
        <FilterBar filters={filters} setFilters={setFilters} projects={projects} members={members || []} showStatus={false} />
      )}

      <PERTTable tasks={tasks} pert={pert} onStatusChange={onStatusChange} onDelete={onDelete} />

      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Réseau PERT</h3>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--text-3)" }}>chemin critique · nœud : début · durée · fin (haut), marge (bas)</p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {allProjects.map((pid) => {
          const label = pid === "all" ? "Tous" : (projects.find((p) => String(p.id) === pid)?.nom || pid);
          return (
            <button key={pid} onClick={() => setPf(pid)} style={{
              padding: "3px 12px", borderRadius: 20,
              border: `1.5px solid ${pf === pid ? "var(--accent)" : "var(--border)"}`,
              background: pf === pid ? "var(--accent)" : "transparent",
              color: pf === pid ? "white" : "var(--text-2)",
              cursor: "pointer", fontSize: 11, fontWeight: pf === pid ? 700 : 400,
            }}>{label}</button>
          );
        })}
      </div>

      {cycleSet.size > 0 && (
        <div style={{ marginBottom: 12, padding: "10px 16px", background: "#fef9c3", border: "1px solid #fde047", borderRadius: 10, fontSize: 12, color: "#854d0e" }}>
          ⚠️ <b>Cycle détecté</b>, tâches exclues du diagramme : {Array.from(cycleSet).join(", ")}
        </div>
      )}

      {isSideBySide && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <button onClick={() => { setWeekOffset((w) => w - 1); setDayIndex(0); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
              <ChevronLeft size={14} /> Semaine préc.
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={14} color="var(--text-3)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                {weekDays[0].date} → {weekDays[6].date}
              </span>
            </div>
            <button onClick={() => { setWeekOffset(0); setDayIndex(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1); }} style={{ background: "var(--accent-bg)", border: "1px solid var(--accent)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>
              Aujourd&apos;hui
            </button>
            <button onClick={() => { setWeekOffset((w) => w + 1); setDayIndex(0); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
              Semaine suiv. <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "var(--bg-card)", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
            {weekDays.map((d, i) => {
              const isToday = d.date === today;
              const isSelected = i === dayIndex;
              const dayTasks = filterTasksByDate(projectFiltered, d.date);
              return (
                <button key={d.date} onClick={() => setDayIndex(i)} style={{
                  flex: 1, padding: "8px 4px", borderRadius: 10, border: "none",
                  background: isSelected ? "var(--accent)" : isToday ? "var(--accent-bg)" : "transparent",
                  color: isSelected ? "white" : isToday ? "var(--accent)" : "var(--text-2)",
                  cursor: "pointer", fontSize: 11, fontWeight: isSelected || isToday ? 700 : 400,
                  transition: "all .15s",
                }}>
                  <div>{d.short}</div>
                  <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>{dayTasks.length} tâche{dayTasks.length !== 1 ? "s" : ""}</div>
                </button>
              );
            })}
          </div>

          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{currentDay.label}</h3>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {filterTasksByDate(projectFiltered, currentDay.date).length} tâche(s) active(s)
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setDayIndex((i) => Math.max(0, i - 1))} disabled={dayIndex === 0} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", cursor: dayIndex === 0 ? "not-allowed" : "pointer", opacity: dayIndex === 0 ? 0.4 : 1, fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
                  <ChevronLeft size={13} /> Jour préc.
                </button>
                <button onClick={() => setDayIndex((i) => Math.min(6, i + 1))} disabled={dayIndex === 6} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", cursor: dayIndex === 6 ? "not-allowed" : "pointer", opacity: dayIndex === 6 ? 0.4 : 1, fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
                  Jour suiv. <ChevronRight size={13} />
                </button>
              </div>
            </div>
            <PERTDiagram
              tasks={filterTasksByDate(projectFiltered, currentDay.date)}
              pert={computePERT(filterTasksByDate(projectFiltered, currentDay.date))}
              uid={currentDay.date}
            />
          </div>
        </div>
      )}

      {isSingleDay && filters.single_date && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
              {new Date(filters.single_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h3>
          </div>
          <PERTDiagram
            tasks={filterTasksByDate(projectFiltered, filters.single_date)}
            pert={computePERT(filterTasksByDate(projectFiltered, filters.single_date))}
            uid={filters.single_date}
          />
        </div>
      )}

      {!isSideBySide && !isSingleDay && (
        <PERTDiagram tasks={projectFiltered} pert={pert} uid="all" />
      )}

      <div style={{ marginTop: 10, display: "flex", gap: 20, flexWrap: "wrap", padding: "10px 16px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)", fontSize: 11, color: "var(--text-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, border: "2.5px solid #ef4444", background: "#fff8f8" }} />
          Chemin critique (marge = 0)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, border: "1.5px solid var(--accent)", background: "#ffffff" }} />
          Tâche normale
        </div>
        <span style={{ fontFamily: "'DM Mono',monospace", color: "var(--text-3)" }}>
          ES·EF = dates tôt · LS·LF = dates tard · m = marge totale
        </span>
      </div>
    </div>
  );
}
