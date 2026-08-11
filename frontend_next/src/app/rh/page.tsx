"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Module 3 — Profils & RH. Référentiel (compétences/postes/équipes) +
// création d'employé (UC "Créer un employé et son contrat"). Styles inline
// alignés sur le reste de l'app (var(--bg-card) etc.).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { Competence, Conge, Equipe, NoteFrais, Poste, StatutDemande, TypeContrat, Utilisateur } from "@/lib/types";

const inp: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" };
const card: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden" };
const sectionHead: React.CSSProperties = { padding: "10px 14px", background: "var(--bg-hover)", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em" };

const STATUT_DEMANDE_LABEL: Record<StatutDemande, { label: string; color: string }> = {
  en_attente: { label: "En attente", color: "#f59e0b" },
  validee: { label: "Validée", color: "#22c55e" },
  refusee: { label: "Refusée", color: "#ef4444" },
};

function StatutPill({ statut }: { statut: StatutDemande }) {
  const s = STATUT_DEMANDE_LABEL[statut];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: s.color + "18", color: s.color, border: `1px solid ${s.color}33`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

const TABS = [
  { id: "referentiel", label: "Référentiel" },
  { id: "employes", label: "Employés" },
  { id: "demandes", label: "Congés & notes de frais" },
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
  const canGererConges = hasPermission("rh.conges.gerer");
  const canGererFrais = hasPermission("rh.notes_frais.gerer");

  const [conges, setConges] = useState<Conge[]>([]);
  const [notesFrais, setNotesFrais] = useState<NoteFrais[]>([]);
  const [commentaires, setCommentaires] = useState<Record<string, string>>({});

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getCompetences(), api.getPostes(), api.getEquipes(), api.getTypesContrat(), api.getMembres()])
      .then(([c, p, e, t, m]) => { setCompetences(c); setPostes(p); setEquipes(e); setTypesContrat(t); setMembres(m.filter((x) => x.statut === "ACTIF")); })
      .catch((err) => setError(api.errorMessage(err, "Impossible de charger le référentiel RH")))
      .finally(() => setLoading(false));
    if (canGererConges) api.getConges().then(setConges).catch(() => setConges([]));
    if (canGererFrais) api.getNotesFrais().then(setNotesFrais).catch(() => setNotesFrais([]));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function traiterConge(id: number, statut: StatutDemande) {
    await api.traiterConge(id, statut, commentaires[`c${id}`] || "").catch(() => {});
    api.getConges().then(setConges).catch(() => {});
  }

  async function traiterNoteFrais(id: number, statut: StatutDemande) {
    await api.traiterNoteFrais(id, statut, commentaires[`n${id}`] || "").catch(() => {});
    api.getNotesFrais().then(setNotesFrais).catch(() => {});
  }

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
  const [empDejaEmploye, setEmpDejaEmploye] = useState(false);
  const [checkingEmp, setCheckingEmp] = useState(false);

  // Vérifie tout de suite si le membre choisi est déjà employé, plutôt que
  // de laisser l'utilisateur remplir tout le formulaire pour échouer à la
  // soumission avec une erreur 400 facile à manquer.
  useEffect(() => {
    if (!empMembre) { setEmpDejaEmploye(false); return; }
    setCheckingEmp(true);
    api.getProfilParUtilisateur(Number(empMembre))
      .then((p) => setEmpDejaEmploye(p.est_employe))
      .catch(() => setEmpDejaEmploye(false))
      .finally(() => setCheckingEmp(false));
  }, [empMembre]);

  async function creerEmploye() {
    setCreateErr(null);
    if (empDejaEmploye) return; // message déjà affiché au-dessus du champ membre
    if (!empMembre || !empType || !empMontant || !empDate) {
      setCreateErr("Membre, type de contrat, date d'embauche et montant sont obligatoires.");
      return;
    }
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

      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.filter((t) => t.id !== "demandes" || canGererConges || canGererFrais).map((t) => (
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
      ) : tab === "employes" ? (
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
                    {empMembre && empDejaEmploye && (
                      <span style={{ fontSize: 11, color: "var(--danger)" }}>
                        Ce membre est déjà employé — modifiez son contrat/salaire depuis sa fiche sur la page Membres plutôt que d&apos;en recréer un.
                      </span>
                    )}
                    <select style={inp} value={empType} onChange={(e) => setEmpType(e.target.value)}>
                      <option value="">Type de contrat</option>
                      {typesContrat.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                    </select>
                    <input style={inp} type="date" value={empDate} onChange={(e) => setEmpDate(e.target.value)} />
                    <input style={inp} type="number" placeholder="Montant du salaire" value={empMontant} onChange={(e) => setEmpMontant(e.target.value)} />
                    {createErr && <span style={{ fontSize: 11, color: "var(--danger)" }}>{createErr}</span>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={creerEmploye} disabled={empDejaEmploye || checkingEmp} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", cursor: empDejaEmploye ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12, opacity: empDejaEmploye ? 0.5 : 1 }}>Créer</button>
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
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {canGererConges && (
            <div style={card}>
              <div style={sectionHead}>CONGÉS ({conges.length})</div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {conges.map((c) => (
                  <div key={c.id} style={{ fontSize: 12, color: "var(--text-2)", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--text)" }}>{c.employe_nom}</div>
                        <div style={{ marginTop: 2 }}>{new Date(c.date_debut).toLocaleDateString("fr-FR")} → {new Date(c.date_fin).toLocaleDateString("fr-FR")}</div>
                        {c.motif && <div style={{ color: "var(--text-3)", marginTop: 2 }}>{c.motif}</div>}
                      </div>
                      <StatutPill statut={c.statut} />
                    </div>
                    {c.statut === "en_attente" && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                        <input style={{ ...inp, flex: 1, fontSize: 11 }} placeholder="Commentaire (optionnel)"
                          value={commentaires[`c${c.id}`] || ""} onChange={(e) => setCommentaires({ ...commentaires, [`c${c.id}`]: e.target.value })} />
                        <button onClick={() => traiterConge(c.id, "validee")} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "0 10px", cursor: "pointer", color: "#16a34a", fontSize: 11, fontWeight: 700 }}>Valider</button>
                        <button onClick={() => traiterConge(c.id, "refusee")} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "0 10px", cursor: "pointer", color: "#ef4444", fontSize: 11, fontWeight: 700 }}>Refuser</button>
                      </div>
                    )}
                  </div>
                ))}
                {conges.length === 0 && <p style={{ fontSize: 12, color: "var(--text-3)" }}>Aucune demande.</p>}
              </div>
            </div>
          )}

          {canGererFrais && (
            <div style={card}>
              <div style={sectionHead}>NOTES DE FRAIS ({notesFrais.length})</div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {notesFrais.map((n) => (
                  <div key={n.id} style={{ fontSize: 12, color: "var(--text-2)", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--text)" }}>{n.employe_nom}</div>
                        <div style={{ marginTop: 2 }}>{n.montant} — {n.motif}</div>
                        <div style={{ color: "var(--text-3)", marginTop: 2 }}>{new Date(n.date_depense).toLocaleDateString("fr-FR")}</div>
                      </div>
                      <StatutPill statut={n.statut} />
                    </div>
                    {n.statut === "en_attente" && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                        <input style={{ ...inp, flex: 1, fontSize: 11 }} placeholder="Commentaire (optionnel)"
                          value={commentaires[`n${n.id}`] || ""} onChange={(e) => setCommentaires({ ...commentaires, [`n${n.id}`]: e.target.value })} />
                        <button onClick={() => traiterNoteFrais(n.id, "validee")} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "0 10px", cursor: "pointer", color: "#16a34a", fontSize: 11, fontWeight: 700 }}>Valider</button>
                        <button onClick={() => traiterNoteFrais(n.id, "refusee")} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "0 10px", cursor: "pointer", color: "#ef4444", fontSize: 11, fontWeight: 700 }}>Refuser</button>
                      </div>
                    )}
                  </div>
                ))}
                {notesFrais.length === 0 && <p style={{ fontSize: 12, color: "var(--text-3)" }}>Aucune note de frais.</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
