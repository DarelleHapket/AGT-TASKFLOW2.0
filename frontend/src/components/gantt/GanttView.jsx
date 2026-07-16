// frontend/src/components/gantt/GanttView.jsx
import { useState } from "react";
import { FilterBar } from "../shared/FilterBar";
import { computePERT } from "../../utils/pert";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const ROW = 38, LW = 220, CW = 46, HH = 44;

function GanttChart({ tasks, pert, memberColor }) {
  const sorted = [...tasks].sort((a, b) => (pert.ES[a.id] ?? 0) - (pert.ES[b.id] ?? 0));
  const maxC   = Math.max(pert.end || 0, 10);
  const cols   = Array.from({ length: maxC + 2 }, (_, i) => i);
  const W      = LW + (maxC + 2) * CW;
  const H      = HH + sorted.length * ROW + 20;

  if (sorted.length === 0) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Aucune tâche active ce jour</div>
    </div>
  );

  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 12, overflow: "auto", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
      <svg width={W} height={H}>
        <defs>
          <marker id="ga" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <polygon points="0 0, 7 3.5, 0 7" fill="#94a3b8" />
          </marker>
        </defs>
        <rect x={0} y={0} width={LW} height={HH} fill="#f8fafc" />
        <text x={LW / 2} y={HH / 2 + 5} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight="700" letterSpacing=".08em">TÂCHE</text>
        {cols.map((c) => (
          <g key={c}>
            <rect x={LW + c * CW} y={0} width={CW} height={HH} fill={c % 2 === 0 ? "#f8fafc" : "#f1f5f9"} />
            <rect x={LW + c * CW} y={HH - 2} width={CW} height={2} fill="#e2e8f0" />
            <text x={LW + c * CW + CW / 2} y={HH / 2 + 5} textAnchor="middle" fill="#94a3b8" fontSize={12}>{c}</text>
          </g>
        ))}
        {sorted.map((t, i) => {
          const y      = HH + i * ROW;
          const es     = pert.ES[t.id] ?? 0;
          const dur    = t.duration || 1;
          const slack  = pert.slack[t.id] ?? null;
          const isCrit = slack === 0;
          const color  = memberColor(t.responsible);
          return (
            <g key={t.id}>
              <rect x={0} y={y} width={LW} height={ROW} fill={i % 2 === 0 ? "#fff" : "#f8fafc"} />
              {isCrit && <rect x={0} y={y} width={3} height={ROW} fill="#ef4444" />}
              {cols.map((c2) => (
                <rect key={c2} x={LW + c2 * CW} y={y} width={CW} height={ROW} fill={i % 2 === 0 ? "#fff" : "#f8fafc"} stroke="#e2e8f0" strokeWidth={0.5} />
              ))}
              <text x={isCrit ? 10 : 8} y={y + ROW / 2 + 4} fontSize={11} fill={isCrit ? "#ef4444" : "#475569"} fontWeight={isCrit ? "700" : "400"}>
                {t.id}: {(t.description || "").slice(0, 28)}{(t.description || "").length > 28 ? "…" : ""}
              </text>
              {slack !== null && slack > 0 && (
                <rect x={LW + (es + dur) * CW + 3} y={y + 12} width={slack * CW - 6} height={ROW - 24} fill="#e2e8f0" rx={4} opacity={0.5} />
              )}
              <rect x={LW + es * CW + 3} y={y + 7} width={Math.max(dur * CW - 6, 4)} height={ROW - 14}
                fill={color} rx={6} opacity={t.status === "done" ? 0.4 : 1}
                stroke={isCrit ? "#ef4444" : "transparent"} strokeWidth={2}
              />
              {dur * CW > 32 && (
                <text x={LW + es * CW + dur * CW / 2} y={y + ROW / 2 + 4} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold">{dur}c</text>
              )}
            </g>
          );
        })}
        {sorted.map((t) =>
          (t.dependencies || []).map((did) => {
            const fi = sorted.findIndex((x) => x.id === did);
            const ti = sorted.findIndex((x) => x.id === t.id);
            if (fi < 0 || ti < 0) return null;
            const x1 = LW + (pert.EF[did] ?? 0) * CW, y1 = HH + fi * ROW + ROW / 2;
            const x2 = LW + (pert.ES[t.id] ?? 0) * CW, y2 = HH + ti * ROW + ROW / 2;
            const isCrit = pert.slack[did] === 0 && pert.slack[t.id] === 0;
            return (
              <path key={`${did}>${t.id}`}
                d={`M${x1},${y1} C${x1 + 24},${y1} ${x2 - 24},${y2} ${x2},${y2}`}
                fill="none" stroke={isCrit ? "#ef4444" : "#94a3b8"}
                strokeWidth={isCrit ? 2 : 1}
                strokeDasharray={isCrit ? "none" : "5,3"}
                markerEnd="url(#ga)"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

function getWeekDays(weekOffset = 0) {
  const today  = new Date();
  const day    = today.getDay();
  const diff   = today.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
  const monday = new Date(new Date().setDate(diff));
  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      date:  d.toISOString().slice(0, 10),
      label: `${dayNames[i]} ${d.getDate()}/${d.getMonth() + 1}`,
      short: `${dayNames[i].slice(0, 3)} ${d.getDate()}/${d.getMonth() + 1}`,
    };
  });
}

function filterTasksByDate(tasks, date) {
  return tasks.filter((t) => {
    const s = t.start_date, e = t.end_date || t.due_date;
    if (!s && !e) return true;
    if (s && s > date) return false;
    if (e && e < date) return false;
    return true;
  });
}

export function GanttView({ tasks, projects, members, pert, filters, setFilters, memberColor }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayIndex,   setDayIndex]   = useState(() => {
    const today = new Date().getDay();
    return today === 0 ? 6 : today - 1;
  });

  const today        = new Date().toISOString().slice(0, 10);
  const isSideBySide = filters?.period === "week";
  const isSingleDay  = filters?.period === "day" && filters?.single_date;
  const weekDays     = getWeekDays(weekOffset);
  const currentDay   = weekDays[dayIndex];

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
        Diagramme de Gantt
      </h2>
      <FilterBar filters={filters} setFilters={setFilters} projects={projects} members={members} showStatus={false} />

      {/* ── Mode semaine — navigation jour par jour ── */}
      {isSideBySide && (
        <div>
          {/* Navigation semaine */}
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
              Aujourd'hui
            </button>
            <button onClick={() => { setWeekOffset((w) => w + 1); setDayIndex(0); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
              Semaine suiv. <ChevronRight size={14} />
            </button>
          </div>

          {/* Sélecteur de jours — pills cliquables */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "var(--bg-card)", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
            {weekDays.map((d, i) => {
              const isToday    = d.date === today;
              const isSelected = i === dayIndex;
              const dayTasks   = filterTasksByDate(tasks, d.date);
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

          {/* Gantt du jour sélectionné */}
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
                  {currentDay.label}
                </h3>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {filterTasksByDate(tasks, currentDay.date).length} tâche{filterTasksByDate(tasks, currentDay.date).length !== 1 ? "s" : ""} active{filterTasksByDate(tasks, currentDay.date).length !== 1 ? "s" : ""}
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
            <GanttChart
              tasks={filterTasksByDate(tasks, currentDay.date)}
              pert={computePERT(filterTasksByDate(tasks, currentDay.date))}
              memberColor={memberColor}
            />
          </div>
        </div>
      )}

      {/* ── Mode jour précis ── */}
      {isSingleDay && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
              {new Date(filters.single_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h3>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              {filterTasksByDate(tasks, filters.single_date).length} tâche(s) active(s)
            </span>
          </div>
          <GanttChart
            tasks={filterTasksByDate(tasks, filters.single_date)}
            pert={computePERT(filterTasksByDate(tasks, filters.single_date))}
            memberColor={memberColor}
          />
        </div>
      )}

      {/* ── Mode normal ── */}
      {!isSideBySide && !isSingleDay && (
        <GanttChart tasks={tasks} pert={pert} memberColor={memberColor} />
      )}

      {/* Légende */}
      <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", padding: "10px 16px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)" }}>
        {members.map((m) => (
          <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: m.color }} />
            <span style={{ fontSize: 11, color: "var(--text-2)" }}>{m.name}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 3, height: 14, background: "#ef4444", borderRadius: 2 }} />
          <span style={{ fontSize: 11, color: "var(--text-2)" }}>Chemin critique</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 18, height: 10, borderRadius: 3, background: "#e2e8f0" }} />
          <span style={{ fontSize: 11, color: "var(--text-2)" }}>Marge disponible</span>
        </div>
      </div>
    </div>
  );
}