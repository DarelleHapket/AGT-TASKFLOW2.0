"use client";

// Module 3 — Recrutement (BF-46 à BF-49). Une candidature passée à "retenue"
// déclenche côté serveur la création automatique du compte + profil + employé
// + contrat (rh/services.py::embaucher) — le frontend se contente d'afficher
// le résultat après coup (load()).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { Candidat, OffreEmploi, Poste, StatutCandidature } from "@/lib/types";

const STATUT_LABEL: Record<StatutCandidature, string> = {
  recue: "Reçue", entretien: "Entretien", retenue: "Retenue", refusee: "Refusée",
};
const STATUT_COLOR: Record<StatutCandidature, string> = {
  recue: "#64748b", entretien: "#3b82f6", retenue: "#22c55e", refusee: "#ef4444",
};
const inp: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" };

export default function RecrutementPage() {
  const { isLogged } = useAuth();
  const router = useRouter();
  const [offres, setOffres] = useState<OffreEmploi[]>([]);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [postes, setPostes] = useState<Poste[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingOffre, setAddingOffre] = useState(false);
  const [offrePoste, setOffrePoste] = useState("");
  const [addingCandidat, setAddingCandidat] = useState<number | null>(null);
  const [candNom, setCandNom] = useState("");
  const [candContact, setCandContact] = useState("");
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getOffres(), api.getCandidats(), api.getPostes()])
      .then(([o, c, p]) => { setOffres(o); setCandidats(c); setPostes(p); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger le recrutement")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function changerStatut(candidat: Candidat, statut: StatutCandidature) {
    setActionErr(null);
    try {
      await api.updateCandidatStatut(candidat.id, { offre: candidat.offre, nom: candidat.nom, contact: candidat.contact, statut });
      load();
    } catch (e) {
      setActionErr(api.errorMessage(e, "Erreur"));
    }
  }

  return (
    <AppShell>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Recrutement</h2>
      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Offres d&apos;emploi et candidatures — une candidature retenue crée l&apos;employé automatiquement</p>

      {error && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      {actionErr && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{actionErr}</p>}

      {loading ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p> : (
        <div style={{ maxWidth: 760 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "10px 14px", background: "var(--bg-hover)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>OFFRES D&apos;EMPLOI ({offres.length})</span>
              <button onClick={() => setAddingOffre((v) => !v)} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Plus size={12} /> Offre
              </button>
            </div>
            {addingOffre && (
              <div style={{ padding: 12, display: "flex", gap: 8, borderBottom: "1px solid var(--border)" }}>
                <select style={{ ...inp, flex: 1 }} value={offrePoste} onChange={(e) => setOffrePoste(e.target.value)}>
                  <option value="">Choisir un poste</option>
                  {postes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
                <button onClick={async () => { if (!offrePoste) return; await api.createOffre({ poste: Number(offrePoste) }); setOffrePoste(""); setAddingOffre(false); load(); }}
                  style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}>Créer</button>
              </div>
            )}
            {offres.map((o) => (
              <div key={o.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{o.poste_nom}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{o.statut}</span>
              </div>
            ))}
            {offres.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>Aucune offre.</div>}
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "var(--bg-hover)", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>
              CANDIDATS ({candidats.length})
            </div>
            {candidats.map((c) => (
              <div key={c.id} style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.nom}</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>{c.contact}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: STATUT_COLOR[c.statut] + "18", color: STATUT_COLOR[c.statut] }}>
                    {STATUT_LABEL[c.statut]}
                  </span>
                </div>
                {c.statut !== "retenue" && c.statut !== "refusee" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {c.statut === "recue" && (
                      <button onClick={() => changerStatut(c, "entretien")} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}>Passer en entretien</button>
                    )}
                    <button onClick={() => changerStatut(c, "retenue")} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", cursor: "pointer" }}>Retenir</button>
                    <button onClick={() => changerStatut(c, "refusee")} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", color: "#ef4444", cursor: "pointer" }}>Refuser</button>
                  </div>
                )}
              </div>
            ))}
            {candidats.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>Aucun candidat.</div>}
            {offres.length > 0 && (
              <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
                {addingCandidat === null ? (
                  <button onClick={() => setAddingCandidat(offres[0].id)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px dashed var(--border-2, #cbd5e1)", background: "transparent", color: "var(--text-3)", cursor: "pointer", width: "100%" }}>
                    <Plus size={12} style={{ verticalAlign: "middle", marginRight: 4 }} /> Ajouter un candidat
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select style={inp} value={addingCandidat} onChange={(e) => setAddingCandidat(Number(e.target.value))}>
                      {offres.map((o) => <option key={o.id} value={o.id}>{o.poste_nom}</option>)}
                    </select>
                    <input style={inp} placeholder="Nom" value={candNom} onChange={(e) => setCandNom(e.target.value)} />
                    <input style={inp} placeholder="Email / contact" value={candContact} onChange={(e) => setCandContact(e.target.value)} />
                    <button onClick={async () => {
                      if (!candNom.trim() || !candContact.trim() || !addingCandidat) return;
                      await api.createCandidat({ offre: addingCandidat, nom: candNom.trim(), contact: candContact.trim() });
                      setCandNom(""); setCandContact(""); setAddingCandidat(null); load();
                    }} style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}>Ajouter</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
