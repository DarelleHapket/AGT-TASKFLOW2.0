// frontend/src/components/dashboard/SectionMesProjets.jsx
import { useState } from "react";
import { Users } from "lucide-react";
import { ProjectMembersPanel } from "../projects/ProjectMembersPanel";

export function SectionMesProjets({
  projects, allMembers,
  onGetMembers, onAddMember, onUpdateMember, onRemoveMember,
}) {
  const [openPanelId, setOpenPanelId] = useState(null);

  if (projects.length === 0) {
    return (
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18, marginBottom: 16, boxShadow: "var(--shadow)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Mes projets</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "16px 0" }}>
          Vous n'avez encore aucun projet.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 18, marginBottom: 16, boxShadow: "var(--shadow)" }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Mes projets</div>
      {projects.map((project) => (
        <div key={project.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📁</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{project.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                {project.member_count ?? 0} membre{(project.member_count ?? 0) !== 1 ? "s" : ""}
              </div>
            </div>
            <button
              onClick={() => setOpenPanelId(openPanelId === project.id ? null : project.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: openPanelId === project.id ? "var(--accent-bg)" : "transparent", color: openPanelId === project.id ? "var(--accent)" : "var(--text-2)", cursor: "pointer" }}
            >
              <Users size={13} /> Équipe
            </button>
          </div>
          {openPanelId === project.id && (
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
      ))}
    </div>
  );
}
