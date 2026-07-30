// frontend/src/components/dashboard/SectionDatabase.jsx
//
// Export / import de la base SQLite, réservé aux permissions
// database.export / database.import. L'import déclenche une sauvegarde
// automatique côté serveur avant tout remplacement (voir routes/admin.py).

import { useState, useRef } from "react";
import * as api from "../../api/client";

export function SectionDatabase({ canExport, canImport }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!canExport && !canImport) return null;

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const filename = await api.exportDatabase();
      setMessage(`Export téléchargé : ${filename}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleImportChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      "Importer cette base remplacera toutes les données actuelles. " +
      "Une sauvegarde automatique de la base actuelle sera créée avant le remplacement. Continuer ?"
    );
    if (!confirmed) {
      e.target.value = "";
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.importDatabase(file);
      setMessage(
        result.backup_created
          ? `Base importée. Sauvegarde créée : ${result.backup_created}`
          : "Base importée avec succès."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: 18, marginBottom: 16,
      boxShadow: "var(--shadow)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Base de données</div>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>Réservé au Superadmin</span>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {canExport && (
          <button onClick={handleExport} disabled={busy} style={{
            fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 10,
            border: "none", background: "var(--accent)", color: "white",
            cursor: busy ? "not-allowed" : "pointer",
          }}>
            ⬇ Exporter la base
          </button>
        )}

        {canImport && (
          <label style={{
            fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 10,
            border: "1px solid var(--border)", color: "var(--text-2)",
            cursor: busy ? "not-allowed" : "pointer", background: "transparent",
          }}>
            ⬆ Importer une base
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              onChange={handleImportChange}
              disabled={busy}
              style={{ display: "none" }}
            />
          </label>
        )}
      </div>

      {message && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--success, #22c55e)" }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
