"use client";

// Module 4 — Prévisions financières (BF-28). Miroir de /finances (journal) :
// liste + formulaire d'ajout, avec en plus un bouton "écart" par ligne qui
// compare le prévu au réel via GET /finances/previsions/<id>/ecart.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Scale } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { EcartPrevision, NiveauFinancier, Prevision, Projet } from "@/lib/types";

const inp: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" };

export default function PrevisionsPage() {
  const { isLogged } = useAuth();
  const router = useRouter();
  const [previsions, setPrevisions] = useState<Prevision[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [periodeDebut, setPeriodeDebut] = useState("");
  const [periodeFin, setPeriodeFin] = useState("");
  const [montant, setMontant] = useState("");
  const [niveau, setNiveau] = useState<NiveauFinancier>("entreprise");
  const [projet, setProjet] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [ecarts, setEcarts] = useState<Record<number, EcartPrevision | "loading" | "error">>({});

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getPrevisions(), api.getProjets()])
      .then(([p, pr]) => { setPrevisions(p); setProjets(pr); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les prévisions")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function ajouter() {
    setFormErr(null);
    if (!periodeDebut || !periodeFin || !montant) {
      setFormErr("Période de début, période de fin et montant sont obligatoires.");
      return;
    }
    try {
      await api.createPrevision({
        periode_debut: periodeDebut, periode_fin: periodeFin, montant_prevu: montant, niveau,
        projet: niveau === "projet" ? Number(projet) : undefined,
      });
      setAdding(false); setPeriodeDebut(""); setPeriodeFin(""); setMontant(""); setNiveau("entreprise"); setProjet("");
      load();
    } catch (e) {
      setFormErr(api.errorMessage(e, "Création impossible"));
    }
  }

  async function voirEcart(id: number) {
    setEcarts((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const e = await api.getEcartPrevision(id);
      setEcarts((prev) => ({ ...prev, [id]: e }));
    } catch {
      setEcarts((prev) => ({ ...prev, [id]: "error" }));
    }
  }

  return (
    <AppShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Prévisions</h2>
        <button onClick={() => setAdding((v) => !v)} style={{ background: "var(--accent)", color: "white", border: "none", padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Prévision
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Montants prévus par période — comparez au réel avec &quot;Écart&quot;</p>

      {error && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>}

      {adding && (
        <div style={{ background: "var(--accent-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, marginBottom: 16, maxWidth: 620 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <input style={inp} type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} />
            <input style={inp} type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} />
            <input style={inp} type="number" placeholder="Montant prévu" value={montant} onChange={(e) => setMontant(e.target.value)} />
            <select style={inp} value={niveau} onChange={(e) => setNiveau(e.target.value as NiveauFinancier)}>
              <option value="entreprise">Entreprise</option>
              <option value="projet">Projet</option>
            </select>
            {niveau === "projet" && (
              <select style={inp} value={projet} onChange={(e) => setProjet(e.target.value)}>
                <option value="">Choisir un projet</option>
                {projets.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            )}
          </div>
          {formErr && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 8 }}>{formErr}</div>}
          <button onClick={ajouter} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Enregistrer</button>
        </div>
      )}

      {loading ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p> : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden", maxWidth: 760 }}>
          {previsions.map((p) => {
            const ecart = ecarts[p.id];
            return (
              <div key={p.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {new Date(p.periode_debut).toLocaleDateString("fr-FR")} → {new Date(p.periode_fin).toLocaleDateString("fr-FR")}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>
                      {p.niveau === "projet" ? p.projet_nom : p.niveau === "employe" ? p.employe_nom : "Entreprise"}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{p.montant_prevu}</span>
                  <button onClick={() => voirEcart(p.id)} style={{ ...inp, background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <Scale size={12} /> Écart
                  </button>
                </div>
                {ecart === "loading" && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>Calcul…</div>}
                {ecart === "error" && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>Impossible de calculer l&apos;écart.</div>}
                {ecart && ecart !== "loading" && ecart !== "error" && (
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
                    Prévu : <strong style={{ color: "var(--text)" }}>{ecart.prevu}</strong> — Réel : <strong style={{ color: "var(--text)" }}>{ecart.reel}</strong> — Écart :{" "}
                    <strong style={{ color: Number(ecart.ecart) < 0 ? "#ef4444" : "#16a34a" }}>{ecart.ecart}</strong>
                  </div>
                )}
              </div>
            );
          })}
          {previsions.length === 0 && <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>Aucune prévision enregistrée.</div>}
        </div>
      )}
    </AppShell>
  );
}
