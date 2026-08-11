"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Module 4 — Journal des mouvements financiers (BF-25). Immuable après
// création (BNF-10) — pas de bouton modifier/supprimer, une correction se
// fait par un nouveau mouvement inverse.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { MouvementFinancier, NiveauFinancier, Projet, TypeMouvementFinancier } from "@/lib/types";

const inp: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" };

export default function FinancesPage() {
  const { isLogged } = useAuth();
  const router = useRouter();
  const [mouvements, setMouvements] = useState<MouvementFinancier[]>([]);
  const [types, setTypes] = useState<TypeMouvementFinancier[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("");
  const [montant, setMontant] = useState("");
  const [niveau, setNiveau] = useState<NiveauFinancier>("entreprise");
  const [projet, setProjet] = useState("");
  const [newTypeNom, setNewTypeNom] = useState("");
  const [newTypeSens, setNewTypeSens] = useState<"entree" | "sortie">("sortie");
  const [addingType, setAddingType] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getMouvements(), api.getTypesMouvement(), api.getProjets()])
      .then(([m, t, p]) => { setMouvements(m); setTypes(t); setProjets(p); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les finances")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function ajouter() {
    setFormErr(null);
    if (!type || !montant) return;
    try {
      await api.createMouvement({
        type_mouvement: Number(type), montant, niveau,
        projet: niveau === "projet" ? Number(projet) : undefined,
      });
      setAdding(false); setType(""); setMontant(""); setNiveau("entreprise"); setProjet("");
      load();
    } catch (e) {
      setFormErr(api.errorMessage(e, "Création impossible"));
    }
  }

  return (
    <AppShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Finances</h2>
        <button onClick={() => setAdding((v) => !v)} style={{ background: "var(--accent)", color: "white", border: "none", padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Mouvement
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Journal des mouvements — réservé Admin/Superadmin, immuable une fois enregistré</p>

      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}

      {adding && (
        <div style={{ background: "var(--accent-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, marginBottom: 16, maxWidth: 620 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <select style={inp} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Type de mouvement</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.nom} ({t.sens === "entree" ? "entrée" : "sortie"})</option>)}
            </select>
            <input style={inp} type="number" placeholder="Montant" value={montant} onChange={(e) => setMontant(e.target.value)} />
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

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            {!addingType ? (
              <button onClick={() => setAddingType(true)} style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>+ Nouveau type de mouvement</button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input style={inp} placeholder="Nom (ex: Vente, Loyer)" value={newTypeNom} onChange={(e) => setNewTypeNom(e.target.value)} />
                <select style={inp} value={newTypeSens} onChange={(e) => setNewTypeSens(e.target.value as "entree" | "sortie")}>
                  <option value="entree">Entrée</option>
                  <option value="sortie">Sortie</option>
                </select>
                <button onClick={async () => { if (!newTypeNom.trim()) return; await api.createTypeMouvement({ nom: newTypeNom.trim(), sens: newTypeSens }); setNewTypeNom(""); setAddingType(false); load(); }}
                  style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}>Créer</button>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p> : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden", maxWidth: 760 }}>
          {mouvements.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
              {m.sens === "entree" ? <ArrowUpCircle size={16} color="#16a34a" /> : <ArrowDownCircle size={16} color="#ef4444" />}
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{m.type_nom}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>
                  {m.niveau === "projet" ? m.projet_nom : m.niveau === "employe" ? m.employe_nom : "Entreprise"}
                </span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: m.sens === "entree" ? "#16a34a" : "#ef4444" }}>
                {m.sens === "entree" ? "+" : "-"}{m.montant}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-3)", width: 90, textAlign: "right" }}>{new Date(m.date_mouvement).toLocaleDateString("fr-FR")}</span>
            </div>
          ))}
          {mouvements.length === 0 && <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>Aucun mouvement enregistré.</div>}
        </div>
      )}
    </AppShell>
  );
}
