// frontend/src/components/projects/ProjectsView.jsx
//
// A-03 — Bug 2 :
//   • currentUser ajouté à la signature et passé à ProjectRow
//   • Boutons ✏️ et 🗑️ visibles uniquement si isChef ET chef du projet
//     (Number(project.chef_id) === Number(currentUser?.id))
//   • Bouton "Nouveau projet" : inchangé (isChef suffit — il en devient chef)

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Crown } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";

function ProjectRow({ project, onEdit, onDelete, isChef, currentUser }) {
  // Bug 2 — ownership : seul le chef DE CE projet voit les boutons d'action
  const isOwner = isChef && Number(project.chef_id) === Number(currentUser?.id);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📁</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{project.name}</div>
        {project.description && (
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{project.description}</div>
        )}
        {project.chef_name && (
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
            👤 Chef : <span style={{ fontWeight: 600, color: "var(--text-2)" }}>{project.chef_name}</span>
          </div>
        )}
      </div>
      {isOwner && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onEdit(project)}
            style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center" }}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => { if (window.confirm(`Supprimer le projet "${project.name}" ?`)) onDelete(project.id); }}
            style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [desc, setDesc] = useState(initial?.description || "");

  return (
    <div style={{ padding: "14px 16px", background: "var(--accent-bg)", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>NOM DU PROJET</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: SALMA"
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onSave({ name: name.trim(), description: desc.trim() })}
        />
      </div>
      <div style={{ flex: 2, minWidth: 200 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>DESCRIPTION</label>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description optionnelle…" />
      </div>
      <div style={{ display: "flex", gap: 8, paddingBottom: 1 }}>
        <button onClick={onCancel} style={{ border: "1px solid var(--border)", background: "white", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: "var(--text-2)", display: "flex", alignItems: "center" }}>
          <X size={14} />
        </button>
        <button
          onClick={() => name.trim() && onSave({ name: name.trim(), description: desc.trim() })}
          style={{ background: "var(--accent)", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: "white", display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 13 }}
        >
          <Check size={14} /> Enregistrer
        </button>
      </div>
    </div>
  );
}

export function ProjectsView({ projects, onAdd, onUpdate, onDelete, isAdmin, isChef, currentUser }) {
  const [adding,  setAdding]  = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const askDelete = (project) => {
    setConfirm({ title: "Supprimer le projet", message: `Le projet « ${project.name} » et son contenu associé seront supprimés. Cette action est irréversible.`, confirmLabel: "Supprimer", danger: true, onConfirm: () => onDelete(project.id) });
  };
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Projets</h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{projects.length} projet{projects.length !== 1 ? "s" : ""}</span>
        </div>
        {isChef && (
          <button
            onClick={() => { setAdding(true); setEditing(null); }}
            style={{ background: "var(--accent)", color: "white", border: "none", padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={15} /> Nouveau projet
          </button>
        )}
      </div>

      <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
        {adding && isChef && (<ProjectForm onSave={async (d) => { await onAdd(d); setAdding(false); }} onCancel={() => setAdding(false)} />)}
        {projects.length === 0 && !adding && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
            <div>Aucun projet{isChef ? ". Commencez par en créer un." : "."}</div>
          </div>
        )}
        {projects.map((p) =>
          isChef && editing?.id === p.id ? (
            <ProjectForm
              key={p.id}
              initial={p}
              onSave={async (d) => { await onUpdate(p.id, d); setEditing(null); }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <ProjectRow
              key={p.id}
              project={p}
              onEdit={setEditing}
              onDelete={onDelete}
              isChef={isChef}
              currentUser={currentUser}
            />
          )
        )}
      </div>
      <ConfirmDialog data={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}