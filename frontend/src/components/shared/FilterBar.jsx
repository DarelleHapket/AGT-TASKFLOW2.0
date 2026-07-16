// frontend/src/components/shared/FilterBar.jsx
import { useState, useEffect, useRef } from "react";
import { X, Search, Calendar, ChevronDown } from "lucide-react";
import { STATUSES } from "../../utils/pert";

const PRIORITIES = [
  { value: "critique", label: "Critique" },
  { value: "haute",    label: "Haute"    },
  { value: "normale",  label: "Normale"  },
];

const PERIODS = [
  { value: "all",    label: "Tout"       },
  { value: "today",  label: "Aujourd'hui" },
  { value: "week",   label: "Cette semaine" },
  { value: "month",  label: "Ce mois"    },
  { value: "custom", label: "Plage…"     },
  { value: "day",    label: "Jour précis" },
];

function getWeekDays(weekOffset = 0) {
  const today = new Date();
  const day   = today.getDay();
  const diff  = today.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
  const monday = new Date(today.setDate(diff));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function getDateRange(period, customFrom, customTo, singleDay) {
  const today = new Date().toISOString().slice(0, 10);
  if (period === "today")  return { from: today, to: today, single: null };
  if (period === "day")    return { from: null, to: null, single: singleDay || today };
  if (period === "week") {
    const days = getWeekDays(0);
    return { from: days[0], to: days[6], single: null };
  }
  if (period === "month") {
    const now  = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { from, to, single: null };
  }
  if (period === "custom") return { from: customFrom, to: customTo, single: null };
  return { from: null, to: null, single: null };
}

const pill = (active, label, onClick) => (
  <button key={label} onClick={onClick} style={{
    padding: "3px 10px", borderRadius: 20,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: active ? "var(--accent)" : "transparent",
    color: active ? "white" : "var(--text-2)",
    cursor: "pointer", fontSize: 11,
    fontWeight: active ? 700 : 400,
    whiteSpace: "nowrap", transition: "all .15s",
  }}>
    {label}
  </button>
);

export function FilterBar({ filters, setFilters, projects, members, showStatus = true }) {
  const set         = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const [search, setSearch]     = useState(filters.search || "");
  const [customFrom, setCustomFrom] = useState(filters.date_from || "");
  const [customTo, setCustomTo]     = useState(filters.date_to   || "");
  const [singleDay, setSingleDay]   = useState(filters.single_date || "");
  const debounceRef = useRef(null);

  // Debounce recherche texte 300ms
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      set("search", search);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Calculer la plage de dates selon la période
  useEffect(() => {
    const { from, to, single } = getDateRange(
      filters.period || "all", customFrom, customTo, singleDay
    );
    setFilters((f) => ({ ...f, date_from: from, date_to: to, single_date: single }));
  }, [filters.period, customFrom, customTo, singleDay]);

  const isActive = filters.search || filters.priority !== "all" ||
    filters.period !== "all" || filters.show_overdue || filters.show_critical ||
    filters.show_archived;

  const reset = () => {
    setSearch(""); setCustomFrom(""); setCustomTo(""); setSingleDay("");
    setFilters((f) => ({
      ...f, search: "", priority: "all", period: "all",
      date_from: null, date_to: null, single_date: null,
      show_overdue: false, show_critical: false, show_archived: false,
    }));
  };

  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: "var(--radius)",
      border: "1px solid var(--border)", boxShadow: "var(--shadow)",
      marginBottom: 16, overflow: "hidden",
    }}>
      {/* Ligne 1 — Projet + Membre + Statut (existants) */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".08em" }}>PROJET</span>
          {pill(filters.project === "all", "Tous", () => set("project", "all"))}
          {projects.map((p) => pill(String(filters.project) === String(p.id), p.name, () => set("project", p.id)))}
        </div>
        <div style={{ width: 1, background: "var(--border)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".08em" }}>MEMBRE</span>
          {pill(filters.member === "all", "Tous", () => set("member", "all"))}
          {members.map((m) => pill(filters.member === m.name, m.name, () => set("member", m.name)))}
        </div>
        {showStatus && (
          <>
            <div style={{ width: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".08em" }}>STATUT</span>
              {pill(filters.status === "all", "Tous", () => set("status", "all"))}
              {STATUSES.map((s) => pill(filters.status === s.value, s.label, () => set("status", s.value)))}
            </div>
          </>
        )}
      </div>

      {/* Ligne 2 — Nouveaux filtres v2 */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "10px 16px", alignItems: "center" }}>

        {/* Recherche texte */}
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (ID, description, projet…)"
            style={{ paddingLeft: 28, fontSize: 12, height: 32, borderRadius: 8, width: "100%", boxSizing: "border-box" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}>
              <X size={12} />
            </button>
          )}
        </div>

        <div style={{ width: 1, height: 24, background: "var(--border)" }} />

        {/* Priorité */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".08em" }}>PRIORITÉ</span>
          {pill(filters.priority === "all", "Toutes", () => set("priority", "all"))}
          {PRIORITIES.map((p) => pill(filters.priority === p.value, p.label, () => set("priority", p.value)))}
        </div>

        <div style={{ width: 1, height: 24, background: "var(--border)" }} />

        {/* Période temporelle */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <Calendar size={12} color="var(--text-3)" />
          <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".08em" }}>PÉRIODE</span>
          {PERIODS.map((p) => pill((filters.period || "all") === p.value, p.label, () => set("period", p.value)))}
        </div>

        {/* Sélecteur jour précis */}
        {filters.period === "day" && (
          <input
            type="date" value={singleDay}
            onChange={(e) => setSingleDay(e.target.value)}
            style={{ fontSize: 12, height: 32, borderRadius: 8, padding: "0 8px" }}
          />
        )}

        {/* Sélecteur plage personnalisée */}
        {filters.period === "custom" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              style={{ fontSize: 12, height: 32, borderRadius: 8, padding: "0 8px" }} />
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              style={{ fontSize: 12, height: 32, borderRadius: 8, padding: "0 8px" }} />
          </div>
        )}

        <div style={{ width: 1, height: 24, background: "var(--border)" }} />

        {/* Booléens */}
        <div style={{ display: "flex", gap: 6 }}>
          {pill(filters.show_overdue,  "⚠️ En retard",  () => set("show_overdue",  !filters.show_overdue))}
          {pill(filters.show_critical, "🔴 Critiques",  () => set("show_critical", !filters.show_critical))}
          {pill(filters.show_archived, "📦 Archivées",  () => set("show_archived", !filters.show_archived))}
        </div>

        {/* Bouton reset */}
        {isActive && (
          <button onClick={reset} style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
            background: "var(--danger-bg)", border: "1px solid #fecaca",
            borderRadius: 8, padding: "4px 10px", cursor: "pointer",
            color: "var(--danger)", fontSize: 11, fontWeight: 600,
          }}>
            <X size={11} /> Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}