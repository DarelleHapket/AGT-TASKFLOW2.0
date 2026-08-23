"use client";

// Mon compte — port de team-tool/frontend/src/app/mon-compte/page.tsx
// (changement de mot de passe, forcé au premier login via doit_changer_mdp,
// D-11). N'existait pas côté AGT d'origine — champ doit_changer_mdp présent
// en base mais jamais branché à un écran jusqu'ici (dette identifiée pendant
// la migration). Styles inline alignés sur le reste de l'app.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import { KeyRound, UserRound, Wallet, Pencil, FileDown, CalendarDays, Receipt } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { Competence, Conge, Employe, FichePaie, NoteFrais, Profil, StatutDemande } from "@/lib/types";

const PERIODICITE_LABEL: Record<string, string> = { mensuelle: "mois", hebdomadaire: "semaine", journaliere: "jour" };
const AVATAR_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#f97316", "#06b6d4", "#84cc16", "#ef4444", "#3b82f6"];
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

const MOIS_LABEL = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

// Fiche de paie — PDF généré côté client à partir d'une FichePaie persistée
// (BF-54, générée par le cron mensuel), jamais stocké côté serveur (même
// pattern que le bilan financier, BF-29 / Document d'Analyse §11).
function genererFichePaiePDF(nomEmploye: string, fiche: FichePaie) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(40, 40, 90);
  doc.text("Fiche de paie — AGT Technologies", margin, y); y += 24;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
  doc.text(`Émise le ${new Date().toLocaleDateString("fr-FR")}`, margin, y); y += 24;
  doc.setDrawColor(200); doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y); y += 24;

  const rows: [string, string][] = [
    ["Employé", nomEmploye],
    ["Période", MOIS_LABEL.format(new Date(fiche.periode))],
    ["Montant", fiche.montant],
    ["Générée le", new Date(fiche.date_generation).toLocaleDateString("fr-FR")],
  ];
  rows.forEach(([label, valeur]) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
    doc.text(valeur, margin + 150, y);
    y += 22;
  });
  y += 14;
  doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  doc.text("Document généré depuis l'espace salarié — à valider par le service RH avant tout usage officiel.", margin, y);
  doc.save(`fiche_de_paie_${nomEmploye.replace(/\s+/g, "_")}_${fiche.periode}.pdf`);
}

export default function MonComptePage() {
  const { user, isLogged, refreshUser } = useAuth();
  const router = useRouter();
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirme, setConfirme] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);
  const [busy, setBusy] = useState(false);

  const [profil, setProfil] = useState<Profil | null>(null);
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [employe, setEmploye] = useState<Employe | null>(null);
  const [profilLoading, setProfilLoading] = useState(true);

  const [conges, setConges] = useState<Conge[]>([]);
  const [congeForm, setCongeForm] = useState({ date_debut: "", date_fin: "", motif: "" });
  const [congeMsg, setCongeMsg] = useState<string | null>(null);
  const [savingConge, setSavingConge] = useState(false);

  const [notesFrais, setNotesFrais] = useState<NoteFrais[]>([]);
  const [fraisForm, setFraisForm] = useState({ montant: "", motif: "", date_depense: "" });
  const [fraisMsg, setFraisMsg] = useState<string | null>(null);
  const [savingFrais, setSavingFrais] = useState(false);

  const [fichesPaie, setFichesPaie] = useState<FichePaie[]>([]);

  const [editingInfos, setEditingInfos] = useState(false);
  const [nom, setNom] = useState("");
  const [couleur, setCouleur] = useState("");
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [infoErr, setInfoErr] = useState(false);
  const [savingInfos, setSavingInfos] = useState(false);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  useEffect(() => {
    if (!isLogged) return;
    // getCompetences() exige rh.read (absent pour un simple membre) : chargé
    // séparément pour ne pas faire échouer l'affichage du profil lui-même,
    // toujours accessible via getMonProfil() (IsAuthenticated uniquement).
    api.getCompetences().then(setCompetences).catch(() => setCompetences([]));
    api.getMonProfil()
      .then((p) => {
        setProfil(p);
        if (p.est_employe) {
          api.getMonSalaire().then(setEmploye).catch(() => setEmploye(null));
          api.getMesFichesPaie().then(setFichesPaie).catch(() => setFichesPaie([]));
          rechargerConges(); rechargerFrais();
        }
      })
      .catch(() => setProfil(null))
      .finally(() => setProfilLoading(false));
  }, [isLogged]);

  function rechargerConges() { api.getConges().then(setConges).catch(() => setConges([])); }
  function rechargerFrais() { api.getNotesFrais().then(setNotesFrais).catch(() => setNotesFrais([])); }

  async function poserConge() {
    setCongeMsg(null);
    if (!congeForm.date_debut || !congeForm.date_fin) { setCongeMsg("Dates de début et de fin requises."); return; }
    setSavingConge(true);
    try {
      await api.createConge(congeForm);
      setCongeForm({ date_debut: "", date_fin: "", motif: "" });
      rechargerConges();
    } catch (e) {
      setCongeMsg(api.errorMessage(e, "Impossible de poser ce congé"));
    } finally {
      setSavingConge(false);
    }
  }

  async function annulerConge(id: number) {
    await api.annulerConge(id).catch(() => {});
    rechargerConges();
  }

  async function declarerFrais() {
    setFraisMsg(null);
    if (!fraisForm.montant || !fraisForm.motif.trim() || !fraisForm.date_depense) { setFraisMsg("Montant, motif et date requis."); return; }
    setSavingFrais(true);
    try {
      await api.createNoteFrais(fraisForm);
      setFraisForm({ montant: "", motif: "", date_depense: "" });
      rechargerFrais();
    } catch (e) {
      setFraisMsg(api.errorMessage(e, "Impossible de déclarer cette note de frais"));
    } finally {
      setSavingFrais(false);
    }
  }

  async function annulerFrais(id: number) {
    await api.annulerNoteFrais(id).catch(() => {});
    rechargerFrais();
  }

  useEffect(() => {
    if (user) { setNom(user.name); setCouleur(user.color); }
  }, [user]);

  async function enregistrerInfos() {
    setInfoMsg(null); setInfoErr(false);
    if (!nom.trim()) { setInfoMsg("Le nom ne peut pas être vide."); setInfoErr(true); return; }
    setSavingInfos(true);
    try {
      await api.updateMe({ first_name: nom.trim(), color: couleur });
      await refreshUser();
      setEditingInfos(false);
    } catch (e) {
      setInfoMsg(api.errorMessage(e, "Enregistrement impossible"));
      setInfoErr(true);
    } finally {
      setSavingInfos(false);
    }
  }

  const nomCompetence = (id: number) => competences.find((c) => c.id === id)?.nom || `#${id}`;
  const contratActuel = employe?.contrats?.find((c) => !c.date_fin) || employe?.contrats?.[employe.contrats.length - 1];
  const remunerationActuelle = contratActuel?.remunerations?.[contratActuel.remunerations.length - 1];

  async function soumettre() {
    setMessage(null); setErreur(false);
    if (nouveau !== confirme) { setMessage("Les mots de passe ne correspondent pas."); setErreur(true); return; }
    if (nouveau.length < 6) { setMessage("Le nouveau mot de passe doit faire au moins 6 caractères."); setErreur(true); return; }
    setBusy(true);
    try {
      await api.changerMdp(ancien, nouveau);
      setMessage("Mot de passe modifié avec succès.");
      setAncien(""); setNouveau(""); setConfirme("");
      await refreshUser();
      setTimeout(() => router.replace("/dashboard"), 800);
    } catch (e) {
      setMessage(api.errorMessage(e, "Erreur lors du changement de mot de passe."));
      setErreur(true);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, background: "var(--bg-input)", color: "var(--text)", outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 5 };

  return (
    <AppShell>
      <div style={{ maxWidth: 420 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <KeyRound size={20} /> Mon compte
        </h2>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{user.name} ({user.email})</span>

        <div style={{ marginTop: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editingInfos ? 14 : 0 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
              <UserRound size={16} /> Informations personnelles
            </h3>
            {!editingInfos && (
              <button onClick={() => setEditingInfos(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <Pencil size={13} /> Modifier
              </button>
            )}
          </div>
          {editingInfos && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>NOM AFFICHÉ</label>
                <input style={inp} value={nom} onChange={(e) => setNom(e.target.value)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>COULEUR D&apos;AVATAR</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {AVATAR_COLORS.map((c) => (
                    <button key={c} onClick={() => setCouleur(c)} style={{
                      width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                      border: couleur === c ? "2px solid var(--text)" : "2px solid transparent",
                    }} />
                  ))}
                </div>
              </div>
              {infoMsg && <div style={{ marginBottom: 12, fontSize: 12, color: infoErr ? "#ef4444" : "#16a34a" }}>{infoMsg}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={enregistrerInfos} disabled={savingInfos} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                  {savingInfos ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button onClick={() => { setEditingInfos(false); setNom(user.name); setCouleur(user.color); }} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 12, color: "var(--text-2)" }}>Annuler</button>
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", padding: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            <UserRound size={16} /> Mon profil
          </h3>
          {profilLoading ? (
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>Chargement…</p>
          ) : !profil ? (
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>Profil indisponible.</p>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>POSTE</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{profil.poste_nom || "Non défini"}</div>
              </div>
              <div style={{ marginBottom: profil.est_employe ? 16 : 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>COMPÉTENCES</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {profil.competences.length === 0 && <span style={{ fontSize: 12, color: "var(--text-3)" }}>Aucune</span>}
                  {profil.competences.map((id) => (
                    <span key={id} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "var(--accent-bg)", color: "var(--accent)" }}>{nomCompetence(id)}</span>
                  ))}
                </div>
              </div>
              {profil.est_employe && (
                <div style={{ paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Wallet size={14} color="var(--text-3)" />
                    {employe && contratActuel && remunerationActuelle ? (
                      <span style={{ fontSize: 13, color: "var(--text)" }}>
                        <strong>{remunerationActuelle.montant}</strong> / {PERIODICITE_LABEL[remunerationActuelle.periodicite] || remunerationActuelle.periodicite}
                        <span style={{ color: "var(--text-3)", fontWeight: 400 }}> — {contratActuel.type_contrat_nom}</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-3)" }}>Rémunération non renseignée.</span>
                    )}
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>MES FICHES DE PAIE</span>
                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
                      {fichesPaie.length === 0 && (
                        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>Aucune fiche de paie générée pour l&apos;instant.</p>
                      )}
                      {fichesPaie.map((f) => (
                        <div key={f.id} style={{ fontSize: 12, color: "var(--text-2)", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text)", textTransform: "capitalize" }}>{MOIS_LABEL.format(new Date(f.periode))}</div>
                            <div style={{ color: "var(--text-3)", marginTop: 2 }}>{f.montant}</div>
                          </div>
                          <button onClick={() => genererFichePaiePDF(user.name, f)}
                            style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "var(--text-2)", fontWeight: 600, whiteSpace: "nowrap" }}>
                            <FileDown size={13} /> PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {employe && employe.contrats.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>HISTORIQUE DE CARRIÈRE</span>
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
                        {employe.contrats.map((c) => (
                          <div key={c.id} style={{ fontSize: 12, color: "var(--text-2)", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                            <div style={{ fontWeight: 600, color: "var(--text)" }}>
                              {c.type_contrat_nom}
                              <span style={{ fontWeight: 400, color: "var(--text-3)" }}> — {new Date(c.date_debut).toLocaleDateString("fr-FR")}
                                {c.date_fin ? ` → ${new Date(c.date_fin).toLocaleDateString("fr-FR")}` : " (en cours)"}
                              </span>
                            </div>
                            {c.remunerations.map((r) => (
                              <div key={r.id} style={{ marginTop: 2, color: "var(--text-3)" }}>
                                {r.montant} / {PERIODICITE_LABEL[r.periodicite] || r.periodicite} — depuis le {new Date(r.cree_le).toLocaleDateString("fr-FR")}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {profil?.est_employe && (
          <div style={{ marginTop: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", padding: 20 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarDays size={16} /> Mes congés
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: conges.length ? 16 : 8 }}>
              {conges.map((c) => (
                <div key={c.id} style={{ fontSize: 12, color: "var(--text-2)", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>
                      {new Date(c.date_debut).toLocaleDateString("fr-FR")} → {new Date(c.date_fin).toLocaleDateString("fr-FR")}
                    </div>
                    {c.motif && <div style={{ color: "var(--text-3)", marginTop: 2 }}>{c.motif}</div>}
                    {c.statut !== "en_attente" && c.commentaire_validation && (
                      <div style={{ color: "var(--text-3)", marginTop: 2, fontStyle: "italic" }}>« {c.commentaire_validation} »</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <StatutPill statut={c.statut} />
                    {c.statut === "en_attente" && (
                      <button onClick={() => annulerConge(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 11 }}>Annuler</button>
                    )}
                  </div>
                </div>
              ))}
              {conges.length === 0 && <p style={{ fontSize: 12, color: "var(--text-3)" }}>Aucune demande de congé.</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 8, marginBottom: 8 }}>
              <div>
                <label style={lbl}>DÉBUT</label>
                <input style={inp} type="date" value={congeForm.date_debut} onChange={(e) => setCongeForm({ ...congeForm, date_debut: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>FIN</label>
                <input style={inp} type="date" value={congeForm.date_fin} onChange={(e) => setCongeForm({ ...congeForm, date_fin: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>MOTIF (optionnel)</label>
              <input style={inp} value={congeForm.motif} onChange={(e) => setCongeForm({ ...congeForm, motif: e.target.value })} />
            </div>
            {congeMsg && <div style={{ marginBottom: 10, fontSize: 12, color: "#ef4444" }}>{congeMsg}</div>}
            <button onClick={poserConge} disabled={savingConge} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: savingConge ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12, opacity: savingConge ? 0.7 : 1 }}>
              {savingConge ? "Envoi…" : "Poser un congé"}
            </button>
          </div>
        )}

        {profil?.est_employe && (
          <div style={{ marginTop: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", padding: 20 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
              <Receipt size={16} /> Mes notes de frais
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: notesFrais.length ? 16 : 8 }}>
              {notesFrais.map((n) => (
                <div key={n.id} style={{ fontSize: 12, color: "var(--text-2)", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>
                      {n.montant} — {n.motif}
                    </div>
                    <div style={{ color: "var(--text-3)", marginTop: 2 }}>{new Date(n.date_depense).toLocaleDateString("fr-FR")}</div>
                    {n.statut !== "en_attente" && n.commentaire_validation && (
                      <div style={{ color: "var(--text-3)", marginTop: 2, fontStyle: "italic" }}>« {n.commentaire_validation} »</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <StatutPill statut={n.statut} />
                    {n.statut === "en_attente" && (
                      <button onClick={() => annulerFrais(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 11 }}>Annuler</button>
                    )}
                  </div>
                </div>
              ))}
              {notesFrais.length === 0 && <p style={{ fontSize: 12, color: "var(--text-3)" }}>Aucune note de frais.</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 8, marginBottom: 8 }}>
              <div>
                <label style={lbl}>MONTANT</label>
                <input style={inp} type="number" min={0} step="0.01" value={fraisForm.montant} onChange={(e) => setFraisForm({ ...fraisForm, montant: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>DATE DE LA DÉPENSE</label>
                <input style={inp} type="date" value={fraisForm.date_depense} onChange={(e) => setFraisForm({ ...fraisForm, date_depense: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>MOTIF</label>
              <input style={inp} value={fraisForm.motif} onChange={(e) => setFraisForm({ ...fraisForm, motif: e.target.value })} />
            </div>
            {fraisMsg && <div style={{ marginBottom: 10, fontSize: 12, color: "#ef4444" }}>{fraisMsg}</div>}
            <button onClick={declarerFrais} disabled={savingFrais} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: savingFrais ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12, opacity: savingFrais ? 0.7 : 1 }}>
              {savingFrais ? "Envoi…" : "Déclarer une note de frais"}
            </button>
          </div>
        )}

        {user.doit_changer_mdp && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, fontSize: 12, color: "#ea580c" }}>
            Vous devez changer votre mot de passe avant de continuer.
          </div>
        )}

        <div style={{ marginTop: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>MOT DE PASSE ACTUEL</label>
            <input style={inp} type="password" value={ancien} onChange={(e) => setAncien(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>NOUVEAU MOT DE PASSE</label>
            <input style={inp} type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>CONFIRMER LE NOUVEAU MOT DE PASSE</label>
            <input style={inp} type="password" value={confirme} onChange={(e) => setConfirme(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && soumettre()} />
          </div>

          {message && (
            <div style={{ marginBottom: 14, fontSize: 12, color: erreur ? "#ef4444" : "#16a34a" }}>{message}</div>
          )}

          <button onClick={soumettre} disabled={busy} style={{ width: "100%", background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "10px", cursor: busy ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Changement…" : "Changer le mot de passe"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
