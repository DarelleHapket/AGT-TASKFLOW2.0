"use client";

// Port fidèle de frontend/src/components/shared/FilterBar.jsx. Adapté :
// filters.member compare désormais un id utilisateur (FK), pas un nom en
// texte libre (le backend a remplacé Tache.responsable par une vraie FK).
import { useEffect, useRef, useState } from "react";
import { X, Search, Calendar, ChevronDown } from "lucide-react";
import { STATUSES, PRIORITIES } from "@/lib/pert";
import type { Projet, Utilisateur } from "@/lib/types";

export interface TaskFilters {
  project: string; member: string; status: string; priority: string; period: string;
  date_from: string | null; date_to: string | null; single_date: string | null;
  show_overdue: boolean; show_critical: boolean; show_archived: boolean; search: string;
}

const PERIODS = [
  { value: "all", label: "Tout" },
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Plage…" },
  { value: "day", label: "Jour précis" },
];

function getWeekDays(weekOffset = 0) {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
  const monday = new Date(today.setDate(diff));
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function getDateRange(period: string, customFrom: string, customTo: string, singleDay: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (period === "today") return { from: today, to: today, single: null as string | null };
  if (period === "day") return { from: null, to: null, single: singleDay || today };
  if (period === "week") { const days = getWeekDays(0); return { from: days[0], to: days[6], single: null }; }
  if (period === "month") {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { from, to, single: null };
  }
  if (period === "custom") return { from: customFrom, to: customTo, single: null };
  return { from: null, to: null, single: null };
}

function Pill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "3px 10px", borderRadius: 20, border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
      background: active ? "var(--accent)" : "transparent", color: active ? "white" : "var(--text-2)",
      cursor: "pointer", fontSize: 11, fontWeight: active ? 700 : 400, whiteSpace: "nowrap", transition: "all .15s",
    }}>
      {label}
    </button>
  );
}

function FilterDropdown({ label, options, value, onChange }: {
  label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selected = options.find((o) => String(o.value) === String(value)) || options[0];

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".08em" }}>{label}</span>
      <button onClick={() => setOpen((v) => !v)} style={{
        display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20,
        border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
        background: open ? "var(--accent-bg)" : "transparent", color: open ? "var(--accent)" : "var(--text-2)",
        cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", transition: "all .15s",
      }}>
        {selected?.label || "Tous"}
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 300, minWidth: 180, maxHeight: 260, overflowY: "auto", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-md)", padding: 4 }}>
          {options.map((o) => {
            const active = String(o.value) === String(value);
            return (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{
                display: "block", width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 7, border: "none",
                background: active ? "var(--accent-bg)" : "transparent", color: active ? "var(--accent)" : "var(--text)",
                fontWeight: active ? 700 : 400, fontSize: 12, cursor: "pointer",
              }}>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FilterBar({ filters, setFilters, projects, members, showStatus = true, compact = false }: {
  filters: TaskFilters; setFilters: (updater: (f: TaskFilters) => TaskFilters) => void;
  projects: Projet[]; members: Utilisateur[]; showStatus?: boolean; compact?: boolean;
}) {
  const set = <K extends keyof TaskFilters>(k: K, v: TaskFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const [search, setSearch] = useState(filters.search || "");
  const [customFrom, setCustomFrom] = useState(filters.date_from || "");
  const [customTo, setCustomTo] = useState(filters.date_to || "");
  const [singleDay, setSingleDay] = useState(filters.single_date || "");

  useEffect(() => {
    const t = setTimeout(() => set("search", search), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const { from, to, single } = getDateRange(filters.period || "all", customFrom, customTo, singleDay);
    setFilters((f) => ({ ...f, date_from: from, date_to: to, single_date: single }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.period, customFrom, customTo, singleDay]);

  const isActive = filters.search || filters.priority !== "all" || filters.period !== "all" || filters.show_overdue || filters.show_critical || filters.show_archived;

  const reset = () => {
    setSearch(""); setCustomFrom(""); setCustomTo(""); setSingleDay("");
    setFilters((f) => ({ ...f, search: "", priority: "all", period: "all", date_from: null, date_to: null, single_date: null, show_overdue: false, show_critical: false, show_archived: false }));
  };

  return (
    <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius)", border: "1px solid var(--border)", boxShadow: "var(--shadow)", marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
        <FilterDropdown label="PROJET" value={filters.project ?? "all"} onChange={(v) => set("project", v)}
          options={[{ value: "all", label: "Tous" }, ...projects.map((p) => ({ value: String(p.id), label: p.nom }))]} />
        <div style={{ width: 1, background: "var(--border)" }} />
        <FilterDropdown label="MEMBRE" value={filters.member ?? "all"} onChange={(v) => set("member", v)}
          options={[{ value: "all", label: "Tous" }, ...members.map((m) => ({ value: String(m.id), label: m.name }))]} />
        {showStatus && (
          <>
            <div style={{ width: 1, background: "var(--border)" }} />
            <FilterDropdown label="STATUT" value={filters.status ?? "all"} onChange={(v) => set("status", v)}
              options={[{ value: "all", label: "Tous" }, ...STATUSES.map((s) => ({ value: s.value, label: s.label }))]} />
          </>
        )}
      </div>

      {!compact && (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "10px 16px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (ID, description, projet…)"
            style={{ paddingLeft: 28, fontSize: 12, height: 32, borderRadius: 8, width: "100%", boxSizing: "border-box" }} />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}>
              <X size={12} />
            </button>
          )}
        </div>

        <div style={{ width: 1, height: 24, background: "var(--border)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".08em" }}>PRIORITÉ</span>
          <Pill active={filters.priority === "all"} label="Toutes" onClick={() => set("priority", "all")} />
          {PRIORITIES.map((p) => <Pill key={p.value} active={filters.priority === p.value} label={p.label} onClick={() => set("priority", p.value)} />)}
        </div>

        <div style={{ width: 1, height: 24, background: "var(--border)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <Calendar size={12} color="var(--text-3)" />
          <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".08em" }}>PÉRIODE</span>
          {PERIODS.map((p) => <Pill key={p.value} active={(filters.period || "all") === p.value} label={p.label} onClick={() => set("period", p.value)} />)}
        </div>

        {filters.period === "day" && (
          <input type="date" value={singleDay} onChange={(e) => setSingleDay(e.target.value)} style={{ fontSize: 12, height: 32, borderRadius: 8, padding: "0 8px" }} />
        )}

        {filters.period === "custom" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ fontSize: 12, height: 32, borderRadius: 8, padding: "0 8px" }} />
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ fontSize: 12, height: 32, borderRadius: 8, padding: "0 8px" }} />
          </div>
        )}

        <div style={{ width: 1, height: 24, background: "var(--border)" }} />

        <div style={{ display: "flex", gap: 6 }}>
          <Pill active={filters.show_overdue} label="⚠️ En retard" onClick={() => set("show_overdue", !filters.show_overdue)} />
          <Pill active={filters.show_critical} label="🔴 Critiques" onClick={() => set("show_critical", !filters.show_critical)} />
          <Pill active={filters.show_archived} label="📦 Archivées" onClick={() => set("show_archived", !filters.show_archived)} />
        </div>

        {isActive && (
          <button onClick={reset} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: "var(--danger-bg)", border: "1px solid #fecaca", borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: "var(--danger)", fontSize: 11, fontWeight: 600 }}>
            <X size={11} /> Réinitialiser
          </button>
        )}
      </div>
      )}
    </div>
  );
}
