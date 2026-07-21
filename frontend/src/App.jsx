// frontend/src/App.jsx
// ⚠️  Fichier TRANSVERSAL — Poste A + Poste B
//
// A-03 — isChef propagé à TasksView, ProjectsView, ActivitiesView
// A-04 — Gestion de session : useData(isLogged) + setUnauthorizedHandler
// A-06 — Corrections et notifications backend :
//   • Fix ProjectsView : currentUser={user} transmis (boutons ✏️/🗑️ visibles)
//   • Fix cloche : markAsSeen() appelé au clic sur une difficulté
//   • Notifications persistantes via GET /api/notifications/ :
//       - task_assigned      → responsable notifié à la création d'une tâche
//       - difficulty_reported → chef notifié lors d'un signalement
//       - register_request   → admin(s) notifié(s) lors d'une demande de compte
//   • Cloche visible pour TOUS les utilisateurs connectés
//   • Refresh auto toutes les 30 s + purge 7 jours côté backend

import { useState, useEffect, useRef, useCallback } from "react";
import { LayoutList, GanttChart, Network, FolderOpen, Tag, Users, Zap, Target, FileText, BarChart2, LogOut, Bell, ClipboardList, ChevronDown, User } from "lucide-react";
import { useData } from "./hooks/useData";
import { useAuth } from "./hooks/useAuth";
import { useSeenDifficulties } from "./hooks/useSeenDifficulties";
import * as api from "./api/client";
import { LoginPage } from "./components/auth/LoginPage";
import { TasksView } from "./components/tasks/TasksView";
import { TaskModal } from "./components/tasks/TaskModal";
import { GanttView } from "./components/gantt/GanttView";
import { PERTView } from "./components/pert/PERTView";
import { ProjectsView } from "./components/projects/ProjectsView";
import { ActivitiesView } from "./components/activities/ActivitiesView";
import { TeamView } from "./components/team/TeamView";
import { NeedsView } from "./components/needs/NeedsView";
import { NotesView } from "./components/notes/NotesView";
import { PerformanceView } from "./components/performance/PerformanceView";
import { DailyOrderView } from "./components/daily/DailyOrderView";
import { ReportsView } from "./components/reports/ReportsView";

const TABS = [
  { id: "tasks",       label: "Tâches",       Icon: LayoutList   },
  { id: "gantt",       label: "Gantt",         Icon: GanttChart   },
  { id: "pert",        label: "PERT",          Icon: Network      },
  { id: "projects",    label: "Projets",       Icon: FolderOpen   },
  { id: "activities",  label: "Activités",     Icon: Tag          },
  { id: "needs",       label: "Besoins",       Icon: Target       },
  { id: "performance", label: "Performances",  Icon: BarChart2    },
  { id: "reports",     label: "Rapports",      Icon: FileText     },
  { id: "team",        label: "Équipe",        Icon: Users        },
];

// Icône et libellé par type de notification
function notifMeta(type) {
  switch (type) {
    case "task_assigned":       return { icon: "📋", label: "Affectation" };
    case "difficulty_reported": return { icon: "⚠️",  label: "Difficulté" };
    case "register_request":    return { icon: "👤",  label: "Demande de compte" };
    default:                    return { icon: "🔔",  label: "Notification" };
  }
}

export default function App() {
  const { token, user, isAdmin, isChef, isLogged, login, logout } = useAuth();
  const { markAsSeen, hasUnseen, totalUnseen }                    = useSeenDifficulties();

  const [tab, setTab]         = useState("tasks");
  const [modal, setModal]     = useState(null);
  const [filters, setFilters] = useState({
    project: "all", member: "all", status: "all",
    priority: "all", period: "all",
    date_from: null, date_to: null, single_date: null,
    show_overdue: false, show_critical: false, show_archived: false,
    search: "",
  });
  const [diffCounts, setDiffCounts] = useState({});
  const [showBell, setShowBell]     = useState(false);
  const bellRef = useRef(null);
  useEffect(() => {
    if (!showBell) return;
    const onDocClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showBell]);

  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  useEffect(() => {
    if (!showProfile) return;
    const onDocClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showProfile]);

  // A-04 — déconnexion automatique sur 401
  useEffect(() => {
    api.setUnauthorizedHandler(() => logout());
  }, [logout]);

  const {
    tasks, setTasks, projects, setProjects,
    activities, setActivities, members, setMembers,
    needs, setNeeds, notes, setNotes,
    loading, error, memberColor, pert,
  } = useData(isLogged);

  // ── Notifications backend (A-06) ─────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch { /* silencieux — pas bloquant */ }
  }, []);

  useEffect(() => {
    if (!isLogged) return;
    loadNotifications();
    const iv = setInterval(loadNotifications, 30_000); // refresh toutes les 30 s
    return () => clearInterval(iv);
  }, [isLogged, loadNotifications]);

  const unreadNotifs = notifications.filter((n) => !n.read_at);

  const handleNotifClick = async (notif) => {
    if (!notif.read_at) {
      await api.markNotificationRead(notif.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n)
      );
    }
    if (notif.task_id) {
      const task = tasks.find((t) => t.id === notif.task_id);
      if (task) { setModal({ mode: "edit", task }); setTab("tasks"); }
    }
    setShowBell(false);
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
  };

  // ── Compteurs de difficultés (admin + chef uniquement) ───────────────────
  const canSeeNotifications = isAdmin || isChef;

  useEffect(() => {
    if (!canSeeNotifications || !tasks.length) return;
    const loadCounts = async () => {
      const counts = {};
      await Promise.all(
        tasks.map(async (t) => {
          try {
            const diffs = await api.getDifficulties(t.id);
            if (diffs.length > 0) counts[t.id] = diffs.length;
          } catch { }
        })
      );
      setDiffCounts(counts);
    };
    loadCounts();
  }, [tasks, canSeeNotifications]);

  // Badge = notifs non lues (backend) + difficultés non vues (local, chef/admin)
  const unseenTotal = unreadNotifs.length + (canSeeNotifications ? totalUnseen(diffCounts) : 0);

  // ── Auth guard ───────────────────────────────────────────────────────────
  if (!isLogged) return <LoginPage onLogin={login} />;

  // ── Chargement ───────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)", gap: 12 }}>
      <Zap size={32} color="var(--accent)" />
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>AGT TaskFlow</div>
      <div style={{ fontSize: 13, color: "var(--text-3)" }}>Connexion au serveur…</div>
    </div>
  );

  // ── Erreur ───────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)", gap: 12 }}>
      <div style={{ fontSize: 13, color: "#ef4444", background: "#fef2f2", padding: "12px 20px", borderRadius: 10, border: "1px solid #fecaca" }}>
        Erreur : {error}<br /><small>Vérifiez que le backend Flask est lancé.</small>
      </div>
    </div>
  );

  // ── Filtrage frontend ────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const filtered = tasks.filter((t) => {
    if (!filters.show_archived && t.is_archived) return false;
    if (filters.project  !== "all" && String(t.project_id) !== String(filters.project)) return false;
    if (filters.member   !== "all" && t.responsible !== filters.member) return false;
    if (filters.status   !== "all" && t.status !== filters.status) return false;
    if (filters.priority !== "all" && t.priority !== filters.priority) return false;
    if (filters.show_overdue  && !(t.due_date && t.due_date < today && t.status !== "done")) return false;
    if (filters.show_critical && !(pert.slack[t.id] === 0)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!t.id?.toLowerCase().includes(q) &&
          !t.description?.toLowerCase().includes(q) &&
          !t.project_name?.toLowerCase().includes(q) &&
          !t.activity_name?.toLowerCase().includes(q)) return false;
    }
    if (filters.single_date) {
      const s = t.start_date, e = t.end_date || t.due_date;
      if (s && s > filters.single_date) return false;
      if (e && e < filters.single_date) return false;
    } else if (filters.date_from || filters.date_to) {
      const s = t.start_date, e = t.end_date || t.due_date;
      if (s && filters.date_to   && s > filters.date_to)   return false;
      if (e && filters.date_from && e < filters.date_from) return false;
    }
    return true;
  });

  const critCount = tasks.filter((t) => pert.slack[t.id] === 0).length;

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  const onSaveTask = async (f) => {
    const payload = {
      ...f,
      project_id:  f.project_id  ? Number(f.project_id)  : null,
      activity_id: f.activity_id ? Number(f.activity_id) : null,
    };
    if (modal.mode === "add") {
      const t = await api.createTask(payload);
      setTasks((prev) => [...prev, t]);
      await loadNotifications(); // rafraîchit si le backend a créé une notif
    } else {
      const t = await api.updateTask(f.id, payload);
      setTasks((prev) => prev.map((x) => x.id === t.id ? t : x));
    }
    setModal(null);
  };

  const onDeleteTask = async (id) => {
    await api.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id).map((t) => ({
      ...t, dependencies: (t.dependencies || []).filter((d) => d !== id)
    })));
  };

  const onStatusChange = async (id, status) => {
    const t = await api.updateTask(id, { status });
    setTasks((prev) => prev.map((x) => x.id === t.id ? t : x));
  };

  const onArchiveTask = async (id) => {
    const t = await api.archiveTask(id);
    setTasks((prev) => prev.map((x) => x.id === t.id ? t : x));
  };

  const onUnarchiveTask = async (id) => {
    const t = await api.unarchiveTask(id);
    setTasks((prev) => prev.map((x) => x.id === t.id ? t : x));
  };

  const onAddProject    = async (d) => { const p = await api.createProject(d);         setProjects((prev) => [...prev, p]); };
  const onUpdateProject = async (id, d) => { const p = await api.updateProject(id, d); setProjects((prev) => prev.map((x) => x.id === id ? p : x)); };
  const onDeleteProject = async (id) => { await api.deleteProject(id); setProjects((prev) => prev.filter((p) => p.id !== id)); };
  const onSetChef       = async (id, chefId) => { const p = await api.setProjectChef(id, chefId); setProjects((prev) => prev.map((x) => x.id === id ? p : x)); };

  const onAddActivity    = async (d) => { const a = await api.createActivity(d);         setActivities((prev) => [...prev, a]); };
  const onUpdateActivity = async (id, d) => { const a = await api.updateActivity(id, d); setActivities((prev) => prev.map((x) => x.id === id ? a : x)); };
  const onDeleteActivity = async (id) => { await api.deleteActivity(id);                 setActivities((prev) => prev.filter((a) => a.id !== id)); };

  const onAddMember    = async (d) => { const m = await api.createMember(d);    setMembers((prev) => [...prev, m]); };
  const onDeleteMember = async (id) => { await api.deleteMember(id); setMembers((prev) => prev.filter((m) => m.id !== id)); };
  const onSetMemberRole = async (id, role) => { const m = await api.setMemberRole(id, role); setMembers((prev) => prev.map((x) => x.id === id ? { ...x, ...m } : x)); };

  const onAddNeed    = async (d) => { const n = await api.createNeed(d);         setNeeds((prev) => [...prev, n]); };
  const onUpdateNeed = async (id, d) => { const n = await api.updateNeed(id, d); setNeeds((prev) => prev.map((x) => x.id === id ? n : x)); };
  const onDeleteNeed = async (id) => { await api.deleteNeed(id);                 setNeeds((prev) => prev.filter((n) => n.id !== id)); };

  const onAddNote    = async (d) => { const n = await api.createNote(d);         setNotes((prev) => [...prev, n]); };
  const onUpdateNote = async (id, d) => { const n = await api.updateNote(id, d); setNotes((prev) => prev.map((x) => x.id === id ? n : x)); };
  const onDeleteNote = async (id) => { await api.deleteNote(id);                 setNotes((prev) => prev.filter((n) => n.id !== id)); };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* Header */}
      <div style={{
        background: "var(--bg-card)", borderBottom: "1px solid var(--border)",
        padding: "0 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 52,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <nav style={{ display: "flex", gap: 2, overflowX: "auto" }}>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 12,
              fontWeight: tab === id ? 700 : 400,
              background: tab === id ? "var(--accent-bg)" : "transparent",
              color: tab === id ? "var(--accent)" : "var(--text-2)",
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-3)" }}>
            <span>{tasks.length} tâche{tasks.length !== 1 ? "s" : ""}</span>
            {critCount > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "var(--danger-bg)", color: "var(--danger)",
                fontWeight: 700, fontSize: 10, padding: "2px 7px", borderRadius: 20,
              }}>
                {critCount} critique{critCount > 1 ? "s" : ""}
              </span>
            )}
            {critCount === 0 && tasks.length > 0 && <span style={{ color: "var(--success)" }}>✓ OK</span>}
          </div>
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />

          {/* Cloche — A-06 : visible pour tous les utilisateurs connectés */}
          <div ref={bellRef} style={{ position: "relative" }}>
            <button onClick={() => setShowBell((v) => !v)} style={{
              position: "relative",
              background: unseenTotal > 0 ? "#fff7ed" : "var(--bg)",
              border: `1px solid ${unseenTotal > 0 ? "#fed7aa" : "var(--border)"}`,
              borderRadius: 8, padding: "6px 9px", cursor: "pointer",
              color: unseenTotal > 0 ? "#ea580c" : "var(--text-2)",
              display: "flex", alignItems: "center",
            }}>
              <Bell size={14} />
              {unseenTotal > 0 && (
                <span style={{
                  position: "absolute", top: -3, right: -3,
                  background: "var(--danger)", color: "white",
                  borderRadius: "50%", minWidth: 15, height: 15,
                  fontSize: 9, fontWeight: 700, lineHeight: "15px",
                  textAlign: "center", padding: "0 1px",
                  border: "1.5px solid var(--bg-card)",
                }}>
                  {unseenTotal > 9 ? "9+" : unseenTotal}
                </span>
              )}
            </button>

            {showBell && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)",
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 12, boxShadow: "var(--shadow-md)",
                minWidth: 300, maxWidth: 360, zIndex: 200, overflow: "hidden",
              }}>

                {/* Section difficultés — admin / chef uniquement (local tracking) */}
                {canSeeNotifications && (
                  <>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                      Signalements en cours
                    </div>
                    {Object.entries(diffCounts).filter(([tid, count]) => hasUnseen(tid, count)).length === 0 ? (
                      <div style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
                        Aucun signalement non lu ✓
                      </div>
                    ) : (
                      Object.entries(diffCounts)
                        .filter(([tid, count]) => hasUnseen(tid, count))
                        .map(([tid, count]) => {
                          const task = tasks.find((t) => t.id === tid);
                          return (
                            <div
                              key={tid}
                              onClick={() => {
                                markAsSeen(tid, count);
                                setModal({ mode: "edit", task });
                                setShowBell(false);
                                setTab("tasks");
                              }}
                              style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                            >
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{tid}</div>
                                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{task?.description?.slice(0, 40)}…</div>
                              </div>
                              <span style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700, color: "#ea580c" }}>
                                {count} ⚠️
                              </span>
                            </div>
                          );
                        })
                    )}
                  </>
                )}

                {/* Section notifications backend — tous les utilisateurs */}
                <div style={{
                  padding: "12px 16px",
                  borderTop: canSeeNotifications ? "1px solid var(--border)" : "none",
                  borderBottom: notifications.length > 0 ? "1px solid var(--border)" : "none",
                  fontSize: 12, fontWeight: 700, color: "var(--text)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span>Notifications</span>
                  {unreadNotifs.length > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{ fontSize: 10, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div style={{ padding: "20px 16px", fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
                    Aucune notification cette semaine
                  </div>
                ) : (
                  <div style={{ maxHeight: 280, overflowY: "auto" }}>
                    {notifications.map((n) => {
                      const { icon, label } = notifMeta(n.type);
                      const isNew = !n.read_at;
                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          style={{
                            padding: "10px 16px",
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            background: isNew ? "#f0f9ff" : "transparent",
                            display: "flex", gap: 10, alignItems: "flex-start",
                          }}
                        >
                          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{n.title}</span>
                              {isNew && (
                                <span style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 700, color: "#2563eb", flexShrink: 0 }}>
                                  Nouveau
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.4 }}>{n.body}</div>
                            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3, opacity: 0.7 }}>
                              {label} · {new Date(n.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div ref={profileRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowProfile((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: showProfile ? "var(--accent-bg)" : "transparent",
                border: `1px solid ${showProfile ? "var(--accent)" : "transparent"}`,
                borderRadius: 10, padding: "5px 10px", cursor: "pointer",
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: "50%", background: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", flexShrink: 0,
              }}>
                <User size={14} />
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                  {user?.name}
                  {isAdmin && <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent)", color: "white", borderRadius: 4, padding: "1px 6px" }}>ADMIN</span>}
                  {!isAdmin && user?.role === "chef_projet" && <span style={{ fontSize: 10, fontWeight: 700, background: "#0ea5e9", color: "white", borderRadius: 4, padding: "1px 6px" }}>CHEF</span>}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-2)" }}>{user?.email}</div>
              </div>
              <ChevronDown size={13} color="var(--text-3)" style={{ transform: showProfile ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>

            {showProfile && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)",
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 14, boxShadow: "var(--shadow-md)",
                minWidth: 260, zIndex: 200, overflow: "hidden",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 14px" }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", background: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 18, fontWeight: 800, flexShrink: 0,
                  }}>
                    {(user?.name || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                      {user?.name}
                      {isAdmin && <span style={{ fontSize: 9, fontWeight: 700, background: "var(--accent)", color: "white", borderRadius: 4, padding: "1px 6px" }}>ADMIN</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user?.email}
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--border)" }} />

                <div style={{ padding: 6 }}>
                  <button
                    onClick={() => { setTab("daily"); setShowProfile(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "9px 10px", borderRadius: 8, border: "none",
                      background: tab === "daily" ? "var(--accent-bg)" : "transparent",
                      color: tab === "daily" ? "var(--accent)" : "var(--text)",
                      fontWeight: tab === "daily" ? 700 : 400,
                      fontSize: 13, cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <ClipboardList size={14} /> Ma journée
                  </button>
                  <button
                    onClick={() => { setTab("notes"); setShowProfile(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "9px 10px", borderRadius: 8, border: "none",
                      background: tab === "notes" ? "var(--accent-bg)" : "transparent",
                      color: tab === "notes" ? "var(--accent)" : "var(--text)",
                      fontWeight: tab === "notes" ? 700 : 400,
                      fontSize: 13, cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <FileText size={14} /> Notes
                  </button>

                  <div style={{ height: 1, background: "var(--border)", margin: "6px 4px" }} />

                  <button
                    onClick={() => { setShowProfile(false); setConfirmLogout(true); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "9px 10px", borderRadius: 8, border: "none",
                      background: "transparent", color: "var(--danger)",
                      fontWeight: 600, fontSize: 13, cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <LogOut size={14} /> Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ padding: 20, maxWidth: 1440, margin: "0 auto" }}>
        {tab === "tasks"       && <TasksView tasks={filtered} projects={projects} activities={activities} members={members} pert={pert} filters={filters} setFilters={setFilters} memberColor={memberColor} onAdd={() => setModal({ mode: "add" })} onEdit={(t) => setModal({ mode: "edit", task: t })} onDelete={onDeleteTask} onArchive={onArchiveTask} onUnarchive={onUnarchiveTask} onStatusChange={onStatusChange} isAdmin={isAdmin} currentUser={user} />}
        {tab === "gantt"       && <GanttView tasks={filtered} projects={projects} members={members} pert={pert} filters={filters} setFilters={setFilters} memberColor={memberColor} />}
        {tab === "pert"        && <PERTView tasks={filtered} projects={projects} pert={pert} filters={filters} setFilters={setFilters} members={members} />}
        {tab === "daily"       && <DailyOrderView tasks={tasks} members={members} user={user} isAdmin={isAdmin} isChef={isChef} />}
        {/* A-06 : currentUser={user} — fix boutons ✏️/🗑️ pour le chef propriétaire */}
        {tab === "projects"    && <ProjectsView projects={projects} members={members} onAdd={onAddProject} onUpdate={onUpdateProject} onDelete={onDeleteProject} onSetChef={onSetChef} isAdmin={isAdmin} isChef={isChef} currentUser={user} />}
        {tab === "activities"  && <ActivitiesView activities={activities} projects={projects} onAdd={onAddActivity} onUpdate={onUpdateActivity} onDelete={onDeleteActivity} isAdmin={isAdmin} />}
        {tab === "needs"       && <NeedsView needs={needs} projects={projects} activities={activities} onAdd={onAddNeed} onUpdate={onUpdateNeed} onDelete={onDeleteNeed} />}
        {tab === "notes"       && <NotesView notes={notes} projects={projects} activities={activities} tasks={tasks} user={user} onAdd={onAddNote} onUpdate={onUpdateNote} onDelete={onDeleteNote} />}
        {tab === "performance" && <PerformanceView members={members} />}
        {tab === "reports"     && <ReportsView members={members} projects={projects} user={user} isAdmin={isAdmin} isChef={isChef} />}
        {tab === "team"        && <TeamView members={members} onAdd={onAddMember} onDelete={onDeleteMember} onSetMemberRole={onSetMemberRole} isAdmin={isAdmin} />}
      </div>

      {modal && (
        <TaskModal
          mode={modal.mode} initial={modal.task} tasks={tasks} members={members}
          projects={projects} activities={activities} onSave={onSaveTask}
          onStatusChange={onStatusChange}
          onClose={() => setModal(null)}
          isAdmin={isAdmin} currentUser={user}
        />
      )}

      {confirmLogout && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500,
        }} onClick={() => setConfirmLogout(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)", borderRadius: 14, padding: 24,
              width: 340, boxShadow: "var(--shadow-md)", border: "1px solid var(--border)",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
              Se déconnecter ?
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-2)" }}>
              Tu devras te reconnecter pour accéder à ton compte.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmLogout(false)}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text-2)", fontWeight: 600,
                  fontSize: 13, cursor: "pointer",
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => { setConfirmLogout(false); logout(); }}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: "var(--danger)", color: "white", fontWeight: 700,
                  fontSize: 13, cursor: "pointer",
                }}
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}