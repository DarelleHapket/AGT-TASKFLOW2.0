"use client";

// Mon compte — port de team-tool/frontend/src/app/mon-compte/page.tsx
// (changement de mot de passe, forcé au premier login via doit_changer_mdp,
// D-11). N'existait pas côté AGT d'origine — champ doit_changer_mdp présent
// en base mais jamais branché à un écran jusqu'ici (dette identifiée pendant
// la migration). Styles inline alignés sur le reste de l'app.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserRound, Wallet } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { Competence, Employe, Profil } from "@/lib/types";

const PERIODICITE_LABEL: Record<string, string> = { mensuelle: "mois", hebdomadaire: "semaine", journaliere: "jour" };

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
        if (p.est_employe) api.getMonSalaire().then(setEmploye).catch(() => setEmploye(null));
      })
      .catch(() => setProfil(null))
      .finally(() => setProfilLoading(false));
  }, [isLogged]);

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
                <div style={{ paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
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
              )}
            </>
          )}
        </div>

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
