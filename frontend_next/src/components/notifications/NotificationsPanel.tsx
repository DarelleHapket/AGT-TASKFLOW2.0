"use client";

// Port fidèle de frontend/src/components/notifications/NotificationsPanel.jsx
// — même structure, mêmes styles inline, même logique de groupement/filtres.
// Champs adaptés au sérialiseur Django (titre/corps/lu_le/cree_le au lieu de
// title/body/read_at/created_at) sans changer l'apparence ni le comportement.
import { useEffect, useState } from "react";
import { X, CheckCheck, Bell } from "lucide-react";
import type { Notification } from "@/lib/types";

function notifMeta(type: string) {
  switch (type) {
    case "task_assigned":
    case "taches.assignation":
      return { icon: "📋", label: "Affectation", color: "#2563eb", bg: "#dbeafe", border: "#93c5fd" };
    case "difficulty_reported":
      return { icon: "⚠️", label: "Difficulté", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" };
    case "register_request":
      return { icon: "👤", label: "Demande de compte", color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" };
    default:
      return { icon: "🔔", label: "Notification", color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1" };
  }
}

function groupByDay(notifications: Notification[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();

  const groups: Record<string, Notification[]> = { "Aujourd'hui": [], "Hier": [], "Cette semaine": [] };

  notifications.forEach((n) => {
    const d = new Date(n.cree_le).toDateString();
    if (d === today) groups["Aujourd'hui"].push(n);
    else if (d === yesterday) groups["Hier"].push(n);
    else groups["Cette semaine"].push(n);
  });

  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

const FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "task_assigned", label: "📋 Affectations" },
  { key: "difficulty_reported", label: "⚠️ Difficultés" },
  { key: "register_request", label: "👤 Demandes" },
];

interface Props {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onDeleteNotif: (id: number) => void;
  onNotifClick: (n: Notification) => void;
}

export function NotificationsPanel({ notifications, onClose, onMarkRead, onMarkAllRead, onDeleteNotif, onNotifClick }: Props) {
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = filter === "all" ? notifications : notifications.filter((n) => n.type === filter);
  const unreadCount = notifications.filter((n) => !n.lu_le).length;
  const groups = groupByDay(filtered);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 300 }} />

      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: "100vw",
        background: "var(--bg-card)", borderLeft: "1px solid var(--border)",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.12)", zIndex: 301,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={16} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Notifications</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""} · 7 derniers jours` : "Tout est à jour · 7 derniers jours"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead} title="Tout marquer comme lu" style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--accent-bg)", border: "1px solid var(--accent)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
                <CheckCheck size={13} /> Tout lire
              </button>
            )}
            <button onClick={onClose} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-3)", display: "flex", alignItems: "center" }}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, padding: "12px 20px", borderBottom: "1px solid var(--border)", overflowX: "auto", flexShrink: 0 }}>
          {FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)} style={{
              padding: "5px 12px", borderRadius: 20, border: "1px solid",
              borderColor: filter === key ? "var(--accent)" : "var(--border)",
              background: filter === key ? "var(--accent-bg)" : "transparent",
              color: filter === key ? "var(--accent)" : "var(--text-2)",
              fontSize: 11, fontWeight: filter === key ? 700 : 400,
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {groups.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--text-3)" }}>
              <div style={{ fontSize: 40 }}>🔕</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>Aucune notification</div>
              <div style={{ fontSize: 12 }}>{filter === "all" ? "Rien sur les 7 derniers jours." : "Aucun élément dans cette catégorie."}</div>
            </div>
          ) : (
            groups.map(([dayLabel, items]) => (
              <div key={dayLabel}>
                <div style={{ padding: "10px 20px 6px", fontSize: 10, fontWeight: 800, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase", position: "sticky", top: 0, background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
                  {dayLabel}
                </div>
                {items.map((n) => {
                  const { icon, label, color, bg, border } = notifMeta(n.type);
                  const isNew = !n.lu_le;
                  return (
                    <div
                      key={n.id}
                      onClick={() => { if (!n.lu_le) onMarkRead(n.id); onNotifClick(n); }}
                      style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: isNew ? "#f8fbff" : "transparent", display: "flex", gap: 12, alignItems: "flex-start" }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: isNew ? 700 : 500, color: "var(--text)", lineHeight: 1.3 }}>{n.titre}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {isNew && (
                              <span style={{ background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: "1px 7px", fontSize: 9, fontWeight: 800, color, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                Nouveau
                              </span>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); onDeleteNotif(n.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2, fontSize: 12, lineHeight: 1 }} title="Supprimer">🗑</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.45, marginBottom: 5 }}>{n.corps}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: "1px 6px" }}>{label}</span>
                          <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                            {new Date(n.cree_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                            {new Date(n.cree_le).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </span>
                          {n.sender_name && <span style={{ fontSize: 10, color: "var(--text-3)" }}>· de <strong>{n.sender_name}</strong></span>}
                        </div>
                      </div>
                      {isNew && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, marginTop: 4 }} />}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
