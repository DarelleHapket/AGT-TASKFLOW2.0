// frontend/src/components/projects/ProjectsView.jsx
//
// A-03 — Bug 2 : ownership guard + chef_name
// A-06 — Fix currentUser transmis
// A-07 — Refonte RBAC project_members :
//   • cards enrichies : member_count, user_role badge, chef_name
//   • Boutons ✏️/🗑️ réservés à l'owner (user_role === 'owner')
//   • Bouton "Équipe" : ouvre ProjectMembersPanel inline (tous membres du projet)
//   • Bouton "Nouveau projet" : chef_projet global uniquement

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp, Users } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ProjectMembersPanel } from "./ProjectMembersPanel";

// ── Badges rôle projet ───────────────────────────────────────────────────────

const USER_ROLE_META = {
  owner:       { label: "Propriétaire", bg: "#eef2ff", color: "#4338ca" },
  manager:     { label: "Manager",      bg: "#eff6ff", color: "#1d4ed8" },
  contributor: { label: "Contributeur", bg: "#f0fdf4", color: "#15803d" },
};

function UserRoleBadge({ role }) {
  const meta = USER_ROLE_META[role];
  if (!meta) return null;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: ".05em",
      padding: "2px 7px", borderRadius: 5,
      background: meta.bg, color: meta.color,
    }}>
      {meta.label.toUpperCase()}
    </span>
  );
}

// ── Formulaire création / édition ────────────────────────────────────────────

function ProjectForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [desc, setDesc] = useState(initial?.description || "");

  const inp = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: "1.5px solid var(--border)", fontSize: 13,
    background: "var(--bg-card)", color: "var(--text)",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      padding: "14px 16px", background: "var(--accent-bg)",
      borderBottom: "1px solid var(--border)",
      display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
          NOM DU PROJET
        </label>
        <input
          style={inp}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: ERP v2"
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onSave({ name: name.trim(), description: desc.trim() })}
          autoFocus
        />
      </div>
      <div style={{ flex: 2, minWidth: 200 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
          DESCRIPTION
        </label>
        <input
          style={inp}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description optionnelle…"
        />
      </div>
      <div style={{ display: "flex", gap: 8, paddingBottom: 1 }}>
        <button
          onClick={onCancel}
          style={{
            border: "1px solid var(--border)", background: "var(--bg-card)",
            borderRadius: 8, padding: "7px 12px", cursor: "pointer",
            color: "var(--text-2)", display: "flex", alignItems: "center",
          }}
        >
          <X size={14} />
        </button>
        <button
          onClick={() => name.trim() && onSave({ name: name.trim(), description: desc.trim() })}
          disabled={!name.trim()}
          style={{
            background: name.trim() ? "var(--accent)" : "var(--bg)",
            border: "none", borderRadius: 8, padding: "7px 16px",
            cursor: name.trim() ? "pointer" : "not-allowed",
            color: name.trim() ? "white" : "var(--text-3)",
            display: "flex", alignItems: "center", gap: 5,
            fontWeight: 700, fontSize: 13,
          }}
        >
          <Check size={14} /> Enregistrer
        </button>
      </div>
    </div>
  );
}

// ── Carte projet ─────────────────────────────────────────────────────────────

function ProjectCard({
  project, editing, onEdit, onDelete, onStartEdit, onCancelEdit,
  isChef, currentUser,
  panelOpen, onTogglePanel,
  onGetMembers, onAddMember, onUpdateMember, onRemoveMember,
  allMembers,
}) {
  const isOwner      = project.user_role === "owner";
  const isMember     = !!project.user_role;
  const memberCount  = project.member_count ?? 0;

  if (editing) {
    return (
      <ProjectForm
        initial={project}
        onSave={async (d) => { await onEdit(project.id, d); onCancelEdit(); }}
        onCancel={onCancelEdit}
      />
    );
  }

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Ligne principale de la carte */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", background: "var(--bg-card)",
      }}>
        {/* Icône projet */}
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: "var(--accent-bg)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>
          📁
        </div>

        {/* Infos projet */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
              {project.name}
            </span>
            {project.user_role && <UserRoleBadge role={project.user_role} />}
          </div>

          {project.description && (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
              {project.description}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            {project.chef_name && (
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                Chef : <span style={{ fontWeight: 600, color: "var(--text-2)" }}>{project.chef_name}</span>
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              {memberCount} membre{memberCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {/* Bouton Équipe (visible pour tous les membres du projet) */}
          {isMember && (
            <button
              onClick={onTogglePanel}
              title="Équipe du projet"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${panelOpen ? "var(--accent)" : "var(--border)"}`,
                background: panelOpen ? "var(--accent-bg)" : "transparent",
                color: panelOpen ? "var(--accent)" : "var(--text-2)",
                fontSize: 12, fontWeight: 600,
              }}
            >
              <Users size={13} />
              <span style={{ display: "none" }} className="label">Équipe</span>
              {panelOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          {/* Boutons édition / suppression (owner uniquement) */}
          {isOwner && (
            <>
              <button
                onClick={() => onStartEdit(project)}
                style={{
                  background: "var(--bg)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "5px 9px", cursor: "pointer",
                  color: "var(--text-2)", display: "flex", alignItems: "center",
                }}
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onDelete(project)}
                style={{
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 8, padding: "5px 9px", cursor: "pointer",
                  color: "#ef4444", display: "flex", alignItems: "center",
                }}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Panel équipe (slide-down) */}
      {panelOpen && (
        <ProjectMembersPanel
          project={project}
          allMembers={allMembers}
          onGetMembers={onGetMembers}
          onAddMember={onAddMember}
          onUpdateMember={onUpdateMember}
          onRemoveMember={onRemoveMember}
        />
      )}
    </div>
  );
}

// ── Vue principale ───────────────────────────────────────────────────────────

export function ProjectsView({
  projects, members, isAdmin, isChef, currentUser,
  onAdd, onUpdate, onDelete, onSetChef,
  onGetProjectMembers, onAddProjectMember,
  onUpdateProjectMember, onRemoveProjectMember,
}) {
  const [adding,    setAdding]    = useState(false);
  const [editing,   setEditing]   = useState(null);   // project.id en cours d'édition
  const [confirm,   setConfirm]   = useState(null);
  const [openPanel, setOpenPanel] = useState(null);   // project.id dont le panel est ouvert

  const askDelete = (project) => {
    setConfirm({
      title:        "Supprimer le projet",
      message:      `Le projet « ${project.name} » et toutes ses tâches / activités seront supprimés. Action irréversible.`,
      confirmLabel: "Supprimer",
      danger:       true,
      onConfirm:    () => onDelete(project.id),
    });
  };

  const togglePanel = (pid) => {
    setOpenPanel((prev) => prev === pid ? null : pid);
  };

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 16,
      }}>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
            Projets
          </h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {projects.length} projet{projects.length !== 1 ? "s" : ""}
          </span>
        </div>

        {isChef && (
          <button
            onClick={() => { setAdding(true); setEditing(null); }}
            style={{
              background: "var(--accent)", color: "white",
              border: "none", padding: "9px 16px", borderRadius: 10,
              cursor: "pointer", fontWeight: 700, fontSize: 13,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Plus size={15} /> Nouveau projet
          </button>
        )}
      </div>

      {/* Liste */}
      <div style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        boxShadow: "var(--shadow)",
      }}>
        {/* Formulaire de création */}
        {adding && isChef && (
          <ProjectForm
            onSave={async (d) => { await onAdd(d); setAdding(false); }}
            onCancel={() => setAdding(false)}
          />
        )}

        {/* État vide */}
        {projects.length === 0 && !adding && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
            <div>
              {isChef
                ? "Aucun projet. Commencez par en créer un."
                : "Aucun projet auquel vous participez."}
            </div>
          </div>
        )}

        {/* Cartes */}
        {projects.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            editing={editing === p.id}
            onEdit={onUpdate}
            onDelete={askDelete}
            onStartEdit={(proj) => { setEditing(proj.id); setAdding(false); }}
            onCancelEdit={() => setEditing(null)}
            isChef={isChef}
            currentUser={currentUser}
            panelOpen={openPanel === p.id}
            onTogglePanel={() => togglePanel(p.id)}
            allMembers={members}
            onGetMembers={onGetProjectMembers}
            onAddMember={onAddProjectMember}
            onUpdateMember={onUpdateProjectMember}
            onRemoveMember={onRemoveProjectMember}
          />
        ))}
      </div>

      <ConfirmDialog data={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}