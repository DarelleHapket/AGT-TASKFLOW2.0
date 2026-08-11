"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Sauvegardes — fusion de frontend/src/components/dashboard/SectionDatabase.jsx
// (AGT, export seul) et team-tool/frontend/src/app/sauvegardes/page.tsx
// (téléchargement + import destructif avec confirmation "REMPLACER", D-05).
// Styles inline alignés sur le reste de l'app portée (var(--bg-card) etc.)
// plutôt que le Tailwind d'origine de team-tool, pour rester visuellement
// cohérent avec le reste de l'interface AGT.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, Upload, DatabaseBackup } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { Sauvegarde } from "@/lib/types";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default function AdminPage() {
  const { isLogged, hasPermission } = useAuth();
  const router = useRouter();
  const [backups, setBackups] = useState<Sauvegarde[]>([]);
  const [isPostgres, setIsPostgres] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canExport = hasPermission("database.export");
  const canImport = hasPermission("database.import");

  useEffect(() => {
    if (!isLogged) router.replace("/login");
    else if (!canExport) router.replace("/dashboard");
  }, [isLogged, canExport, router]);

  function load() {
    if (!canExport) return;
    setLoading(true);
    api.listBackups()
      .then((r) => { setBackups(r.backups); setIsPostgres(r.is_postgres); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les sauvegardes")))
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [canExport]);

  async function creer() {
    setCreating(true); setError(null); setMessage(null);
    try {
      const r = await api.createBackup();
      setMessage(`Sauvegarde créée : ${r.created}`);
      load();
    } catch (e) {
      setError(api.errorMessage(e, "Création impossible"));
    } finally {
      setCreating(false);
    }
  }

  async function supprimer(nom: string) {
    try {
      await api.deleteBackup(nom);
      load();
    } catch (e) {
      setError(api.errorMessage(e, "Suppression impossible"));
    }
  }

  async function telecharger(nom: string) {
    try {
      await api.downloadBackup(nom);
    } catch (e) {
      setError(api.errorMessage(e, "Téléchargement impossible"));
    }
  }

  async function importer() {
    const fichier = fileRef.current?.files?.[0];
    if (!fichier) return;
    setError(null); setMessage(null); setImporting(true);
    try {
      const r = await api.importBackup(fichier, confirmation);
      setMessage(r.message);
      setConfirmation("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) {
      setError(api.errorMessage(e, "Import refusé"));
    } finally {
      setImporting(false);
    }
  }

  if (!canExport) return null;

  const btnPrimary: React.CSSProperties = { fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
  const btnGhost: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 };
  const btnDanger: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 };

  return (
    <AppShell>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <DatabaseBackup size={20} /> Sauvegardes
        </h2>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          Base : {isPostgres ? "PostgreSQL (pg_dump)" : "SQLite (dev, placeholder, pas de dump réel)"}
        </span>
      </div>

      {error && (
        error.startsWith("Permission requise") ? (
          <AccessDenied code={error.replace("Permission requise : ", "")} />
        ) : (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#ef4444" }}>{error}</div>
        )
      )}
      {message && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, color: "#16a34a" }}>{message}</div>
      )}

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{backups.length} sauvegarde{backups.length !== 1 ? "s" : ""}</span>
          <button onClick={creer} disabled={creating} style={{ ...btnPrimary, opacity: creating ? 0.7 : 1, cursor: creating ? "not-allowed" : "pointer" }}>
            <DatabaseBackup size={13} /> {creating ? "Création…" : "Créer une sauvegarde"}
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Chargement…</div>
        ) : backups.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Aucune sauvegarde.</div>
        ) : (
          backups.map((b) => (
            <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{formatSize(b.size_bytes)} · {new Date(b.modified_at).toLocaleString("fr-FR")}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => telecharger(b.name)} style={btnGhost}><Download size={13} /></button>
                <button onClick={() => supprimer(b.name)} style={btnDanger}><Trash2 size={13} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {canImport && (
        <div style={{ background: "var(--bg-card)", border: "1px solid #fecaca", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Upload size={14} /> Importer une sauvegarde
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14 }}>
            Action destructive : remplace <strong>toute la base de données courante</strong> par le contenu du fichier importé. Irréversible.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input ref={fileRef} type="file" style={{ fontSize: 12 }} />
            <input
              type="text" value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
              placeholder='Tapez REMPLACER pour confirmer'
              style={{ fontSize: 12, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", minWidth: 220 }}
            />
            <button onClick={importer} disabled={importing || confirmation !== "REMPLACER"}
              style={{ ...btnDanger, padding: "8px 16px", opacity: (importing || confirmation !== "REMPLACER") ? 0.5 : 1, cursor: (importing || confirmation !== "REMPLACER") ? "not-allowed" : "pointer" }}>
              {importing ? "Import…" : "Remplacer la base"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
