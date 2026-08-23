"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Module 4 — Bilan sur une période (BF-27) + prévisions (BF-28). Le bilan est
// calculé à la volée côté serveur, jamais stocké (Document d'Analyse §11).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import { FileDown } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { Bilan } from "@/lib/types";

const inp: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" };

function moisCourant() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

function genererTXT(bilan: Bilan, dateFrom: string, dateTo: string) {
  const lines = [
    "Bilan financier — AGT Technologies",
    `Période : ${dateFrom} -> ${dateTo}`,
    "─".repeat(40),
    `Entrées : ${bilan.entrees}`,
    `Sorties : ${bilan.sorties}`,
    `Solde   : ${bilan.solde}`,
    "",
    "Vise la conformité OHADA — à faire vérifier par un expert-comptable avant tout usage officiel.",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `bilan_${dateFrom}_${dateTo}.txt`; a.click();
  URL.revokeObjectURL(url);
}

function genererPDF(bilan: Bilan, dateFrom: string, dateTo: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(40, 40, 90);
  doc.text("Bilan financier — AGT Technologies", margin, y); y += 24;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
  doc.text(`Période : ${dateFrom} -> ${dateTo}`, margin, y); y += 24;
  doc.setDrawColor(200); doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y); y += 20;

  const rows: [string, string, [number, number, number]][] = [
    ["Entrées", bilan.entrees, [22, 120, 60]],
    ["Sorties", bilan.sorties, [200, 40, 40]],
    ["Solde", bilan.solde, [40, 40, 90]],
  ];
  rows.forEach(([label, valeur, color]) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 20, 20);
    doc.text(label, margin, y);
    doc.setTextColor(...color);
    doc.text(String(valeur), margin + 120, y);
    y += 20;
  });
  y += 10;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  doc.text("Vise la conformité OHADA — à faire vérifier par un expert-comptable avant tout usage officiel.", margin, y);
  doc.save(`bilan_${dateFrom}_${dateTo}.pdf`);
}

export default function BilanPage() {
  const { isLogged, hasPermission } = useAuth();
  const router = useRouter();
  const defaut = moisCourant();
  const [dateFrom, setDateFrom] = useState(defaut.from);
  const [dateTo, setDateTo] = useState(defaut.to);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const canTelecharger = hasPermission("finances.rapports.telecharger");

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  function charger() {
    setLoading(true); setError(null);
    api.getBilan({ date_from: dateFrom, date_to: dateTo })
      .then(setBilan)
      .catch((e) => setError(api.errorMessage(e, "Impossible de calculer le bilan")))
      .finally(() => setLoading(false));
  }
  useEffect(charger, []); // eslint-disable-line react-hooks/exhaustive-deps

  const solde = bilan ? Number(bilan.solde) : 0;

  async function genererRapport(format: "pdf" | "txt") {
    if (!bilan) return;
    setGenerating(true); setError(null);
    try {
      await api.creerRapportFinancier({ format, periode_debut: dateFrom, periode_fin: dateTo });
      if (format === "txt") genererTXT(bilan, dateFrom, dateTo);
      else genererPDF(bilan, dateFrom, dateTo);
    } catch (e) {
      setError(api.errorMessage(e, "Génération du rapport impossible"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppShell>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Bilan</h2>
      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Bilan sur une période — vise la conformité OHADA, à faire vérifier par un expert avant tout usage officiel</p>

      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
        <input style={inp} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span style={{ color: "var(--text-3)", fontSize: 12 }}>→</span>
        <input style={inp} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button onClick={charger} style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer", fontWeight: 700 }}>Calculer</button>
      </div>

      {loading ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Calcul…</p> : bilan && (
        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 14, maxWidth: 560 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, marginBottom: 6 }}>ENTRÉES</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>{bilan.entrees}</div>
          </div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, marginBottom: 6 }}>SORTIES</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>{bilan.sorties}</div>
          </div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, marginBottom: 6 }}>SOLDE</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: solde >= 0 ? "var(--accent)" : "#ef4444" }}>{bilan.solde}</div>
          </div>
        </div>
      )}

      {bilan && canTelecharger && (
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={() => genererRapport("pdf")} disabled={generating} style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: generating ? "not-allowed" : "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <FileDown size={13} /> Rapport PDF
          </button>
          <button onClick={() => genererRapport("txt")} disabled={generating} style={{ ...inp, cursor: generating ? "not-allowed" : "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <FileDown size={13} /> Rapport TXT
          </button>
        </div>
      )}
    </AppShell>
  );
}
