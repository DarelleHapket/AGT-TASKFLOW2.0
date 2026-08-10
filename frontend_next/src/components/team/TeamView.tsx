"use client";

// Port fidèle de frontend/src/components/team/TeamView.jsx, y compris la
// section "Comptes supprimés" (historique, avatar grisé, nom barré, date de
// suppression, collapsible "voir les X autres" au-delà de 3) — portée via le
// nouvel endpoint GET /membres/deleted (authentification/views.py), qui
// n'existait pas dans une première passe de migration.
import { useEffect, useState } from "react";
import { Check, X, Clock, AlertTriangle, BadgeCheck, Wallet, Pencil } from "lucide-react";
import * as api from "@/lib/api";
import { ConfirmDialog, type ConfirmData } from "@/components/ui/ConfirmDialog";
import { MODULE_LABELS, ROLE_COLORS, ROLE_LABELS } from "@/components/rbac/RBACView";
import type { Competence, Employe, Permission, PermissionDetail, Poste, Profil, Role, Utilisateur } from "@/lib/types";

const ROLE_LABEL = ROLE_LABELS;
const PERIODICITE_LABEL: Record<string, string> = { mensuelle: "mois", hebdomadaire: "semaine", journaliere: "jour" };

function FicheMembreModal({ membre, canSeeSalaire, canEditFiche, onClose }: { membre: Utilisateur; canSeeSalaire: boolean; canEditFiche: boolean; onClose: () => void }) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [postes, setPostes] = useState<Poste[]>([]);
  const [employe, setEmploye] = useState<Employe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editPoste, setEditPoste] = useState("");
  const [editCompetences, setEditCompetences] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  function load() {
    setLoading(true); setError(null);
    Promise.all([api.getProfilParUtilisateur(membre.id), api.getCompetences()])
      .then(([p, c]) => {
        setProfil(p); setCompetences(c);
        setEditPoste(p.poste ? String(p.poste) : "");
        setEditCompetences(p.competences);
        if (canSeeSalaire && p.est_employe && p.employe_id) {
          api.getSalaireEmploye(p.employe_id).then(setEmploye).catch(() => setEmploye(null));
        }
      })
      .catch((e) => setError(api.errorMessage(e, "Profil indisponible")))
      .finally(() => setLoading(false));
    if (canEditFiche) api.getPostes().then(setPostes).catch(() => {});
  }
  useEffect(load, [membre.id, canSeeSalaire, canEditFiche]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enregistrer() {
    if (!profil) return;
    setSaving(true); setSaveErr(null);
    try {
      const updated = await api.updateProfil(profil.id, { poste: editPoste ? Number(editPoste) : null, competences: editCompetences });
      setProfil(updated);
      setEditing(false);
    } catch (e) {
      setSaveErr(api.errorMessage(e, "Enregistrement impossible"));
    } finally {
      setSaving(false);
    }
  }

  function toggleCompetence(id: number) {
    setEditCompetences((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  const nomCompetence = (id: number) => competences.find((c) => c.id === id)?.nom || `#${id}`;
  const contratActuel = employe?.contrats?.find((c) => !c.date_fin) || employe?.contrats?.[employe.contrats.length - 1];
  const remunerationActuelle = contratActuel?.remunerations?.[contratActuel.remunerations.length - 1];
  const selectStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", boxShadow: "0 20px 50px rgba(0,0,0,0.25)", width: "100%", maxWidth: 420, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar member={membre} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{membre.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>{membre.email}</div>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          {loading ? (
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>Chargement…</p>
          ) : error || !profil ? (
            <p style={{ fontSize: 12, color: "var(--danger)" }}>{error || "Profil introuvable."}</p>
          ) : editing ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>POSTE</span>
                <select style={{ ...selectStyle, marginTop: 4 }} value={editPoste} onChange={(e) => setEditPoste(e.target.value)}>
                  <option value="">Non défini</option>
                  {postes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>COMPÉTENCES</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {competences.map((c) => {
                    const active = editCompetences.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => toggleCompetence(c.id)} style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                        background: active ? "var(--accent-bg)" : "transparent",
                        color: active ? "var(--accent)" : "var(--text-3)",
                      }}>{c.nom}</button>
                    );
                  })}
                  {competences.length === 0 && <span style={{ fontSize: 12, color: "var(--text-3)" }}>Aucune compétence dans le référentiel.</span>}
                </div>
              </div>
              {saveErr && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 10 }}>{saveErr}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={enregistrer} disabled={saving} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12 }}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button onClick={() => setEditing(false)} disabled={saving} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 12, color: "var(--text-2)" }}>Annuler</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>POSTE</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{profil.poste_nom || "Non défini"}</div>
              </div>
              <div style={{ marginBottom: profil.est_employe || canEditFiche ? 16 : 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>COMPÉTENCES</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {profil.competences.length === 0 && <span style={{ fontSize: 12, color: "var(--text-3)" }}>Aucune</span>}
                  {profil.competences.map((id) => (
                    <span key={id} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "var(--accent-bg)", color: "var(--accent)" }}>{nomCompetence(id)}</span>
                  ))}
                </div>
              </div>
              {canEditFiche && (
                <button onClick={() => setEditing(true)} style={{ ...actionBtn("ghost"), marginBottom: profil.est_employe && canSeeSalaire ? 16 : 0 }}>
                  <Pencil size={12} /> Modifier le poste / les compétences
                </button>
              )}
              {profil.est_employe && canSeeSalaire && (
                <div style={{ paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Wallet size={14} color="var(--text-3)" />
                  {contratActuel && remunerationActuelle ? (
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
        <div style={{ padding: "0 20px 20px", textAlign: "right" }}>
          <button onClick={onClose} style={{ border: "1px solid var(--border)", background: "var(--bg)", borderRadius: 10, padding: "8px 16px", cursor: "pointer", color: "var(--text-2)", fontWeight: 600, fontSize: 13 }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

type Variant = "ghost" | "warning" | "danger" | "success" | "approve";
const VARIANTS: Record<Variant, { bg: string; border: string; color: string }> = {
  ghost: { bg: "transparent", border: "var(--border)", color: "var(--text-3)" },
  warning: { bg: "#fffbeb", border: "#fde68a", color: "#d97706" },
  danger: { bg: "#fef2f2", border: "#fecaca", color: "#ef4444" },
  success: { bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a" },
  approve: { bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a" },
};
function actionBtn(variant: Variant = "ghost"): React.CSSProperties {
  const v = VARIANTS[variant];
  return { background: v.bg, border: `1px solid ${v.border}`, color: v.color, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" };
}

function sectionHeader(bg: string, border: string, color: string): React.CSSProperties {
  return { padding: "12px 16px", background: bg, borderBottom: `1px solid ${border}`, fontSize: 10, fontWeight: 700, color, letterSpacing: ".1em", display: "flex", alignItems: "center", gap: 6 };
}

const cardStyle: React.CSSProperties = { background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" };

function Avatar({ member, size = 40 }: { member: { name: string; color?: string }; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: member.color || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: size * 0.4, flexShrink: 0 }}>
      {(member.name || "?")[0].toUpperCase()}
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return <div title={active ? "Actif" : "Suspendu"} style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: active ? "#22c55e" : "#f59e0b", border: "2px solid var(--border)" }} />;
}

export function TeamView({ members, roles = [], permissions = [], onDelete, onToggleRole, onTogglePermission, onToggleActive, onValidate, isAdmin, isSuperadmin, currentUser, canSeeSalaire = false, canEditFiche = false }: {
  members: Utilisateur[];
  roles?: Role[]; permissions?: Permission[];
  onDelete: (id: number) => Promise<void>;
  onToggleRole: (id: number, roleCode: string, currentlyHas: boolean) => Promise<void>;
  onTogglePermission: (id: number, permCode: string, currentlyGranted: boolean) => Promise<void>;
  onToggleActive: (m: Utilisateur) => Promise<Utilisateur>;
  onValidate: (id: number, action: "approve" | "reject") => Promise<void>;
  isAdmin: boolean; isSuperadmin: boolean; currentUser: Utilisateur | null; canSeeSalaire?: boolean; canEditFiche?: boolean;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmData | null>(null);
  const [permDetail, setPermDetail] = useState<Record<number, PermissionDetail[]>>({});
  const [deleted, setDeleted] = useState<Utilisateur[]>([]);
  const [showAllDeleted, setShowAllDeleted] = useState(false);
  const [fiche, setFiche] = useState<Utilisateur | null>(null);

  useEffect(() => {
    if (!(isAdmin || isSuperadmin)) return;
    api.getDeletedMembres().then(setDeleted).catch(() => {});
  }, [isAdmin, isSuperadmin]);

  const pending = members.filter((m) => m.statut === "EN_ATTENTE");
  const suspended = members.filter((m) => m.statut === "SUSPENDU");
  const active = members.filter((m) => m.statut === "ACTIF");

  // Superadmin uniquement : détail permission par permission (rôle vs directe)
  // pour chaque membre non-superadmin, afficher les badges cochables sur sa
  // carte (D-08, même logique que team-tool : "cocher/décocher" directement
  // dans la liste des membres, sans passer par un écran séparé).
  useEffect(() => {
    if (!isSuperadmin) return;
    active.filter((m) => !m.roles.includes("superadmin")).forEach((m) => {
      api.getMemberPermissionsDetail(m.id).then((d) => setPermDetail((prev) => ({ ...prev, [m.id]: d }))).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin, members]);

  const withBusy = async (id: number, fn: () => Promise<void>) => {
    setBusyId(id); setErr(null);
    try { await fn(); } catch (e) { setErr(api.errorMessage(e, "Erreur")); } finally { setBusyId(null); }
  };

  const decide = (id: number, action: "approve" | "reject") => withBusy(id, () => onValidate(id, action));
  const handleToggleActive = (member: Utilisateur) => withBusy(member.id, async () => { await onToggleActive(member); });
  const handleToggleRole = (member: Utilisateur, roleCode: string) => withBusy(member.id, () => onToggleRole(member.id, roleCode, member.roles.includes(roleCode)));
  const handleTogglePermission = async (member: Utilisateur, permCode: string, currentlyGranted: boolean) => {
    await onTogglePermission(member.id, permCode, currentlyGranted);
    const d = await api.getMemberPermissionsDetail(member.id).catch(() => null);
    if (d) setPermDetail((prev) => ({ ...prev, [member.id]: d }));
  };
  const handleDelete = (member: Utilisateur) => {
    setConfirm({
      title: "Supprimer le compte",
      message: `Le compte de ${member.name} sera définitivement supprimé. Ses tâches et activités seront conservées mais sans responsable. Action irréversible.`,
      confirmLabel: "Supprimer", danger: true,
      onConfirm: () => withBusy(member.id, async () => {
        await onDelete(member.id);
        setDeleted((prev) => [{ ...member, statut: "SUPPRIME", deleted_at: new Date().toISOString() }, ...prev]);
      }),
    });
  };

  const canActOn = (m: Utilisateur) => isSuperadmin && !m.roles.includes("admin") && !m.roles.includes("superadmin") && m.id !== currentUser?.id;

  return (
    <div style={{ maxWidth: 580 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Équipe</h2>

      {err && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      {(isAdmin || isSuperadmin) && pending.length > 0 && (
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid #fed7aa", overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: 20 }}>
          <div style={sectionHeader("#fff7ed", "#fed7aa", "#ea580c")}><Clock size={12} /> DEMANDES EN ATTENTE ({pending.length})</div>
          {pending.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <Avatar member={{ name: p.name, color: "#f59e0b" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => decide(p.id, "approve")} disabled={busyId === p.id} style={actionBtn("approve")}><Check size={13} /> Valider</button>
                <button onClick={() => setConfirm({ title: "Rejeter la demande", message: `La demande de ${p.name} sera rejetée. La personne ne pourra pas se connecter.`, confirmLabel: "Rejeter", danger: true, onConfirm: () => decide(p.id, "reject") })} disabled={busyId === p.id} style={actionBtn("danger")}><X size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(isAdmin || isSuperadmin) && suspended.length > 0 && (
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid #fde68a", overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: 20 }}>
          <div style={sectionHeader("#fffbeb", "#fde68a", "#d97706")}>COMPTES SUSPENDUS ({suspended.length})</div>
          {suspended.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <Avatar member={m} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-2)" }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => handleToggleActive(m)} disabled={busyId === m.id} style={actionBtn("success")}><Check size={13} /> Réactiver</button>
                <button onClick={() => handleDelete(m)} disabled={busyId === m.id} style={actionBtn("danger")}><X size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(isAdmin || isSuperadmin) && deleted.length > 0 && (
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: 20 }}>
          <div style={sectionHeader("var(--bg)", "var(--border)", "var(--text-3)")}>COMPTES SUPPRIMÉS ({deleted.length})</div>
          {(showAllDeleted ? deleted : deleted.slice(0, 3)).map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)", opacity: 0.6 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                {(m.name || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-2)", textDecoration: "line-through" }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", marginBottom: 2 }}>SUPPRIMÉ LE</div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {m.deleted_at && new Date(m.deleted_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </div>
              </div>
            </div>
          ))}
          {deleted.length >= 3 && (
            <button onClick={() => setShowAllDeleted((v) => !v)} style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-3)", fontWeight: 600, borderTop: "1px solid var(--border)", textAlign: "left" }}>
              {showAllDeleted ? "▲ Réduire" : `▾ Voir les ${deleted.length - 3} autres comptes supprimés`}
            </button>
          )}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".08em", marginBottom: 8 }}>MEMBRES ({active.length})</div>

        {active.length === 0 && (
          <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-3)" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
            <div>Aucun membre actif pour l&apos;instant.</div>
          </div>
        )}

        {/* Cartes style team-tool (D-08) : rôles + permissions directement
            cochables/décochables sur la fiche du membre par le Superadmin,
            sans passer par un écran séparé — Admin est un rôle unique
            (comme Superadmin) : tant que quelqu'un le porte déjà, il
            apparaît désactivé pour les autres (appliqué aussi côté serveur,
            cf. assign_member_role). */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {active.map((m) => {
            const adminDejaPris = active.some((a) => a.roles.includes("admin") && a.id !== m.id);
            const busy = busyId === m.id;
            const canAct = canActOn(m);
            const isSuperadminMember = m.roles.includes("superadmin");
            const detail = permDetail[m.id];

            return (
              <div key={m.id} style={{ ...cardStyle, borderTop: `3px solid ${m.color || "#6366f1"}`, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <Avatar member={m} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
                  </div>
                  <StatusDot active />
                </div>

                {isSuperadminMember ? (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", marginBottom: 10 }}>Superadmin — accès total</div>
                ) : (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", marginBottom: 5 }}>RÔLES</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {roles.filter((r) => r.code !== "superadmin").map((r) => {
                        const hasRole = m.roles.includes(r.code);
                        const lockedAdmin = r.code === "admin" && !hasRole && adminDejaPris;
                        const disabled = !isSuperadmin || busy || lockedAdmin;
                        return (
                          <button key={r.code} disabled={disabled} onClick={() => handleToggleRole(m, r.code)}
                            title={lockedAdmin ? "Un Admin existe déjà — rôle unique" : undefined}
                            style={{
                              fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, cursor: disabled ? "not-allowed" : "pointer",
                              border: "none", opacity: lockedAdmin ? 0.4 : 1,
                              background: hasRole ? (ROLE_COLORS[r.code]?.bg || "var(--bg-hover)") : "var(--bg)",
                              color: hasRole ? (ROLE_COLORS[r.code]?.color || "var(--text-2)") : "var(--text-3)",
                            }}>
                            {ROLE_LABEL[r.code] || r.code}
                          </button>
                        );
                      })}
                    </div>

                    {isSuperadmin && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", marginBottom: 5 }}>PERMISSIONS DIRECTES</div>
                        {!detail ? (
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>Chargement…</span>
                        ) : permissions.length === 0 ? (
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>Aucune permission dans le catalogue.</span>
                        ) : (
                          // Regroupées par module (référentiel déjà trié module→code
                          // côté backend) pour la lisibilité — sinon 20+ badges en vrac.
                          Object.entries(
                            permissions.reduce<Record<string, Permission[]>>((acc, p) => {
                              (acc[p.module] = acc[p.module] || []).push(p);
                              return acc;
                            }, {})
                          ).map(([module, modulePerms]) => (
                            <div key={module} style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 3 }}>
                                {MODULE_LABELS[module] || module}
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {modulePerms.map((p) => {
                                  const pd = detail.find((x) => x.code === p.code);
                                  const granted = !!pd?.granted;
                                  return (
                                    <button key={p.code} disabled={busy} onClick={() => handleTogglePermission(m, p.code, granted)} title={p.description}
                                      style={{
                                        fontSize: 10.5, fontWeight: granted ? 700 : 400, padding: "3px 10px", borderRadius: 20, cursor: busy ? "not-allowed" : "pointer",
                                        border: `1px solid ${granted ? "var(--accent)" : "var(--border)"}`,
                                        background: granted ? "var(--accent)" : "transparent",
                                        color: granted ? "white" : "var(--text-3)",
                                      }}>
                                      {p.code}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </>
                    )}
                  </>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setFiche(m)} title="Voir la fiche" style={actionBtn("ghost")}><BadgeCheck size={13} /> Fiche</button>
                  {canAct && <button onClick={() => handleToggleActive(m)} disabled={busy} title="Suspendre ce compte" style={actionBtn("warning")}>Suspendre</button>}
                  {canAct && <button onClick={() => handleDelete(m)} disabled={busy} title="Supprimer définitivement ce compte" style={actionBtn("danger")}>Supprimer</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog data={confirm} onClose={() => setConfirm(null)} />
      {fiche && <FicheMembreModal membre={fiche} canSeeSalaire={canSeeSalaire} canEditFiche={canEditFiche} onClose={() => setFiche(null)} />}
    </div>
  );
}
