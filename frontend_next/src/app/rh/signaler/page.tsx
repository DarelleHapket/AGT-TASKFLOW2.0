"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Module 3 — Signaler une difficulté (BF-53). Accessible à tout utilisateur
// connecté, pas seulement à ceux qui gèrent les signalements — c'est le canal
// de remontée lui-même, pas sa consultation (réservée à Admin, /rh/signalements).
// BNF-18 assoupli le 2026-08-18 : l'auteur voit et gère désormais son propre
// historique (repliable pour ne pas saturer l'écran) — les autres membres ne
// voient toujours rien, seuls Admin/Superadmin voient tout.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { Signalement, StatutSignalement } from "@/lib/types";

const STATUT_LABEL: Record<StatutSignalement, { label: string; color: string }> = {
  ouvert: { label: "Ouvert", color: "#f59e0b" },
  traite: { label: "Traité", color: "#22c55e" },
};

function StatutPill({ statut }: { statut: StatutSignalement }) {
  const s = STATUT_LABEL[statut];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: s.color + "18", color: s.color, border: `1px solid ${s.color}33`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

export default function SignalerPage() {
  const { isLogged } = useAuth();
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  function rechargerSignalements() {
    api.getSignalements().then(setSignalements).catch(() => setSignalements([]));
  }
  useEffect(() => { if (isLogged) rechargerSignalements(); }, [isLogged]);

  async function envoyer() {
    if (!description.trim()) return;
    setBusy(true); setError(null);
    try {
      await api.createSignalement(description.trim());
      setDescription("");
      setEnvoye(true);
      rechargerSignalements();
    } catch (e) {
      setError(api.errorMessage(e, "Envoi impossible"));
    } finally {
      setBusy(false);
    }
  }

  async function supprimer(id: number) {
    await api.supprimerSignalement(id).catch(() => {});
    rechargerSignalements();
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 480 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={20} /> Signaler une difficulté
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 20 }}>
          Décrivez une difficulté ou un différend rencontré. Seuls vous, Admin et Superadmin pouvez voir ce signalement. Vous recevrez une notification une fois qu&apos;il aura été traité.
        </p>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", padding: 20 }}>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez la situation…" rows={5}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, background: "var(--bg-input)", color: "var(--text)", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
          />
          {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)" }}>{error}</div>)}
          {envoye && <div style={{ marginTop: 10, fontSize: 12, color: "#16a34a" }}>Signalement envoyé.</div>}
          <button onClick={envoyer} disabled={busy || !description.trim()} style={{ marginTop: 14, background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", cursor: busy || !description.trim() ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, opacity: busy || !description.trim() ? 0.6 : 1 }}>
            {busy ? "Envoi…" : "Envoyer"}
          </button>
        </div>

        <div style={{ marginTop: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <button onClick={() => setHistoriqueOuvert((v) => !v)} style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            <span>Mes signalements ({signalements.length})</span>
            {historiqueOuvert ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {historiqueOuvert && (
            <div style={{ borderTop: "1px solid var(--border)", padding: "8px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {signalements.length === 0 && <p style={{ fontSize: 12, color: "var(--text-3)", margin: "8px 0 0" }}>Aucun signalement pour l&apos;instant.</p>}
              {signalements.map((s) => (
                <div key={s.id} style={{ fontSize: 12, color: "var(--text-2)", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "var(--text)" }}>{s.description}</div>
                    <div style={{ color: "var(--text-3)", marginTop: 2 }}>{new Date(s.cree_le).toLocaleDateString("fr-FR")}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <StatutPill statut={s.statut} />
                    <button onClick={() => supprimer(s.id)} title="Supprimer" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
