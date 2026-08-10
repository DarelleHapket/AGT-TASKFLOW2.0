"use client";

// Port fidèle de frontend/src/components/projects/ProjectMembersPanel.jsx.
import { useCallback, useEffect, useState } from "react";
import type { MembreProjet, Projet, Utilisateur } from "@/lib/types";

const ROLE_META: Record<string, { label: string; bg: string; color: string; border: string }> = {
  owner: { label: "Propriétaire", bg: "#eef2ff", color: "#4338ca", border: "#c7d2fe" },
  manager: { label: "Manager", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  contributor: { label: "Contributeur", bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
};
const SELECT_ROLES = [{ value: "contributor", label: "Contributeur" }, { value: "manager", label: "Manager" }];

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] || ROLE_META.contributor;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", padding: "2px 8px", borderRadius: 6, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
      {meta.label.toUpperCase()}
    </span>
  );
}

interface Props {
  project: Projet;
  allMembers: Utilisateur[];
  onGetMembers: (pid: number) => Promise<MembreProjet[]>;
  onAddMember: (pid: number, utilisateur: number, role: "manager" | "contributor") => Promise<MembreProjet>;
  onUpdateMember: (pid: number, mid: number, role: "manager" | "contributor") => Promise<MembreProjet>;
  onRemoveMember: (pid: number, mid: number) => Promise<void>;
}

export function ProjectMembersPanel({ project, allMembers, onGetMembers, onAddMember, onUpdateMember, onRemoveMember }: Props) {
  const isOwner = project.user_role === "owner";

  const [members, setMembers] = useState<MembreProjet[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addMemberId, setAddMemberId] = useState("");
  const [addRole, setAddRole] = useState<"contributor" | "manager">("contributor");
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setMembers(await onGetMembers(project.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [project.id, onGetMembers]);

  useEffect(() => { load(); }, [load]);

  const memberIds = new Set((members || []).map((m) => m.utilisateur));
  // Admin (lecture seule) et Superadmin ne travaillent pas sur les projets :
  // ils ne doivent jamais apparaître comme membre assignable.
  const availableToAdd = allMembers.filter((m) => !memberIds.has(m.id) && m.statut === "ACTIF" && !m.roles.includes("admin") && !m.roles.includes("superadmin"));

  const handleAdd = async () => {
    if (!addMemberId) return;
    setActionError(null); setAdding(true);
    try {
      const newMember = await onAddMember(project.id, Number(addMemberId), addRole);
      setMembers((prev) => [...(prev || []), newMember]);
      setAddMemberId(""); setAddRole("contributor");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (mid: number, newRole: "manager" | "contributor") => {
    setActionError(null);
    try {
      const updated = await onUpdateMember(project.id, mid, newRole);
      setMembers((prev) => (prev || []).map((m) => (m.id === mid ? { ...m, ...updated } : m)));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erreur");
    }
  };

  const handleRemove = async (mid: number, name: string) => {
    if (!window.confirm(`Retirer ${name} du projet ?`)) return;
    setActionError(null);
    try {
      await onRemoveMember(project.id, mid);
      setMembers((prev) => (prev || []).filter((m) => m.id !== mid));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg)", padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", letterSpacing: ".06em" }}>ÉQUIPE DU PROJET</span>
        {members !== null && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{members.length} membre{members.length !== 1 ? "s" : ""}</span>}
      </div>

      {loading && <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 0" }}>Chargement…</div>}
      {error && <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", background: "#fef2f2", borderRadius: 8, marginBottom: 10 }}>{error}</div>}

      {!loading && members && members.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "white", flexShrink: 0 }}>
                {(m.nom || "?")[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nom}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
                {isOwner && m.role !== "owner" ? (
                  <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value as "manager" | "contributor")}
                    style={{ fontSize: 11, fontWeight: 600, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-2)", cursor: "pointer" }}>
                    {SELECT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                ) : (
                  <RoleBadge role={m.role} />
                )}
                {isOwner && m.role !== "owner" && (
                  <button onClick={() => handleRemove(m.id, m.nom)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #fecaca", background: "transparent", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    Retirer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && members && members.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", marginBottom: 14 }}>Aucun membre dans ce projet.</div>
      )}

      {isOwner && (
        <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)} style={{ flex: 2, minWidth: 140, padding: "7px 10px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" }}>
            <option value="">Ajouter un membre</option>
            {availableToAdd.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={addRole} onChange={(e) => setAddRole(e.target.value as "contributor" | "manager")} style={{ flex: 1, minWidth: 120, padding: "7px 10px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" }}>
            {SELECT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button onClick={handleAdd} disabled={!addMemberId || adding} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: !addMemberId || adding ? "var(--bg)" : "var(--accent)", color: !addMemberId || adding ? "var(--text-3)" : "white", fontSize: 12, fontWeight: 700, cursor: !addMemberId || adding ? "not-allowed" : "pointer", flexShrink: 0 }}>
            {adding ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      )}

      {actionError && <div style={{ marginTop: 10, fontSize: 12, color: "#ef4444", padding: "8px 12px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>{actionError}</div>}
    </div>
  );
}
