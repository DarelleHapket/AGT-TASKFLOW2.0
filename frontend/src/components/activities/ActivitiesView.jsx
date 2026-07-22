// frontend/src/components/activities/ActivitiesView.jsx
//
// A-05 — Ownership créateur (is_owner)
// A-07 — Mise à jour RBAC :
//   • `is_owner` → `can_edit` (champ renommé côté backend pour refléter
//     que les managers du projet ont aussi le droit d'éditer)
//   • Création réservée owner/manager (géré backend — frontend ne change pas)
//   • Filtre P3 appliqué côté backend (seules les activités des projets dont
//     l'utilisateur est membre sont retournées)

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

// ── Formulaire ───────────────────────────────────────────────────────────────

function ActivityForm({ initial, projects, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [desc, setDesc] = useState(initial?.description || "");
  const [pid,  setPid]  = useState(initial?.project_id ? String(initial.project_id) : "");

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
      <div style={{ flex: 1, minWidth: 140 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
          PROJET
        </label>
        <select style={inp} value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">— Choisir —</option>
          {projects.map((p) => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
          NOM DE L'ACTIVITÉ
        </label>
        <input
          style={inp}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Backend"
          autoFocus
        />
      </div>
      <div style={{ flex: 2, minWidth: 160 }}>
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
          onClick={() => name.trim() && pid && onSave({ name: name.trim(), description: desc.trim(), project_id: Number(pid) })}
          disabled={!name.trim() || !pid}
          style={{
            background: name.trim() && pid ? "var(--accent)" : "var(--bg)",
            border: "none", borderRadius: 8, padding: "7px 16px",
            cursor: name.trim() && pid ? "pointer" : "not-allowed",
            color: name.trim() && pid ? "white" : "var(--text-3)",
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

// ── Vue principale ───────────────────────────────────────────────────────────

export function ActivitiesView({ activities, projects, onAdd, onUpdate, onDelete, isAdmin }) {
  const [adding,    setAdding]    = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [filterPid, setFilterPid] = useState("all");
  const [error,     setError]     = useState(null);

  // Tout non-admin peut tenter de créer (le backend validera les droits)
  const canCreate = !isAdmin;

  const visible = filterPid === "all"
    ? activities
    : activities.filter((a) => String(a.project_id) === filterPid);

  const handleAdd = async (d) => {
    setError(null);
    try {
      await onAdd(d);
      setAdding(false);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 16,
      }}>
        <div>
          <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
            Activités
          </h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {activities.length} activité{activities.length !== 1 ? "s" : ""}
          </span>
        </div>
        {canCreate && (
          <button
            onClick={() => { setAdding(true); setEditing(null); setError(null); }}
            style={{
              background: "var(--accent)", color: "white",
              border: "none", padding: "9px 16px", borderRadius: 10,
              cursor: "pointer", fontWeight: 700, fontSize: 13,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Plus size={15} /> Nouvelle activité
          </button>
        )}
      </div>

      {/* Filtre par projet */}
      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap",
        marginBottom: 14, padding: "10px 14px",
        background: "var(--bg-card)", borderRadius: 10,
        border: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", alignSelf: "center" }}>
          PROJET
        </span>
        {["all", ...projects.map((p) => String(p.id))].map((pid) => {
          const label = pid === "all" ? "Tous" : projects.find((p) => String(p.id) === pid)?.name;
          return (
            <button
              key={pid}
              onClick={() => setFilterPid(pid)}
              style={{
                padding: "3px 12px", borderRadius: 20,
                border: `1.5px solid ${filterPid === pid ? "var(--accent)" : "var(--border)"}`,
                background: filterPid === pid ? "var(--accent)" : "transparent",
                color: filterPid === pid ? "white" : "var(--text-2)",
                cursor: "pointer", fontSize: 11,
                fontWeight: filterPid === pid ? 700 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Erreur */}
      {error && (
        <div style={{
          marginBottom: 12, padding: "10px 14px",
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 8, color: "#dc2626", fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Liste */}
      <div style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        boxShadow: "var(--shadow)",
      }}>
        {canCreate && adding && (
          <ActivityForm
            projects={projects}
            onSave={handleAdd}
            onCancel={() => { setAdding(false); setError(null); }}
          />
        )}

        {visible.length === 0 && !adding && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔖</div>
            <div>Aucune activité{filterPid !== "all" ? " pour ce projet" : ""}.</div>
          </div>
        )}

        {visible.map((a) =>
          canCreate && editing?.id === a.id ? (
            <ActivityForm
              key={a.id}
              initial={a}
              projects={projects}
              onSave={async (d) => {
                setError(null);
                try { await onUpdate(a.id, d); setEditing(null); }
                catch (e) { setError(e.message); }
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div
              key={a.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderBottom: "1px solid var(--border)",
                background: "var(--bg-card)",
              }}
            >
              {/* Icône */}
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "#f0fdf4",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0,
              }}>
                🔖
              </div>

              {/* Infos */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                  {a.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                  📁 {a.project_name}
                  {a.description ? ` · ${a.description}` : ""}
                </div>
              </div>

              {/* Actions — pilotées par `can_edit` (A-07 : owner_id OU manager du projet) */}
              {a.can_edit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setEditing(a)}
                    style={{
                      background: "var(--bg)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "5px 9px", cursor: "pointer",
                      color: "var(--text-2)", display: "flex", alignItems: "center",
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Supprimer l'activité "${a.name}" ?`)) return;
                      setError(null);
                      try { await onDelete(a.id); }
                      catch (e) { setError(e.message); }
                    }}
                    style={{
                      background: "#fef2f2", border: "1px solid #fecaca",
                      borderRadius: 8, padding: "5px 9px", cursor: "pointer",
                      color: "#ef4444", display: "flex", alignItems: "center",
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}