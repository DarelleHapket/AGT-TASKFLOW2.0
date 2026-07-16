// frontend/src/components/reports/ReportsView.jsx
import { useState } from "react";
import { FileText, Download, Calendar, Users, User } from "lucide-react";
import * as api from "../../api/client";

const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week",  label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Plage personnalisée" },
];

const STATUS_LABEL = { todo: "À faire", in_progress: "En cours", done: "Terminée", blocked: "Bloquée" };

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

function generatePDF(data, memberName) {
  const lines = [];
  const title = memberName
    ? `Rapport — ${memberName}`
    : "Rapport équipe AGT Technologies";

  lines.push(`${title}`);
  lines.push(`Période : ${formatDate(data.date_from)} → ${formatDate(data.date_to)}`);
  lines.push(`Généré le : ${formatDate(data.generated_at)} par ${data.generated_by}`);
  lines.push("─".repeat(60));

  data.members.forEach((m) => {
    lines.push(`\n👤 ${m.name.toUpperCase()}`);
    lines.push(`  Assignées : ${m.summary.total_assigned} | Terminées : ${m.summary.total_done} | En cours : ${m.summary.total_in_progress}`);
    lines.push(`  Bloquées : ${m.summary.total_blocked} | En retard : ${m.summary.total_overdue} | Coupons : ${m.summary.total_coupons}`);

    if (m.done_tasks.length > 0) {
      lines.push(`\n  ✅ TÂCHES TERMINÉES (${m.done_tasks.length})`);
      m.done_tasks.forEach((t) => {
        lines.push(`    • [${t.id}] ${t.description} — ${t.project_name || "—"} (${formatDate(t.completed_at)})`);
      });
    }
    if (m.in_progress_tasks.length > 0) {
      lines.push(`\n  🔄 EN COURS (${m.in_progress_tasks.length})`);
      m.in_progress_tasks.forEach((t) => {
        lines.push(`    • [${t.id}] ${t.description} — ${t.project_name || "—"}`);
      });
    }
    if (m.overdue_tasks.length > 0) {
      lines.push(`\n  ⚠️ EN RETARD (${m.overdue_tasks.length})`);
      m.overdue_tasks.forEach((t) => {
        lines.push(`    • [${t.id}] ${t.description} — deadline : ${formatDate(t.due_date)}`);
      });
    }
    if (m.difficulties.length > 0) {
      lines.push(`\n  🚧 DIFFICULTÉS SIGNALÉES`);
      m.difficulties.forEach((d) => {
        lines.push(`    Tâche [${d.task_id}] ${d.task_description}`);
        d.items.forEach((item) => {
          lines.push(`      → ${item.content} (${item.member_name} — ${formatDate(item.created_at)})`);
        });
      });
    }
    lines.push("─".repeat(60));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${title.replace(/\s+/g, "_")}_${data.date_from}_${data.date_to}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsView({ members, user, isAdmin }) {
  const [period,     setPeriod]     = useState("week");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [scope,      setScope]      = useState("team");
  const [memberId,   setMemberId]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [preview,    setPreview]    = useState(null);
  const [error,      setError]      = useState(null);

  const loadReport = async () => {
    setLoading(true); setError(null);
    try {
      const params = { period };
      if (period === "custom") { params.date_from = dateFrom; params.date_to = dateTo; }
      if (scope === "member" && memberId) params.member_id = memberId;
      const data = await api.getReportData(params);
      setPreview(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const downloadReport = () => {
    if (!preview) return;
    const memberName = scope === "member"
      ? members.find((m) => String(m.id) === String(memberId))?.name
      : null;
    generatePDF(preview, memberName);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Rapports</h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>Génération de rapports d'activité</span>
        </div>
      </div>

      {/* Paramètres */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

          {/* Période */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 8, letterSpacing: ".08em" }}>
              PÉRIODE
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PERIODS.map((p) => (
                <button key={p.value} onClick={() => setPeriod(p.value)} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12,
                  border: `1px solid ${period === p.value ? "var(--accent)" : "var(--border)"}`,
                  background: period === p.value ? "var(--accent-bg)" : "transparent",
                  color: period === p.value ? "var(--accent)" : "var(--text-2)",
                  cursor: "pointer", fontWeight: period === p.value ? 700 : 400,
                }}>
                  {p.label}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }} />
                <span style={{ color: "var(--text-3)", fontSize: 12 }}>→</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }} />
              </div>
            )}
          </div>

          {/* Périmètre */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 8, letterSpacing: ".08em" }}>
              PÉRIMÈTRE
            </label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <button onClick={() => setScope("team")} style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12,
                border: `1px solid ${scope === "team" ? "var(--accent)" : "var(--border)"}`,
                background: scope === "team" ? "var(--accent-bg)" : "transparent",
                color: scope === "team" ? "var(--accent)" : "var(--text-2)",
                cursor: "pointer", fontWeight: scope === "team" ? 700 : 400,
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <Users size={13} /> Équipe entière
              </button>
              <button onClick={() => setScope("member")} style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12,
                border: `1px solid ${scope === "member" ? "var(--accent)" : "var(--border)"}`,
                background: scope === "member" ? "var(--accent-bg)" : "transparent",
                color: scope === "member" ? "var(--accent)" : "var(--text-2)",
                cursor: "pointer", fontWeight: scope === "member" ? 700 : 400,
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <User size={13} /> Membre individuel
              </button>
            </div>
            {scope === "member" && (
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)}
                style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", width: "100%" }}>
                <option value="">— Choisir un membre —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadReport} disabled={loading} style={{
            background: "var(--accent)", color: "white", border: "none",
            borderRadius: 10, padding: "10px 20px", cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6,
            opacity: loading ? 0.7 : 1,
          }}>
            <FileText size={14} /> {loading ? "Chargement…" : "Générer l'aperçu"}
          </button>
          {preview && (
            <button onClick={downloadReport} style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a",
              borderRadius: 10, padding: "10px 20px", cursor: "pointer",
              fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6,
            }}>
              <Download size={14} /> Télécharger
            </button>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#ef4444" }}>
            {error}
          </div>
        )}
      </div>

      {/* Aperçu */}
      {preview && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
            Aperçu — {formatDate(preview.date_from)} → {formatDate(preview.date_to)}
          </h3>
          {preview.members.map((m) => (
            <div key={m.id} style={{ marginBottom: 20, padding: 16, background: "var(--bg)", borderRadius: 12, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 13 }}>
                  {m.name[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{m.name}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "Assignées",  val: m.summary.total_assigned,    color: "var(--text)" },
                  { label: "Terminées",  val: m.summary.total_done,        color: "#22c55e"     },
                  { label: "En cours",   val: m.summary.total_in_progress, color: "#3b82f6"     },
                  { label: "Bloquées",   val: m.summary.total_blocked,     color: "#ef4444"     },
                  { label: "En retard",  val: m.summary.total_overdue,     color: "#f59e0b"     },
                  { label: "Coupons",    val: m.summary.total_coupons,     color: "var(--accent)" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "var(--bg-card)", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
                    <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              {m.difficulties.length > 0 && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                    ⚠️ {m.difficulties.length} difficulté{m.difficulties.length > 1 ? "s" : ""} signalée{m.difficulties.length > 1 ? "s" : ""}
                  </div>
                  {m.difficulties.map((d) => (
                    <div key={d.task_id} style={{ fontSize: 11, color: "#78350f", marginBottom: 4 }}>
                      [{d.task_id}] {d.task_description} — {d.items.length} signalement{d.items.length > 1 ? "s" : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}