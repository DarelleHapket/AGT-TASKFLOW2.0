"use client";

// Port de SectionDatabase.jsx — adapté à la nouvelle API de sauvegarde
// Postgres (createBackup/listBackups) au lieu de l'export/import brut d'un
// fichier .db SQLite, puisque le format de stockage a changé. Structure et
// styles visuels conservés à l'identique.
import { useState } from "react";
import * as api from "@/lib/api";

export function SectionDatabase({ canExport, canImport }: { canExport: boolean; canImport: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canExport && !canImport) return null;

  const handleExport = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const r = await api.createBackup();
      setMessage(`Sauvegarde créée : ${r.created}`);
    } catch (e) {
      setError(api.errorMessage(e, "Échec de la sauvegarde"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18, marginBottom: 16, boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Base de données</div>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>Réservé au Superadmin</span>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {canExport && (
          <button onClick={handleExport} disabled={busy} style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 10, border: "none", background: "var(--accent)", color: "white", cursor: busy ? "not-allowed" : "pointer" }}>
            ⬇ Créer une sauvegarde
          </button>
        )}
        {canImport && (
          <a href="/admin" style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text-2)", background: "transparent", textDecoration: "none" }}>
            ⬆ Gérer les sauvegardes
          </a>
        )}
      </div>

      {message && <div style={{ marginTop: 10, fontSize: 12, color: "var(--success, #22c55e)" }}>{message}</div>}
      {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)" }}>{error}</div>}
    </div>
  );
}
