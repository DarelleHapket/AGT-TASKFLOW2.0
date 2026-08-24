"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Module 4 — Journal des mouvements financiers (BF-25). Immuable après
// création (BNF-10) — pas de bouton modifier/supprimer, une correction se
// fait par un nouveau mouvement inverse.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowDownCircle, ArrowUpCircle, Pencil, X } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { EmployeListe, MouvementFinancier, NiveauFinancier, Projet, TypeMouvementFinancier } from "@/lib/types";

const inp: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" };

export default function FinancesPage() {
  const { isLogged, hasPermission } = useAuth();
  const canWrite = hasPermission("finances.mouvements.gerer");
  const router = useRouter();
  const [mouvements, setMouvements] = useState<MouvementFinancier[]>([]);
  const [types, setTypes] = useState<TypeMouvementFinancier[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [employes, setEmployes] = useState<EmployeListe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("");
  const [montant, setMontant] = useState("");
  const [niveau, setNiveau] = useState<NiveauFinancier>("entreprise");
  const [projet, setProjet] = useState("");
  const [employe, setEmploye] = useState("");
  const [newTypeNom, setNewTypeNom] = useState("");
  const [newTypeSens, setNewTypeSens] = useState<"entree" | "sortie">("sortie");
  const [addingType, setAddingType] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [showTypes, setShowTypes] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editTypeNom, setEditTypeNom] = useState("");
  const [editTypeSens, setEditTypeSens] = useState<"entree" | "sortie">("sortie");
  const [typeErr, setTypeErr] = useState<string | null>(null);
  const [filtreType, setFiltreType] = useState("");

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getMouvements(), api.getTypesMouvement(), api.getProjets(), api.getEmployes()])
      .then(([m, t, p, e]) => { setMouvements(m); setTypes(t); setProjets(p); setEmployes(e); })
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
        employe: niveau === "employe" ? Number(employe) : undefined,
      });
      setAdding(false); setType(""); setMontant(""); setNiveau("entreprise"); setProjet(""); setEmploye("");
      load();
    } catch (e) {
      setFormErr(api.errorMessage(e, "Création impossible"));
    }
  }

  const mouvementsParType = (typeId: number) => mouvements.filter((m) => m.type_mouvement === typeId).length;

  function commencerEdition(t: TypeMouvementFinancier) {
    setEditingTypeId(t.id); setEditTypeNom(t.nom); setEditTypeSens(t.sens); setTypeErr(null);
  }

  async function enregistrerEdition() {
    if (editingTypeId === null || !editTypeNom.trim()) return;
    setTypeErr(null);
    try {
      await api.updateTypeMouvement(editingTypeId, { nom: editTypeNom.trim(), sens: editTypeSens });
      setEditingTypeId(null);
      load();
    } catch (e) {
      setTypeErr(api.errorMessage(e, "Modification impossible"));
    }
  }

  async function supprimerType(t: TypeMouvementFinancier) {
    setTypeErr(null);
    try {
      await api.deleteTypeMouvement(t.id);
      load();
    } catch (e) {
      setTypeErr(api.errorMessage(e, `Impossible de supprimer « ${t.nom} »`));
    }
  }

  const mouvementsAffiches = filtreType ? mouvements.filter((m) => m.type_mouvement === Number(filtreType)) : mouvements;

  return (
    <AppShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Finances</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowTypes((v) => !v)} style={{ background: "transparent", color: "var(--text-2)", border: "1px solid var(--border)", padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
            {showTypes ? "Masquer les types" : "Types de mouvement"}
          </button>
          <button onClick={() => setAdding((v) => !v)} style={{ background: "var(--accent)", color: "white", border: "none", padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Mouvement
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Journal des mouvements, réservé à la gestion financière, immuable une fois enregistré</p>

      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}

      {showTypes && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden", marginBottom: 16, maxWidth: 620 }}>
          <div style={{ padding: "10px 14px", background: "var(--bg-hover)", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em" }}>
            TYPES DE MOUVEMENT ({types.length})
          </div>
          {typeErr && <div style={{ padding: "8px 14px", fontSize: 11, color: "var(--danger)" }}>{typeErr}</div>}
          {types.map((t) => {
            const nbMouvements = mouvementsParType(t.id);
            const enEdition = editingTypeId === t.id;
            return (
              <div key={t.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                {enEdition ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input style={{ ...inp, flex: 1 }} value={editTypeNom} onChange={(e) => setEditTypeNom(e.target.value)} />
                    <select style={inp} value={editTypeSens} onChange={(e) => setEditTypeSens(e.target.value as "entree" | "sortie")}>
                      <option value="entree">Entrée</option>
                      <option value="sortie">Sortie</option>
                    </select>
                    <button onClick={enregistrerEdition} style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}>Enregistrer</button>
                    <button onClick={() => setEditingTypeId(null)} style={{ ...inp, cursor: "pointer" }}>Annuler</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t.nom}</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>
                        {t.sens === "entree" ? "Entrée" : "Sortie"} · {nbMouvements} mouvement{nbMouvements !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {canWrite && (
                      <>
                        <button onClick={() => commencerEdition(t)} title="Modifier" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}><Pencil size={14} /></button>
                        <button
                          onClick={() => supprimerType(t)}
                          disabled={nbMouvements > 0}
                          title={nbMouvements > 0 ? `Utilisé par ${nbMouvements} mouvement(s), suppression impossible` : "Supprimer"}
                          style={{ background: "none", border: "none", cursor: nbMouvements > 0 ? "not-allowed" : "pointer", color: nbMouvements > 0 ? "var(--border)" : "var(--danger)" }}
                        ><X size={14} /></button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {types.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>Aucun type de mouvement créé.</div>}
        </div>
      )}

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
              <option value="employe">Employé</option>
            </select>
            {niveau === "projet" && (
              <select style={inp} value={projet} onChange={(e) => setProjet(e.target.value)}>
                <option value="">Choisir un projet</option>
                {projets.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            )}
            {niveau === "employe" && (
              <select style={inp} value={employe} onChange={(e) => setEmploye(e.target.value)}>
                <option value="">Choisir un employé</option>
                {employes.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
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

      {!loading && (
        <div style={{ marginBottom: 12, maxWidth: 760 }}>
          <select style={inp} value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
            <option value="">Tous les types</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
          </select>
        </div>
      )}

      {loading ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p> : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden", maxWidth: 760 }}>
          {mouvementsAffiches.map((m) => (
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
          {mouvementsAffiches.length === 0 && <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>{filtreType ? "Aucun mouvement pour ce type." : "Aucun mouvement enregistré."}</div>}
        </div>
      )}
    </AppShell>
  );
}
