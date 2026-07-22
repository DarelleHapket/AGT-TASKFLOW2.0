// frontend/src/components/projects/ProjectMembersPanel.jsx
//
// A-07 — Panel de gestion de l'équipe d'un projet.
// Affiché en inline (slide-down) sous la carte projet dans ProjectsView.
//
// Comportement :
//   - Chargement lazy : membres fetché au premier affichage
//   - Owner : peut ajouter, changer le rôle, retirer des membres
//   - Manager/Contributor : vue lecture seule (liste + rôles)
//   - Badges : PROPRIÉTAIRE (indigo) · MANAGER (bleu) · CONTRIBUTEUR (vert)

import { useState, useEffect, useCallback } from "react";

// ── Constantes de style ───────────────────────────────────────────────────────

const ROLE_META = {
  owner:       { label: "Propriétaire", bg: "#eef2ff", color: "#4338ca", border: "#c7d2fe" },
  manager:     { label: "Manager",      bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  contributor: { label: "Contributeur", bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
};

const SELECT_ROLES = [
  { value: "contributor", label: "Contributeur" },
  { value: "manager",     label: "Manager" },
];

function RoleBadge({ role }) {
  const meta = ROLE_META[role] || ROLE_META.contributor;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: ".04em",
      padding: "2px 8px", borderRadius: 6,
      background: meta.bg, color: meta.color,
      border: `1px solid ${meta.border}`,
    }}>
      {meta.label.toUpperCase()}
    </span>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export function ProjectMembersPanel({
  project,          // { id, user_role, chef_name, ... }
  allMembers,       // tous les membres de l'app (pour le sélecteur d'ajout)
  onGetMembers,     // fn(pid) → Promise<member[]>
  onAddMember,      // fn(pid, { member_id, role }) → Promise<member>
  onUpdateMember,   // fn(pid, mid, { role }) → Promise<member>
  onRemoveMember,   // fn(pid, mid) → Promise
}) {
  const isOwner = project.user_role === "owner";

  const [members,    setMembers]    = useState(null);   // null = pas encore chargé
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [addMemberId, setAddMemberId] = useState("");
  const [addRole,     setAddRole]     = useState("contributor");
  const [adding,      setAdding]      = useState(false);
  const [actionError, setActionError] = useState(null);

  // Chargement initial
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onGetMembers(project.id);
      setMembers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [project.id, onGetMembers]);

  useEffect(() => { load(); }, [load]);

  // Membres non encore dans le projet (pour le sélecteur d'ajout)
  const memberIds = new Set((members || []).map((m) => m.member_id));
  const availableToAdd = allMembers.filter(
    (m) => !memberIds.has(m.id) && m.is_active !== 0
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!addMemberId) return;
    setActionError(null);
    setAdding(true);
    try {
      const newMember = await onAddMember(project.id, {
        member_id: Number(addMemberId),
        role: addRole,
      });
      setMembers((prev) => [...(prev || []), newMember]);
      setAddMemberId("");
      setAddRole("contributor");
    } catch (e) {
      setActionError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (mid, newRole) => {
    setActionError(null);
    try {
      const updated = await onUpdateMember(project.id, mid, { role: newRole });
      setMembers((prev) =>
        (prev || []).map((m) => m.member_id === mid ? { ...m, ...updated } : m)
      );
    } catch (e) {
      setActionError(e.message);
    }
  };

  const handleRemove = async (mid, name) => {
    if (!window.confirm(`Retirer ${name} du projet ?`)) return;
    setActionError(null);
    try {
      await onRemoveMember(project.id, mid);
      setMembers((prev) => (prev || []).filter((m) => m.member_id !== mid));
    } catch (e) {
      setActionError(e.message);
    }
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      borderTop: "1px solid var(--border)",
      background: "var(--bg)",
      padding: "16px 20px",
      animation: "slideDown .18s ease",
    }}>
      <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }`}</style>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", letterSpacing: ".06em" }}>
          ÉQUIPE DU PROJET
        </span>
        {members !== null && (
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            {members.length} membre{members.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* États de chargement / erreur */}
      {loading && (
        <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 0" }}>Chargement…</div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", background: "#fef2f2", borderRadius: 8, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {/* Liste des membres */}
      {!loading && members && members.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {members.map((m) => (
            <div key={m.member_id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", borderRadius: 8,
              background: "var(--bg-card)", border: "1px solid var(--border)",
            }}>
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: m.color || "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: "white", flexShrink: 0,
              }}>
                {(m.name || "?")[0].toUpperCase()}
              </div>

              {/* Nom — prend tout l'espace disponible */}
              <span style={{
                fontSize: 13, fontWeight: 600, color: "var(--text)",
                flex: 1, minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {m.name}
              </span>

              {/* Rôle + actions — groupe fixe poussé à droite */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                flexShrink: 0, marginLeft: "auto",
              }}>
                {isOwner && m.role !== "owner" ? (
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.member_id, e.target.value)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 6px",
                      borderRadius: 6, border: "1px solid var(--border)",
                      background: "var(--bg-card)", color: "var(--text-2)",
                      cursor: "pointer",
                    }}
                  >
                    {SELECT_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                ) : (
                  <RoleBadge role={m.role} />
                )}

                {isOwner && m.role !== "owner" && (
                  <button
                    onClick={() => handleRemove(m.member_id, m.name)}
                    style={{
                      padding: "3px 10px", borderRadius: 6,
                      border: "1px solid #fecaca",
                      background: "transparent", color: "#ef4444",
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Retirer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* État vide */}
      {!loading && members && members.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", marginBottom: 14 }}>
          Aucun membre dans ce projet.
        </div>
      )}

      {/* Formulaire d'ajout (owner uniquement) */}
      {isOwner && (
        <div style={{
          paddingTop: 12, borderTop: "1px solid var(--border)",
          display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
        }}>
          <select
            value={addMemberId}
            onChange={(e) => setAddMemberId(e.target.value)}
            style={{
              flex: 2, minWidth: 140, padding: "7px 10px",
              borderRadius: 8, border: "1.5px solid var(--border)",
              fontSize: 12, background: "var(--bg-card)", color: "var(--text)",
            }}
          >
            <option value="">— Ajouter un membre —</option>
            {availableToAdd.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <select
            value={addRole}
            onChange={(e) => setAddRole(e.target.value)}
            style={{
              flex: 1, minWidth: 120, padding: "7px 10px",
              borderRadius: 8, border: "1.5px solid var(--border)",
              fontSize: 12, background: "var(--bg-card)", color: "var(--text)",
            }}
          >
            {SELECT_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <button
            onClick={handleAdd}
            disabled={!addMemberId || adding}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none",
              background: !addMemberId || adding ? "var(--bg)" : "var(--accent)",
              color: !addMemberId || adding ? "var(--text-3)" : "white",
              fontSize: 12, fontWeight: 700,
              cursor: !addMemberId || adding ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {adding ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      )}

      {/* Erreur d'action */}
      {actionError && (
        <div style={{
          marginTop: 10, fontSize: 12, color: "#ef4444",
          padding: "8px 12px", background: "#fef2f2",
          borderRadius: 8, border: "1px solid #fecaca",
        }}>
          {actionError}
        </div>
      )}
    </div>
  );
}