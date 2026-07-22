// frontend/src/components/team/TeamView.jsx
//
// B-01 — Demandes en attente (pending / validate)
// A-07 — Finalisation gestion équipe admin :
//   • Section "Comptes suspendus" (chargement lazy, admin uniquement)
//   • Bouton Suspendre par membre actif (admin, non-soi, non-admin)
//   • Bouton Réactiver dans la section des suspendus
//   • Bouton Supprimer par membre (admin, non-soi, non-admin) + ConfirmDialog
//   • Guards côté UI alignés avec le backend

import { useState, useEffect } from "react";
import { Check, X, Clock, AlertTriangle } from "lucide-react";
import * as api from "../../api/client";
import { ConfirmDialog } from "../ui/ConfirmDialog";

// ── Styles partagés ──────────────────────────────────────────────────────────

const ROLE_LABEL = {
  admin:       "Admin",
  chef_projet: "Chef de projet",
  membre:      "Membre",
};

const sectionHeader = (bg, border, color) => ({
  padding: "12px 16px",
  background: bg,
  borderBottom: `1px solid ${border}`,
  fontSize: 10, fontWeight: 700,
  color, letterSpacing: ".1em",
  display: "flex", alignItems: "center", gap: 6,
});

const actionBtn = (variant = "ghost") => {
  const variants = {
    ghost:   { bg: "transparent",       border: "var(--border)",  color: "var(--text-3)",  hoverBg: "var(--bg-hover)" },
    warning: { bg: "#fffbeb",           border: "#fde68a",        color: "#d97706"         },
    danger:  { bg: "#fef2f2",           border: "#fecaca",        color: "#ef4444"         },
    success: { bg: "#f0fdf4",           border: "#bbf7d0",        color: "#16a34a"         },
    approve: { bg: "#f0fdf4",           border: "#bbf7d0",        color: "#16a34a"         },
  };
  const v = variants[variant] || variants.ghost;
  return {
    background: v.bg, border: `1px solid ${v.border}`, color: v.color,
    borderRadius: 8, padding: "5px 10px",
    fontSize: 11, fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 4,
    whiteSpace: "nowrap",
  };
};

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ member, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: member.color || "#6366f1",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 800, fontSize: size * 0.4, flexShrink: 0,
    }}>
      {(member.name || "?")[0].toUpperCase()}
    </div>
  );
}

// ── Dot de statut ────────────────────────────────────────────────────────────

function StatusDot({ active }) {
  return (
    <div title={active ? "Actif" : "Suspendu"} style={{
      width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
      background: active ? "#22c55e" : "#f59e0b",
      border: "2px solid var(--border)",
    }} />
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export function TeamView({ members, onAdd, onDelete, onSetMemberRole, onToggleActive, isAdmin, currentUser }) {
  const [pending,   setPending]   = useState([]);
  const [suspended, setSuspended] = useState([]);
  const [deleted,   setDeleted]   = useState([]);
  const [busyId,    setBusyId]    = useState(null);
  const [err,       setErr]       = useState(null);
  const [confirm,   setConfirm]   = useState(null);

  // ── Chargement initial (admin) ────────────────────────────────────────────

  const loadPending = async () => {
    if (!isAdmin) return;
    try { setPending(await api.getPendingMembers()); }
    catch (e) { setErr(e.message); }
  };

  const loadSuspended = async () => {
    if (!isAdmin) return;
    try { setSuspended(await api.getSuspendedMembers()); }
    catch (e) { /* silencieux */ }
  };

  const loadDeleted = async () => {
    if (!isAdmin) return;
    try { setDeleted(await api.getDeletedMembers()); }
    catch (e) { /* silencieux */ }
  };

  useEffect(() => {
    loadPending();
    loadSuspended();
    loadDeleted();
  }, [isAdmin]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const withBusy = async (id, fn) => {
    setBusyId(id); setErr(null);
    try { await fn(); }
    catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  const decide = (id, action) => withBusy(id, async () => {
    await api.validateMember(id, action);
    setPending((prev) => prev.filter((p) => p.id !== id));
    if (action === "approve") await loadSuspended(); // au cas où il était suspendu auparavant
  });

  const changeRole = (id, role) => withBusy(id, () => onSetMemberRole(id, role));

  const handleToggleActive = (member) => withBusy(member.id, async () => {
    const updated = await onToggleActive(member);
    if (!updated.is_active) {
      // Vient d'être suspendu → passe dans la section suspendu
      setSuspended((prev) => [...prev, updated].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      // Vient d'être réactivé → sort de la section suspendu
      setSuspended((prev) => prev.filter((m) => m.id !== updated.id));
    }
  });

  const handleDelete = (member) => {
    setConfirm({
      title:        "Supprimer le compte",
      message:      `Le compte de ${member.name} sera définitivement supprimé. Ses tâches et activités seront conservées mais sans responsable. Action irréversible.`,
      confirmLabel: "Supprimer",
      danger:       true,
      onConfirm:    () => withBusy(member.id, async () => {
        await onDelete(member.id);
        setSuspended((prev) => prev.filter((m) => m.id !== member.id));
        // Ajouter dans la section supprimés avec la date courante
        const deletedMember = { ...member, deleted_at: new Date().toISOString() };
        setDeleted((prev) => [deletedMember, ...prev]);
      }),
    });
  };

  // ── Helper : est-ce qu'on peut agir sur ce membre ? ──────────────────────

  const canActOn = (m) =>
    isAdmin &&
    !m.is_admin &&
    m.role !== "admin" &&
    m.id !== currentUser?.id;

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 580 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
        Équipe
      </h2>

      {/* ── Erreur globale ───────────────────────────────────────────────── */}
      {err && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 10, padding: "10px 14px", marginBottom: 16,
          color: "#ef4444", fontSize: 13,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      {/* ── Demandes en attente ───────────────────────────────────────────── */}
      {isAdmin && pending.length > 0 && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
          border: "1px solid #fed7aa", overflow: "hidden",
          boxShadow: "var(--shadow)", marginBottom: 20,
        }}>
          <div style={sectionHeader("#fff7ed", "#fed7aa", "#ea580c")}>
            <Clock size={12} /> DEMANDES EN ATTENTE ({pending.length})
          </div>
          {pending.map((p) => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderBottom: "1px solid var(--border)",
            }}>
              <Avatar member={{ ...p, color: "#f59e0b" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.email}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => decide(p.id, "approve")}
                  disabled={busyId === p.id}
                  style={actionBtn("approve")}
                >
                  <Check size={13} /> Valider
                </button>
                <button
                  onClick={() => setConfirm({
                    title:        "Rejeter la demande",
                    message:      `La demande de ${p.name} sera rejetée. La personne ne pourra pas se connecter.`,
                    confirmLabel: "Rejeter",
                    danger:       true,
                    onConfirm:    () => decide(p.id, "reject"),
                  })}
                  disabled={busyId === p.id}
                  style={actionBtn("danger")}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Comptes suspendus ─────────────────────────────────────────────── */}
      {isAdmin && suspended.length > 0 && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
          border: "1px solid #fde68a", overflow: "hidden",
          boxShadow: "var(--shadow)", marginBottom: 20,
        }}>
          <div style={sectionHeader("#fffbeb", "#fde68a", "#d97706")}>
            COMPTES SUSPENDUS ({suspended.length})
          </div>
          {suspended.map((m) => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderBottom: "1px solid var(--border)",
            }}>
              <Avatar member={m} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-2)" }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.email}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => handleToggleActive(m)}
                  disabled={busyId === m.id}
                  style={actionBtn("success")}
                >
                  <Check size={13} /> Réactiver
                </button>
                <button
                  onClick={() => handleDelete(m)}
                  disabled={busyId === m.id}
                  style={actionBtn("danger")}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Comptes supprimés ─────────────────────────────────────────────── */}
      {isAdmin && deleted.length > 0 && (
        <div style={{
          background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)", overflow: "hidden",
          boxShadow: "var(--shadow)", marginBottom: 20,
        }}>
          <div style={sectionHeader("var(--bg)", "var(--border)", "var(--text-3)")}>
            COMPTES SUPPRIMÉS ({deleted.length})
          </div>
          {deleted.map((m) => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderBottom: "1px solid var(--border)",
              opacity: 0.6,
            }}>
              {/* Avatar grisé */}
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "#94a3b8",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 800, fontSize: 16, flexShrink: 0,
              }}>
                {(m.name || "?")[0].toUpperCase()}
              </div>

              {/* Infos */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: 14, color: "var(--text-2)",
                  textDecoration: "line-through",
                }}>
                  {m.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.email}
                </div>
              </div>

              {/* Date de suppression */}
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", marginBottom: 2 }}>
                  SUPPRIMÉ LE
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {new Date(m.deleted_at).toLocaleDateString("fr-FR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Liste des membres actifs ──────────────────────────────────────── */}
      <div style={{
        background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)", overflow: "hidden",
        boxShadow: "var(--shadow)",
      }}>
        <div style={sectionHeader("var(--bg-hover)", "var(--border)", "var(--text-3)")}>
          MEMBRES ({members.length})
        </div>

        {members.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
            <div>Aucun membre actif pour l'instant.</div>
          </div>
        )}

        {members.map((m) => {
          const isAdminMember = m.is_admin || m.role === "admin";
          const busy          = busyId === m.id;
          const canAct        = canActOn(m);

          return (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderBottom: "1px solid var(--border)",
            }}>
              {/* Avatar */}
              <Avatar member={m} />

              {/* Nom */}
              <span style={{
                flex: 1, minWidth: 0,
                fontWeight: 600, fontSize: 14, color: "var(--text)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {m.name}
              </span>

              {/* Actions — groupe fixe à droite */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {/* Rôle global */}
                {isAdmin && canAct ? (
                  <select
                    value={m.role === "chef_projet" ? "chef_projet" : "membre"}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                    disabled={busy}
                    style={{
                      border: "1px solid var(--border)", borderRadius: 8,
                      padding: "5px 8px", fontSize: 12,
                      color: "var(--text)", background: "var(--bg)",
                      cursor: busy ? "not-allowed" : "pointer",
                      fontWeight: m.role === "chef_projet" ? 600 : 400,
                    }}
                  >
                    <option value="membre">Membre</option>
                    <option value="chef_projet">Chef de projet</option>
                  </select>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                    {isAdminMember ? "Admin" : ROLE_LABEL[m.role] || "Membre"}
                  </span>
                )}

                {/* Suspendre */}
                {canAct && (
                  <button
                    onClick={() => handleToggleActive(m)}
                    disabled={busy}
                    title="Suspendre ce compte"
                    style={actionBtn("warning")}
                  >
                    Suspendre
                  </button>
                )}

                {/* Supprimer */}
                {canAct && (
                  <button
                    onClick={() => handleDelete(m)}
                    disabled={busy}
                    title="Supprimer définitivement ce compte"
                    style={actionBtn("danger")}
                  >
                    Supprimer
                  </button>
                )}

                {/* Dot de statut */}
                <StatusDot active={m.is_active !== 0} />
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog data={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}