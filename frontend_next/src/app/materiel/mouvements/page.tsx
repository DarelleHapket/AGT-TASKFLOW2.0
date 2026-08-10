"use client";

// Module 2 — Journal des mouvements de matériel (BF-12/BF-13). Immuable
// après création (BNF-04) — pas de bouton modifier/supprimer, une
// correction se fait par un nouveau mouvement inverse.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowDownCircle, ArrowUpCircle, RotateCcw, Trash2 } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { Materiel, MouvementMateriel, Projet, SensMouvementMateriel, TypeMateriel } from "@/lib/types";

const inp: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" };

const SENS_ICON: Record<SensMouvementMateriel, { Icon: typeof ArrowUpCircle; color: string; label: string }> = {
  achat: { Icon: ArrowUpCircle, color: "#16a34a", label: "Achat" },
  affectation: { Icon: ArrowDownCircle, color: "#f59e0b", label: "Affectation" },
  retour: { Icon: RotateCcw, color: "#3b82f6", label: "Retour" },
  rebut: { Icon: Trash2, color: "#ef4444", label: "Rebut" },
};

export default function MouvementsMaterielPage() {
  const { isLogged, hasPermission } = useAuth();
  const router = useRouter();
  const [mouvements, setMouvements] = useState<MouvementMateriel[]>([]);
  const [inventaire, setInventaire] = useState<Materiel[]>([]);
  const [types, setTypes] = useState<TypeMateriel[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtreMateriel, setFiltreMateriel] = useState("");
  const [filtreType, setFiltreType] = useState("");

  const canWrite = hasPermission("materiel.write");

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getMouvementsMateriel(), api.getInventaire(), api.getTypesMateriel(), api.getProjets()])
      .then(([m, i, t, p]) => { setMouvements(m); setInventaire(i); setTypes(t); setProjets(p); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les mouvements")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const [adding, setAdding] = useState(false);
  const [materiel, setMateriel] = useState("");
  const [sens, setSens] = useState<SensMouvementMateriel>("achat");
  const [quantite, setQuantite] = useState("");
  const [cible, setCible] = useState(""); // projet, si affectation
  const [commentaire, setCommentaire] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);

  async function ajouter() {
    setFormErr(null);
    if (!materiel || !quantite) return;
    try {
      await api.createMouvementMateriel({
        materiel: Number(materiel), type_mouvement: sens, quantite: Number(quantite),
        projet: sens === "affectation" && cible ? Number(cible) : undefined,
        commentaire: commentaire || undefined,
      });
      setAdding(false); setMateriel(""); setQuantite(""); setCible(""); setCommentaire("");
      load();
    } catch (e) {
      setFormErr(api.errorMessage(e, "Enregistrement impossible"));
    }
  }

  const filtres = mouvements.filter((m) =>
    (!filtreMateriel || String(m.materiel) === filtreMateriel) &&
    (!filtreType || inventaire.find((i) => i.id === m.materiel)?.type === Number(filtreType)),
  );

  return (
    <AppShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Mouvements de matériel</h2>
        {canWrite && (
          <button onClick={() => setAdding((v) => !v)} style={{ background: "var(--accent)", color: "white", border: "none", padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Mouvement
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Journal daté — achat, affectation, retour, rebut — immuable une fois enregistré</p>

      {error && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>}

      {adding && (
        <div style={{ background: "var(--accent-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, marginBottom: 16, maxWidth: 660 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <select style={inp} value={materiel} onChange={(e) => setMateriel(e.target.value)}>
              <option value="">Matériel</option>
              {inventaire.map((m) => <option key={m.id} value={m.id}>{m.nom} ({m.quantite} en stock)</option>)}
            </select>
            <select style={inp} value={sens} onChange={(e) => setSens(e.target.value as SensMouvementMateriel)}>
              <option value="achat">Achat (entrée)</option>
              <option value="affectation">Affectation</option>
              <option value="retour">Retour</option>
              <option value="rebut">Rebut (sortie définitive)</option>
            </select>
            <input style={inp} type="number" min={1} placeholder="Quantité" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
            {sens === "affectation" && (
              <select style={inp} value={cible} onChange={(e) => setCible(e.target.value)}>
                <option value="">Projet (optionnel)</option>
                {projets.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            )}
          </div>
          <input style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 10 }} placeholder="Commentaire (optionnel)" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          {formErr && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 8 }}>{formErr}</div>}
          <button onClick={ajouter} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Enregistrer</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select style={inp} value={filtreMateriel} onChange={(e) => setFiltreMateriel(e.target.value)}>
          <option value="">Tous les matériels</option>
          {inventaire.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <select style={inp} value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
          <option value="">Tous les types</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
        </select>
      </div>

      {loading ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p> : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden", maxWidth: 800 }}>
          {filtres.map((m) => {
            const { Icon, color, label } = SENS_ICON[m.type_mouvement];
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                <Icon size={16} color={color} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{m.materiel_nom}</span>
                  <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>
                    {label}{m.projet_nom ? ` → ${m.projet_nom}` : ""}{m.employe_nom ? ` → ${m.employe_nom}` : ""}
                  </span>
                  {m.commentaire && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{m.commentaire}</div>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color }}>
                  {m.type_mouvement === "achat" ? "+" : m.type_mouvement === "rebut" ? "-" : ""}{m.quantite}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-3)", width: 90, textAlign: "right" }}>{new Date(m.date_mouvement).toLocaleDateString("fr-FR")}</span>
              </div>
            );
          })}
          {filtres.length === 0 && <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>Aucun mouvement enregistré.</div>}
        </div>
      )}
    </AppShell>
  );
}
