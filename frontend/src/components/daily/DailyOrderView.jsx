// frontend/src/components/daily/DailyOrderView.jsx
import { useState, useEffect } from "react";
import { Calendar, ChevronUp, ChevronDown, Plus, Trash2, Clock, Flag } from "lucide-react";
import * as api from "../../api/client";

const PRIORITY_COLOR = { critique: "#ef4444", haute: "#f59e0b", normale: "#64748b" };
const STATUS_LABEL   = { todo: "À faire", in_progress: "En cours", done: "Terminée", blocked: "Bloquée" };
const STATUS_COLOR   = { todo: "#64748b", in_progress: "#3b82f6", done: "#22c55e", blocked: "#ef4444" };

export function DailyOrderView({ tasks, members, user, isAdmin }) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate,   setSelectedDate]   = useState(today);
  const [selectedMember, setSelectedMember] = useState(
    isAdmin ? (members[0]?.id || "") : (members.find((m) => m.name === user?.name)?.id || "")
  );
  const [order,   setOrder]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding,  setAdding]  = useState(false);
  const [addTask, setAddTask] = useState("");

  useEffect(() => {
    if (!selectedMember) return;
    loadOrder();
  }, [selectedMember, selectedDate]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const data = await api.getDailyOrder(selectedMember, selectedDate);
      setOrder(data);
    } catch { setOrder([]); }
    finally { setLoading(false); }
  };

  const saveOrder = async (newOrder) => {
    const tasksList = newOrder.map((item, i) => ({
      task_id: item.task_id, order_index: i, note: item.note || ""
    }));
    await api.setDailyOrderBulk({ member_id: selectedMember, date: selectedDate, tasks: tasksList });
  };

  const moveUp = async (idx) => {
    if (idx === 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrder(next);
    await saveOrder(next);
  };

  const moveDown = async (idx) => {
    if (idx === order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setOrder(next);
    await saveOrder(next);
  };

  const removeItem = async (oid) => {
    await api.deleteDailyOrder(oid);
    setOrder((prev) => prev.filter((o) => o.id !== oid));
  };

  const addToOrder = async () => {
    if (!addTask) return;
    const exists = order.find((o) => o.task_id === addTask);
    if (exists) { setAdding(false); return; }
    try {
      await api.setDailyOrderBulk({
        member_id: selectedMember, date: selectedDate,
        tasks: [...order.map((o, i) => ({ task_id: o.task_id, order_index: i, note: o.note || "" })),
                { task_id: addTask, order_index: order.length, note: "" }]
      });
      await loadOrder();
      setAdding(false); setAddTask("");
    } catch (e) { alert(e.message); }
  };

  const memberTasks = tasks.filter((t) =>
    t.responsible === members.find((m) => String(m.id) === String(selectedMember))?.name
    && t.status !== "done" && !t.is_archived
  );

  const selectedMemberName = members.find((m) => String(m.id) === String(selectedMember))?.name;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
            Ordre du jour
          </h2>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            Tâches prioritaires pour la journée
          </span>
        </div>

        {/* Sélecteurs */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isAdmin && (
            <select value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)}
              style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={14} color="var(--text-3)" />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
          </div>
        </div>
      </div>

      {/* En-tête membre */}
      {selectedMemberName && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "12px 16px", background: "var(--accent-bg)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: members.find((m) => String(m.id) === String(selectedMember))?.color || "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 13 }}>
            {selectedMemberName[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{selectedMemberName}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              {new Date(selectedDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>
            {order.length} tâche{order.length !== 1 ? "s" : ""} planifiée{order.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Liste ordonnée */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>Chargement…</div>
      ) : order.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)", background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Aucune tâche planifiée</div>
          {isAdmin && <div style={{ fontSize: 12 }}>Ajoutez des tâches pour organiser la journée</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {order.map((item, idx) => (
            <div key={item.id} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 12,
              borderLeft: `4px solid ${PRIORITY_COLOR[item.priority] || "#64748b"}`,
            }}>
              {/* Numéro */}
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                {idx + 1}
              </div>

              {/* Infos tâche */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-bg)", padding: "1px 6px", borderRadius: 4 }}>{item.task_id}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{item.description}</span>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-3)" }}>
                  <span>{item.project_name || "—"}</span>
                  <span style={{ color: STATUS_COLOR[item.status] || "#64748b", fontWeight: 600 }}>
                    {STATUS_LABEL[item.status] || item.status}
                  </span>
                  {item.due_date && (
                    <span style={{ color: item.due_date < today ? "#ef4444" : "var(--text-3)" }}>
                      <Clock size={10} style={{ marginRight: 3 }} />
                      {new Date(item.due_date).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                  {item.note && <span style={{ fontStyle: "italic", color: "var(--accent)" }}>💬 {item.note}</span>}
                </div>
              </div>

              {/* Actions — admin uniquement */}
              {isAdmin && (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 6px", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.4 : 1, color: "var(--text-2)", display: "flex", alignItems: "center" }}>
                    <ChevronUp size={13} />
                  </button>
                  <button onClick={() => moveDown(idx)} disabled={idx === order.length - 1} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 6px", cursor: idx === order.length - 1 ? "not-allowed" : "pointer", opacity: idx === order.length - 1 ? 0.4 : 1, color: "var(--text-2)", display: "flex", alignItems: "center" }}>
                    <ChevronDown size={13} />
                  </button>
                  <button onClick={() => removeItem(item.id)} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 6px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ajouter une tâche — admin uniquement */}
      {isAdmin && (
        <div style={{ marginTop: 16 }}>
          {adding ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={addTask} onChange={(e) => setAddTask(e.target.value)}
                style={{ flex: 1, fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <option value="">— Choisir une tâche —</option>
                {memberTasks.filter((t) => !order.find((o) => o.task_id === t.id)).map((t) => (
                  <option key={t.id} value={t.id}>{t.id} — {t.description.slice(0, 50)}</option>
                ))}
              </select>
              <button onClick={addToOrder} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                Ajouter
              </button>
              <button onClick={() => { setAdding(false); setAddTask(""); }} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "var(--text-2)", fontSize: 13 }}>
                Annuler
              </button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-card)", border: "1px dashed var(--border-2)", borderRadius: 12, padding: "12px 20px", cursor: "pointer", color: "var(--text-3)", fontSize: 13, width: "100%", justifyContent: "center" }}>
              <Plus size={14} /> Ajouter une tâche à la journée
            </button>
          )}
        </div>
      )}
    </div>
  );
}