"use client";

// Module 3 — Profils & RH. Référentiel (compétences/postes/équipes) +
// création d'employé (UC "Créer un employé et son contrat"). Styles inline
// alignés sur le reste de l'app (var(--bg-card) etc.).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { Competence, Equipe, Poste, TypeContrat, Utilisateur } from "@/lib/types";

const inp: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" };
const card: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden" };
const sectionHead: React.CSSProperties = { padding: "10px 14px", background: "var(--bg-hover)", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em" };

const TABS = [
  { id: "referentiel", label: "Référentiel" },
  { id: "employes", label: "Employés" },
];

export default function RhPage() {
  const { isLogged, hasPermission } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState("referentiel");
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [postes, setPostes] = useState<Poste[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [typesContrat, setTypesContrat] = useState<TypeContrat[]>([]);
  const [membres, setMembres] = useState<Utilisateur[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canWrite = hasPermission("rh.write");
  const canGererEmployes = hasPermission("rh.employes.gerer");

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getCompetences(), api.getPostes(), api.getEquipes(), api.getTypesContrat(), api.getMembres()])
      .then(([c, p, e, t, m]) => { setCompetences(c); setPostes(p); setEquipes(e); setTypesContrat(t); setMembres(m.filter((x) => x.statut === "ACTIF")); })
      .catch((err) => setError(api.errorMessage(err, "Impossible de charger le référentiel RH")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const [newComp, setNewComp] = useState("");
  const [newPoste, setNewPoste] = useState("");
  const [newEquipe, setNewEquipe] = useState("");
  const [newTypeContrat, setNewTypeContrat] = useState("");

  const [creating, setCreating] = useState(false);
  const [empMembre, setEmpMembre] = useState("");
  const [empType, setEmpType] = useState("");
  const [empMontant, setEmpMontant] = useState("");
  const [empDate, setEmpDate] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);

  async function creerEmploye() {
    setCreateErr(null);
    if (!empMembre || !empType || !empMontant || !empDate) return;
    try {
      const profil = await api.getProfilParUtilisateur(Number(empMembre));
      await api.creerEmploye({ profil: profil.id, type_contrat: Number(empType), date_embauche: empDate, montant: empMontant });
      setCreating(false); setEmpMembre(""); setEmpType(""); setEmpMontant(""); setEmpDate("");
      load();
    } catch (e) {
      setCreateErr(api.errorMessage(e, "Création impossible"));
    }
  }

  return (
    <AppShell>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>RH & Profils</h2>
      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Référentiel, employés, contrats et rémunérations</p>

      {error && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
            border: `1px solid ${tab === t.id ? "var(--accent)" : "var(--border)"}`,
            background: tab === t.id ? "var(--accent-bg)" : "transparent",
            color: tab === t.id ? "var(--accent)" : "var(--text-2)", cursor: "pointer",
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p> : tab === "referentiel" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          <div style={card}>
            <div style={sectionHead}>COMPÉTENCES ({competences.length})</div>
            <div style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {competences.map((c) => (
                <span key={c.id} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "var(--accent-bg)", color: "var(--accent)" }}>{c.nom}</span>
              ))}
            </div>
            {canWrite && (
              <div style={{ display: "flex", gap: 6, padding: "0 12px 12px" }}>
                <input style={{ ...inp, flex: 1 }} value={newComp} onChange={(e) => setNewComp(e.target.value)} placeholder="Nouvelle compétence" />
                <button onClick={async () => { if (!newComp.trim()) return; await api.createCompetence({ nom: newComp.trim() }); setNewComp(""); load(); }}
                  style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}><Plus size={13} /></button>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={sectionHead}>POSTES ({postes.length})</div>
            {postes.map((p) => (
              <div key={p.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{p.nom}</div>
            ))}
            {canWrite && (
              <div style={{ display: "flex", gap: 6, padding: 12 }}>
                <input style={{ ...inp, flex: 1 }} value={newPoste} onChange={(e) => setNewPoste(e.target.value)} placeholder="Nouveau poste" />
                <button onClick={async () => { if (!newPoste.trim()) return; await api.createPoste({ nom: newPoste.trim() }); setNewPoste(""); load(); }}
                  style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}><Plus size={13} /></button>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={sectionHead}>ÉQUIPES ({equipes.length})</div>
            {equipes.map((e) => (
              <div key={e.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{e.nom} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>({e.membres.length} membre{e.membres.length !== 1 ? "s" : ""})</span></div>
            ))}
            {canWrite && (
              <div style={{ display: "flex", gap: 6, padding: 12 }}>
                <input style={{ ...inp, flex: 1 }} value={newEquipe} onChange={(e) => setNewEquipe(e.target.value)} placeholder="Nouvelle équipe" />
                <button onClick={async () => { if (!newEquipe.trim()) return; await api.createEquipe({ nom: newEquipe.trim() }); setNewEquipe(""); load(); }}
                  style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}><Plus size={13} /></button>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={sectionHead}>TYPES DE CONTRAT ({typesContrat.length})</div>
            {typesContrat.map((t) => (
              <div key={t.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t.nom}</div>
            ))}
            {canWrite && (
              <div style={{ display: "flex", gap: 6, padding: 12 }}>
                <input style={{ ...inp, flex: 1 }} value={newTypeContrat} onChange={(e) => setNewTypeContrat(e.target.value)} placeholder="Ex: CDI, CDD, Stage" />
                <button onClick={async () => { if (!newTypeContrat.trim()) return; await api.createTypeContrat({ nom: newTypeContrat.trim() }); setNewTypeContrat(""); load(); }}
                  style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}><Plus size={13} /></button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 620 }}>
          {canGererEmployes && (
            <div style={{ marginBottom: 16 }}>
              {!creating ? (
                <button onClick={() => setCreating(true)} style={{ background: "var(--accent)", color: "white", border: "none", padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <Plus size={15} /> Créer un employé
                </button>
              ) : (
                <div style={card}>
                  <div style={sectionHead}>NOUVEL EMPLOYÉ</div>
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    <select style={inp} value={empMembre} onChange={(e) => setEmpMembre(e.target.value)}>
                      <option value="">Choisir un membre</option>
                      {membres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select style={inp} value={empType} onChange={(e) => setEmpType(e.target.value)}>
                      <option value="">Type de contrat</option>
                      {typesContrat.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                    </select>
                    <input style={inp} type="date" value={empDate} onChange={(e) => setEmpDate(e.target.value)} />
                    <input style={inp} type="number" placeholder="Montant du salaire" value={empMontant} onChange={(e) => setEmpMontant(e.target.value)} />
                    {createErr && <span style={{ fontSize: 11, color: "var(--danger)" }}>{createErr}</span>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={creerEmploye} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Créer</button>
                      <button onClick={() => setCreating(false)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 12, color: "var(--text-2)" }}>Annuler</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>
            Consultez le salaire d&apos;un employé depuis sa fiche membre, ou le vôtre depuis le menu profil.
          </p>
        </div>
      )}
    </AppShell>
  );
}
