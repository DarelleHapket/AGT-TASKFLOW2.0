"use client";

// Module 3 — Signalements (BF-53, BNF-18). Réservé Admin/Superadmin côté
// backend (SignalementViewSet) — un membre peut créer un signalement mais ne
// peut jamais lister/consulter cette page (redirigé si non autorisé).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { Signalement } from "@/lib/types";

export default function SignalementsPage() {
  const { isLogged, hasPermission } = useAuth();
  const router = useRouter();
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const peutTraiter = hasPermission("rh.signalements.traiter");

  useEffect(() => {
    if (!isLogged) router.replace("/login");
    else if (!peutTraiter) router.replace("/dashboard");
  }, [isLogged, peutTraiter, router]);

  function load() {
    if (!peutTraiter) return;
    setLoading(true);
    api.getSignalements().then(setSignalements)
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les signalements")))
      .finally(() => setLoading(false));
  }
  useEffect(load, [peutTraiter]);

  if (!peutTraiter) return null;

  async function traiter(id: number) {
    await api.traiterSignalement(id);
    load();
  }

  const ouverts = signalements.filter((s) => s.statut === "ouvert");
  const traites = signalements.filter((s) => s.statut === "traite");

  return (
    <AppShell>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Signalements</h2>
      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Difficultés et différends remontés par l&apos;équipe — visible uniquement par Admin/Superadmin</p>

      {error && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>}

      {loading ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p> : (
        <div style={{ maxWidth: 680 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid #fed7aa", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "10px 14px", background: "#fff7ed", borderBottom: "1px solid #fed7aa", fontSize: 11, fontWeight: 700, color: "#ea580c", display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={12} /> OUVERTS ({ouverts.length})
            </div>
            {ouverts.map((s) => (
              <div key={s.id} style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{s.auteur_nom}</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{s.description}</div>
                    <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4 }}>{new Date(s.cree_le).toLocaleDateString("fr-FR")}</div>
                  </div>
                  <button onClick={() => traiter(s.id)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", cursor: "pointer", flexShrink: 0 }}>Marquer traité</button>
                </div>
              </div>
            ))}
            {ouverts.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>Aucun signalement ouvert.</div>}
          </div>

          {traites.length > 0 && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: "var(--bg-hover)", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>TRAITÉS ({traites.length})</div>
              {traites.map((s) => (
                <div key={s.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", opacity: 0.6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>{s.auteur_nom}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>{s.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
