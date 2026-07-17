import { useState, useEffect } from "react";
import { Trash2, Check, X, Clock } from "lucide-react";
import * as api from "../../api/client";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export function TeamView({ members, onAdd, onDelete, onSetMemberRole, isAdmin }) {
  const [pending, setPending] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const loadPending = async () => {
    if (!isAdmin) return;
    try {
      const rows = await api.getPendingMembers();
      setPending(rows);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { loadPending(); }, [isAdmin]);

  const decide = async (id, action) => {
    setBusyId(id); setErr(null);
    try {
      await api.validateMember(id, action);
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  const changeRole = async (id, role) => {
    setErr(null);
    try { await onSetMemberRole(id, role); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Équipe</h2>

      {isAdmin && pending.length > 0 && (
        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid #fed7aa", overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: 20 }}>
          <div style={{ padding: "12px 16px", background: "#fff7ed", borderBottom: "1px solid #fed7aa", fontSize: 10, fontWeight: 700, color: "#ea580c", letterSpacing: ".1em", display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={12} /> DEMANDES EN ATTENTE ({pending.length})
          </div>
          {pending.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                {p.name[0]?.toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
              </div>
              <button onClick={() => decide(p.id, "approve")} disabled={busyId === p.id} title="Valider"
                style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "6px 10px", cursor: busyId === p.id ? "not-allowed" : "pointer", color: "#16a34a", display: "flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 12 }}>
                <Check size={13} /> Valider
              </button>
              <button onClick={() => setConfirm({ title: "Rejeter la demande", message: `La demande de compte de ${p.name} sera rejetée. La personne ne pourra pas se connecter.`, confirmLabel: "Rejeter", danger: true, onConfirm: () => decide(p.id, "reject") })} disabled={busyId === p.id} title="Rejeter"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 10px", cursor: busyId === p.id ? "not-allowed" : "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {err && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#ef4444", fontSize: 13 }}>{err}</div>
      )}

      <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
        <div style={{ padding: "12px 16px", background: "var(--bg-hover)", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".1em" }}>
          MEMBRES ({members.length})
        </div>
        {members.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
            <div>Aucun membre pour l'instant.</div>
          </div>
        )}
        {members.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
              {m.name[0]?.toUpperCase() || "?"}
            </div>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{m.name}</span>
            {isAdmin && !(m.is_admin || m.role === "admin") ? (
              <select value={m.role === "chef_projet" ? "chef_projet" : "membre"} onChange={(e) => changeRole(m.id, e.target.value)} title="Rôle"
                style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", fontSize: 12, color: "var(--text)", background: "var(--bg)", cursor: "pointer", fontWeight: m.role === "chef_projet" ? 600 : 400 }}>
                <option value="membre">Membre</option>
                <option value="chef_projet">Chef de projet</option>
              </select>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                {(m.is_admin || m.role === "admin") ? "Admin" : m.role === "chef_projet" ? "Chef de projet" : "Membre"}
              </span>
            )}
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: m.color, border: "2px solid var(--border)" }} />
            <button onClick={() => setConfirm({ title: "Retirer le membre", message: `${m.name} sera retiré de l'équipe. Cette action est irréversible.`, confirmLabel: "Retirer", danger: true, onConfirm: () => onDelete(m.id) })}
              style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog data={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
