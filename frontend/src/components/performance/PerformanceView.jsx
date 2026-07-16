import { useState, useEffect } from "react";
import { getPerformance } from "../../api/client";
import { Trophy, TrendingUp, Clock } from "lucide-react";

function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return [fmt(mon), fmt(sun)];
}

function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return [from, to];
}

const PERIODS = [
  { id: "week",   label: "Cette semaine" },
  { id: "month",  label: "Ce mois" },
  { id: "custom", label: "Plage personnalisée" },
  { id: "all",    label: "Tout" },
];

function MedalIcon({ rank }) {
  if (rank === 0) return <span style={{ fontSize: 22 }}>🥇</span>;
  if (rank === 1) return <span style={{ fontSize: 22 }}>🥈</span>;
  if (rank === 2) return <span style={{ fontSize: 22 }}>🥉</span>;
  return <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-3)", width: 28, textAlign: "center" }}>#{rank + 1}</span>;
}

export function PerformanceView({ members }) {
  const [period, setPeriod]     = useState("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(false);

  const memberColor = (name) => members.find((m) => m.name === name)?.color || "#94a3b8";

  const load = async (p, df, dt) => {
    setLoading(true);
    let from = df, to = dt;
    if (p === "week") { [from, to] = getWeekRange(); }
    else if (p === "month") { [from, to] = getMonthRange(); }
    else if (p === "all") { from = ""; to = ""; }
    try {
      const res = await getPerformance(from, to);
      setData(res);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(period, dateFrom, dateTo); }, []);

  const handlePeriod = (p) => {
    setPeriod(p);
    if (p !== "custom") load(p, "", "");
  };

  const maxCoupons = data.length ? Math.max(...data.map((d) => d.total_coupons), 1) : 1;

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Performances</h2>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>Coupons cumulés sur les tâches terminées</span>
      </div>

      {/* Period selector */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 20, padding: "12px 16px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginRight: 4 }}>PÉRIODE</span>
        {PERIODS.map(({ id, label }) => {
          const active = period === id;
          return <button key={id} onClick={() => handlePeriod(id)} style={{ padding: "4px 14px", borderRadius: 20, border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent)" : "transparent", color: active ? "white" : "var(--text-2)", cursor: "pointer", fontSize: 11, fontWeight: active ? 700 : 400 }}>{label}</button>;
        })}
        {period === "custom" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              style={{ padding: "4px 10px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 12, outline: "none", background: "white", color: "var(--text)" }} />
            <span style={{ color: "var(--text-3)", fontSize: 12 }}>→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              style={{ padding: "4px 10px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 12, outline: "none", background: "white", color: "var(--text)" }} />
            <button onClick={() => load("custom", dateFrom, dateTo)}
              style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              Appliquer
            </button>
          </div>
        )}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)" }}>Chargement…</div>}

      {!loading && data.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)", background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
          <div>Aucune tâche terminée sur cette période.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Marquez des tâches comme "Terminée" pour voir les stats.</div>
        </div>
      )}

      {!loading && data.length > 0 && (
        <>
          {/* Podium cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
            {data.map((d, i) => {
              const color = memberColor(d.member);
              return (
                <div key={d.member} style={{ background: "var(--bg-card)", borderRadius: 14, padding: 16, border: `2px solid ${i === 0 ? "#f59e0b" : "var(--border)"}`, boxShadow: i === 0 ? "0 4px 20px #f59e0b20" : "var(--shadow)", position: "relative" }}>
                  <div style={{ position: "absolute", top: 12, right: 12 }}><MedalIcon rank={i} /></div>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 18, marginBottom: 10 }}>
                    {d.member[0]?.toUpperCase()}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", marginBottom: 4 }}>{d.member}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color }}>{d.total_coupons}</span>
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>coupons</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{d.task_count} tâche{d.task_count !== 1 ? "s" : ""} terminée{d.task_count !== 1 ? "s" : ""}</div>
                  {/* Mini bar */}
                  <div style={{ marginTop: 10, height: 5, background: "var(--border)", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${Math.round((d.total_coupons / maxCoupons) * 100)}%`, background: color, borderRadius: 3, transition: "width .5s" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed table */}
          <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
            <div style={{ padding: "12px 16px", background: "var(--bg-hover)", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "2fr 3fr 1fr 1fr", gap: 8 }}>
              {["MEMBRE", "PAR PROJET", "TÂCHES", "COUPONS"].map((h) => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".08em" }}>{h}</span>
              ))}
            </div>
            {data.map((d, i) => {
              const color = memberColor(d.member);
              return (
                <div key={d.member} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "2fr 3fr 1fr 1fr", gap: 8, alignItems: "start", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                      {d.member[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{d.member}</span>
                  </div>
                  <div>
                    {d.by_project.map((bp) => (
                      <div key={bp.project} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-2)", marginBottom: 2 }}>
                        <span>📁 {bp.project}</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", color: "var(--text-3)" }}>{bp.total_coupons}c</span>
                      </div>
                    ))}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{d.task_count}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color }}>{d.total_coupons}</span>
                    <span style={{ fontSize: 10, color: "var(--text-3)" }}>c</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}