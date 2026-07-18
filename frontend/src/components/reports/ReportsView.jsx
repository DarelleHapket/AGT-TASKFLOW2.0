// frontend/src/components/reports/ReportsView.jsx
import { useState } from "react";
import { FileText, Download, Calendar, Users, User, FileDown, FolderOpen } from "lucide-react";
import { jsPDF } from "jspdf";
import * as api from "../../api/client";

const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week",  label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Plage personnalisée" },
];

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

// ── Rapport par membre : TXT ────────────────────────────────────────────────
function generateTXT(data, memberName) {
  const lines = [];
  const title = memberName ? `Rapport — ${memberName}` : "Rapport équipe AGT Technologies";
  lines.push(`${title}`);
  lines.push(`Période : ${formatDate(data.date_from)} -> ${formatDate(data.date_to)}`);
  lines.push(`Généré le : ${formatDate(data.generated_at)} par ${data.generated_by}`);
  lines.push("─".repeat(60));

  data.members.forEach((m) => {
    lines.push(`\n👤 ${m.name.toUpperCase()}`);
    lines.push(`  Assignées : ${m.summary.total_assigned} | Terminées : ${m.summary.total_done} | En cours : ${m.summary.total_in_progress}`);
    lines.push(`  Bloquées : ${m.summary.total_blocked} | En retard : ${m.summary.total_overdue} | Coupons : ${m.summary.total_coupons}`);
    if (m.done_tasks.length > 0) {
      lines.push(`\n  ✅ TÂCHES TERMINÉES (${m.done_tasks.length})`);
      m.done_tasks.forEach((t) => lines.push(`    • [${t.id}] ${t.description} — ${t.project_name || "—"} (${formatDate(t.completed_at)})`));
    }
    if (m.in_progress_tasks.length > 0) {
      lines.push(`\n  🔄 EN COURS (${m.in_progress_tasks.length})`);
      m.in_progress_tasks.forEach((t) => lines.push(`    • [${t.id}] ${t.description} — ${t.project_name || "—"}`));
    }
    if (m.overdue_tasks.length > 0) {
      lines.push(`\n  ⚠️ EN RETARD (${m.overdue_tasks.length})`);
      m.overdue_tasks.forEach((t) => lines.push(`    • [${t.id}] ${t.description} — deadline : ${formatDate(t.due_date)}`));
    }
    if (m.difficulties.length > 0) {
      lines.push(`\n  🚧 DIFFICULTÉS SIGNALÉES`);
      m.difficulties.forEach((d) => {
        lines.push(`    Tâche [${d.task_id}] ${d.task_description} — ${d.project_name || "—"}`);
        d.items.forEach((item) => lines.push(`      → ${item.content} (${item.member_name} — ${formatDate(item.created_at)})`));
      });
    }
    lines.push("─".repeat(60));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_")}_${data.date_from}_${data.date_to}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Rapport par membre : PDF ────────────────────────────────────────────────
function generatePDF(data, memberName) {
  const title = memberName ? `Rapport - ${memberName}` : "Rapport equipe AGT Technologies";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;
  const line = (text, size = 10, style = "normal", color = [30, 30, 30]) => {
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
    doc.splitTextToSize(text, pageW - margin * 2).forEach((w) => {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.text(w, margin, y); y += size + 4;
    });
  };
  const sep = () => { doc.setDrawColor(200); doc.line(margin, y, pageW - margin, y); y += 10; };

  line(title, 16, "bold", [40, 40, 90]);
  line(`Période : ${formatDate(data.date_from)} -> ${formatDate(data.date_to)}`, 10, "normal", [90, 90, 90]);
  line(`Généré le ${formatDate(data.generated_at)} par ${data.generated_by}`, 9, "normal", [120, 120, 120]);
  y += 4; sep();

  data.members.forEach((m) => {
    line(m.name.toUpperCase(), 13, "bold", [20, 20, 20]);
    line(`Assignées: ${m.summary.total_assigned}   Terminées: ${m.summary.total_done}   En cours: ${m.summary.total_in_progress}`, 10);
    line(`Bloquées: ${m.summary.total_blocked}   En retard: ${m.summary.total_overdue}   Coupons: ${m.summary.total_coupons}`, 10);
    if (m.done_tasks.length > 0) {
      line(`Terminées (${m.done_tasks.length})`, 11, "bold", [22, 120, 60]);
      m.done_tasks.forEach((t) => line(`- [${t.id}] ${t.description} — ${t.project_name || "—"} (${formatDate(t.completed_at)})`, 9));
    }
    if (m.in_progress_tasks.length > 0) {
      line(`En cours (${m.in_progress_tasks.length})`, 11, "bold", [40, 90, 180]);
      m.in_progress_tasks.forEach((t) => line(`- [${t.id}] ${t.description} — ${t.project_name || "—"}`, 9));
    }
    if (m.overdue_tasks.length > 0) {
      line(`En retard (${m.overdue_tasks.length})`, 11, "bold", [200, 120, 20]);
      m.overdue_tasks.forEach((t) => line(`- [${t.id}] ${t.description} — deadline: ${formatDate(t.due_date)}`, 9));
    }
    if (m.difficulties.length > 0) {
      line("Difficultés signalées", 11, "bold", [180, 40, 40]);
      m.difficulties.forEach((d) => {
        line(`Tâche [${d.task_id}] ${d.task_description} — ${d.project_name || "—"}`, 9, "bold");
        d.items.forEach((item) => line(`   -> ${item.content} (${item.member_name} — ${formatDate(item.created_at)})`, 9));
      });
    }
    y += 4; sep();
  });
  doc.save(`${title.replace(/\s+/g, "_")}_${data.date_from}_${data.date_to}.pdf`);
}

// ── Rapport par projet : TXT ────────────────────────────────────────────────
function generateProjectTXT(data) {
  const p = data.project;
  const lines = [];
  lines.push(`Rapport projet — ${p.name}`);
  if (p.chef_name) lines.push(`Chef de projet : ${p.chef_name}`);
  lines.push(`Période : ${formatDate(data.date_from)} -> ${formatDate(data.date_to)}`);
  lines.push(`Généré le : ${formatDate(data.generated_at)} par ${data.generated_by}`);
  lines.push("─".repeat(60));
  const s = data.summary;
  lines.push(`Tâches : ${s.total_tasks} | Terminées : ${s.total_done} | En cours : ${s.total_in_progress}`);
  lines.push(`Bloquées : ${s.total_blocked} | En retard : ${s.total_overdue} | Coupons : ${s.total_coupons}`);
  if (data.members.length > 0) {
    lines.push(`\n  MEMBRES SUR LE PROJET`);
    data.members.forEach((m) => lines.push(`    • ${m.name} — ${m.total} tâche(s), ${m.done} terminée(s), ${m.coupons} coupon(s)`));
  }
  if (data.done_tasks.length > 0) {
    lines.push(`\n  ✅ TERMINÉES (${data.done_tasks.length})`);
    data.done_tasks.forEach((t) => lines.push(`    • [${t.id}] ${t.description} — ${t.responsible || "—"}`));
  }
  if (data.in_progress_tasks.length > 0) {
    lines.push(`\n  🔄 EN COURS (${data.in_progress_tasks.length})`);
    data.in_progress_tasks.forEach((t) => lines.push(`    • [${t.id}] ${t.description} — ${t.responsible || "—"}`));
  }
  if (data.overdue_tasks.length > 0) {
    lines.push(`\n  ⚠️ EN RETARD (${data.overdue_tasks.length})`);
    data.overdue_tasks.forEach((t) => lines.push(`    • [${t.id}] ${t.description} — deadline : ${formatDate(t.due_date)}`));
  }
  if (data.difficulties.length > 0) {
    lines.push(`\n  🚧 DIFFICULTÉS`);
    data.difficulties.forEach((d) => {
      lines.push(`    Tâche [${d.task_id}] ${d.task_description} — ${d.project_name}`);
      d.items.forEach((item) => lines.push(`      → ${item.content} (${item.member_name} — ${formatDate(item.created_at)})`));
    });
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Rapport_projet_${p.name.replace(/\s+/g, "_")}_${data.date_from}_${data.date_to}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Rapport par projet : PDF ────────────────────────────────────────────────
function generateProjectPDF(data) {
  const p = data.project;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;
  const line = (text, size = 10, style = "normal", color = [30, 30, 30]) => {
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
    doc.splitTextToSize(text, pageW - margin * 2).forEach((w) => {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.text(w, margin, y); y += size + 4;
    });
  };
  const sep = () => { doc.setDrawColor(200); doc.line(margin, y, pageW - margin, y); y += 10; };

  line(`Rapport projet - ${p.name}`, 16, "bold", [40, 40, 90]);
  if (p.chef_name) line(`Chef de projet : ${p.chef_name}`, 10, "normal", [90, 90, 90]);
  line(`Période : ${formatDate(data.date_from)} -> ${formatDate(data.date_to)}`, 10, "normal", [90, 90, 90]);
  line(`Généré le ${formatDate(data.generated_at)} par ${data.generated_by}`, 9, "normal", [120, 120, 120]);
  y += 4; sep();
  const s = data.summary;
  line(`Tâches: ${s.total_tasks}   Terminées: ${s.total_done}   En cours: ${s.total_in_progress}`, 10);
  line(`Bloquées: ${s.total_blocked}   En retard: ${s.total_overdue}   Coupons: ${s.total_coupons}`, 10);
  y += 4;
  if (data.members.length > 0) {
    line("Membres sur le projet", 12, "bold", [20, 20, 20]);
    data.members.forEach((m) => line(`- ${m.name} : ${m.total} tâche(s), ${m.done} terminée(s), ${m.coupons} coupon(s)`, 9));
  }
  if (data.done_tasks.length > 0) {
    line(`Terminées (${data.done_tasks.length})`, 11, "bold", [22, 120, 60]);
    data.done_tasks.forEach((t) => line(`- [${t.id}] ${t.description} — ${t.responsible || "—"}`, 9));
  }
  if (data.in_progress_tasks.length > 0) {
    line(`En cours (${data.in_progress_tasks.length})`, 11, "bold", [40, 90, 180]);
    data.in_progress_tasks.forEach((t) => line(`- [${t.id}] ${t.description} — ${t.responsible || "—"}`, 9));
  }
  if (data.overdue_tasks.length > 0) {
    line(`En retard (${data.overdue_tasks.length})`, 11, "bold", [200, 120, 20]);
    data.overdue_tasks.forEach((t) => line(`- [${t.id}] ${t.description} — deadline: ${formatDate(t.due_date)}`, 9));
  }
  if (data.difficulties.length > 0) {
    line("Difficultés", 11, "bold", [180, 40, 40]);
    data.difficulties.forEach((d) => {
      line(`Tâche [${d.task_id}] ${d.task_description} — ${d.project_name}`, 9, "bold");
      d.items.forEach((item) => line(`   -> ${item.content} (${item.member_name} — ${formatDate(item.created_at)})`, 9));
    });
  }
  y += 4; sep();
  doc.save(`Rapport_projet_${p.name.replace(/\s+/g, "_")}_${data.date_from}_${data.date_to}.pdf`);
}


export function ReportsView({ members, projects = [], user, isAdmin, isChef }) {
  const [period,      setPeriod]      = useState("week");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [scope,       setScope]       = useState("team");
  const [memberId,    setMemberId]    = useState("");
  const [projectId,   setProjectId]   = useState("");
  const [loading,     setLoading]     = useState(false);
  const [preview,     setPreview]     = useState(null);   // rapport par membre
  const [projPreview, setProjPreview] = useState(null);   // rapport par projet
  const [error,       setError]       = useState(null);

  const canProjectReport = isAdmin || isChef;
  const availableProjects = isAdmin
    ? projects
    : projects.filter((p) => String(p.chef_id) === String(user?.id));

  // Invalider l'aperçu dès qu'un filtre change (évite d'afficher/télécharger du périmé)
  const invalidate = () => { if (preview) setPreview(null); if (projPreview) setProjPreview(null); };
  const changePeriod    = (v) => { setPeriod(v);    invalidate(); };
  const changeDateFrom  = (v) => { setDateFrom(v);  invalidate(); };
  const changeDateTo    = (v) => { setDateTo(v);    invalidate(); };
  const changeScope     = (v) => { setScope(v);     invalidate(); };
  const changeMemberId  = (v) => { setMemberId(v);  invalidate(); };
  const changeProjectId = (v) => { setProjectId(v); invalidate(); };

  const loadReport = async () => {
    if (scope === "member" && !memberId) {
      setError("Veuillez choisir un membre avant de générer le rapport."); return;
    }
    if (scope === "project" && !projectId) {
      setError("Veuillez choisir un projet avant de générer le rapport."); return;
    }
    if (period === "custom" && (!dateFrom || !dateTo)) {
      setError("Veuillez renseigner les deux dates de la plage personnalisée."); return;
    }
    setLoading(true); setError(null);
    try {
      const params = { period };
      if (period === "custom") { params.date_from = dateFrom; params.date_to = dateTo; }
      if (scope === "project") {
        params.project_id = projectId;
        setProjPreview(await api.getProjectReport(params));
      } else {
        if (scope === "member" && memberId) params.member_id = memberId;
        setPreview(await api.getReportData(params));
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const memberNameForFile = () =>
    scope === "member" ? members.find((m) => String(m.id) === String(memberId))?.name : null;

  const btn = (active) => ({
    padding: "6px 12px", borderRadius: 8, fontSize: 12,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: active ? "var(--accent-bg)" : "transparent",
    color: active ? "var(--accent)" : "var(--text-2)",
    cursor: "pointer", fontWeight: active ? 700 : 400,
    display: "flex", alignItems: "center", gap: 5,
  });

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
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 8, letterSpacing: ".08em" }}>PÉRIODE</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PERIODS.map((p) => (
                <button key={p.value} onClick={() => changePeriod(p.value)} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12,
                  border: `1px solid ${period === p.value ? "var(--accent)" : "var(--border)"}`,
                  background: period === p.value ? "var(--accent-bg)" : "transparent",
                  color: period === p.value ? "var(--accent)" : "var(--text-2)",
                  cursor: "pointer", fontWeight: period === p.value ? 700 : 400,
                }}>{p.label}</button>
              ))}
            </div>
            {period === "custom" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                <input type="date" value={dateFrom} onChange={(e) => changeDateFrom(e.target.value)}
                  style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }} />
                <span style={{ color: "var(--text-3)", fontSize: 12 }}>→</span>
                <input type="date" value={dateTo} onChange={(e) => changeDateTo(e.target.value)}
                  style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }} />
              </div>
            )}
          </div>

          {/* Périmètre */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 8, letterSpacing: ".08em" }}>PÉRIMÈTRE</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <button onClick={() => changeScope("team")} style={btn(scope === "team")}>
                <Users size={13} /> Équipe entière
              </button>
              <button onClick={() => changeScope("member")} style={btn(scope === "member")}>
                <User size={13} /> Membre individuel
              </button>
              {canProjectReport && (
                <button onClick={() => changeScope("project")} style={btn(scope === "project")}>
                  <FolderOpen size={13} /> Par projet
                </button>
              )}
            </div>
            {scope === "member" && (
              <select value={memberId} onChange={(e) => changeMemberId(e.target.value)}
                style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", width: "100%" }}>
                <option value="">— Choisir un membre —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            {scope === "project" && (
              <select value={projectId} onChange={(e) => changeProjectId(e.target.value)}
                style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", width: "100%" }}>
                <option value="">— Choisir un projet —</option>
                {availableProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={loadReport} disabled={loading} style={{
            background: "var(--accent)", color: "white", border: "none",
            borderRadius: 10, padding: "10px 20px", cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6, opacity: loading ? 0.7 : 1,
          }}>
            <FileText size={14} /> {loading ? "Chargement…" : "Générer l'aperçu"}
          </button>
          {(preview || projPreview) && (
            <>
              <button onClick={() => projPreview ? generateProjectTXT(projPreview) : generateTXT(preview, memberNameForFile())} style={{
                background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a",
                borderRadius: 10, padding: "10px 20px", cursor: "pointer",
                fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6,
              }}>
                <Download size={14} /> Télécharger .txt
              </button>
              <button onClick={() => projPreview ? generateProjectPDF(projPreview) : generatePDF(preview, memberNameForFile())} style={{
                background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb",
                borderRadius: 10, padding: "10px 20px", cursor: "pointer",
                fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6,
              }}>
                <FileDown size={14} /> Télécharger .pdf
              </button>
            </>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#ef4444" }}>
            {error}
          </div>
        )}
      </div>

      {/* Invite */}
      {!preview && !projPreview && !loading && (
        <div style={{ background: "var(--bg-card)", border: "1px dashed var(--border)", borderRadius: 16, padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          Choisissez vos filtres puis cliquez sur « Générer l'aperçu ».
        </div>
      )}

      {/* Aperçu — rapport par projet */}
      {projPreview && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{projPreview.project.name}</h3>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>
            {projPreview.project.chef_name ? `Chef : ${projPreview.project.chef_name} · ` : ""}
            {projPreview.date_from && projPreview.date_to ? `${formatDate(projPreview.date_from)} → ${formatDate(projPreview.date_to)}` : ""}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Tâches",    val: projPreview.summary.total_tasks,       color: "var(--text)" },
              { label: "Terminées", val: projPreview.summary.total_done,        color: "#22c55e" },
              { label: "En cours",  val: projPreview.summary.total_in_progress, color: "#3b82f6" },
              { label: "Bloquées",  val: projPreview.summary.total_blocked,     color: "#ef4444" },
              { label: "En retard", val: projPreview.summary.total_overdue,     color: "#f59e0b" },
              { label: "Coupons",   val: projPreview.summary.total_coupons,     color: "var(--accent)" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: "var(--bg)", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          {projPreview.members.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>Membres sur le projet</div>
              {projPreview.members.map((m) => (
                <div key={m.name} style={{ fontSize: 12, color: "var(--text)", padding: "4px 0" }}>
                  {m.name} — {m.total} tâche{m.total > 1 ? "s" : ""}, {m.done} terminée{m.done > 1 ? "s" : ""}, {m.coupons} coupon{m.coupons > 1 ? "s" : ""}
                </div>
              ))}
            </div>
          )}
          {projPreview.difficulties.length > 0 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                ⚠️ {projPreview.difficulties.length} tâche{projPreview.difficulties.length > 1 ? "s" : ""} avec difficultés
              </div>
              {projPreview.difficulties.map((d) => (
                <div key={d.task_id} style={{ fontSize: 11, color: "#78350f", marginBottom: 4 }}>
                  [{d.task_id}] {d.task_description} — {d.items.length} signalement{d.items.length > 1 ? "s" : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aperçu — rapport par membre */}
      {preview && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
            {preview.date_from && preview.date_to
              ? `Aperçu — ${formatDate(preview.date_from)} → ${formatDate(preview.date_to)}`
              : "Aperçu"}
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
                      [{d.task_id}] {d.task_description} — {d.project_name || "—"} — {d.items.length} signalement{d.items.length > 1 ? "s" : ""}
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