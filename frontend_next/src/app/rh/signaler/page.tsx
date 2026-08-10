"use client";

// Module 3 — Signaler une difficulté (BF-53). Accessible à tout utilisateur
// connecté, pas seulement à ceux qui gèrent les signalements — c'est le canal
// de remontée lui-même, pas sa consultation (réservée à Admin, /rh/signalements).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";

export default function SignalerPage() {
  const { isLogged } = useAuth();
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  async function envoyer() {
    if (!description.trim()) return;
    setBusy(true); setError(null);
    try {
      await api.createSignalement(description.trim());
      setDescription("");
      setEnvoye(true);
    } catch (e) {
      setError(api.errorMessage(e, "Envoi impossible"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 480 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={20} /> Signaler une difficulté
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 20 }}>
          Décrivez une difficulté ou un différend rencontré. Seuls Admin et Superadmin peuvent voir ce signalement.
        </p>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", padding: 20 }}>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez la situation…" rows={5}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, background: "var(--bg-input)", color: "var(--text)", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
          />
          {error && <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)" }}>{error}</div>}
          {envoye && <div style={{ marginTop: 10, fontSize: 12, color: "#16a34a" }}>Signalement envoyé.</div>}
          <button onClick={envoyer} disabled={busy || !description.trim()} style={{ marginTop: 14, background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", cursor: busy || !description.trim() ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, opacity: busy || !description.trim() ? 0.6 : 1 }}>
            {busy ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
