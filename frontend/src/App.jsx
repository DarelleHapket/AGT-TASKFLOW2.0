// frontend/src/App.jsx
// ⚠️  Fichier TRANSVERSAL — Poste A + Poste B
//
// A-03 — B-04 : isChef={isChef} ajouté sur <TaskModal>
//              isChef propagé à <TasksView>, <ProjectsView>, <ActivitiesView>
//
// A-04 — Bugfix gestion de session (D-07) :
//   • useData() reçoit désormais isLogged en argument, pour ne charger les
//     données qu'une fois l'utilisateur authentifié (corrige le "token
//     invalide" affiché au tout premier login, avant correctif résolu
//     seulement par un rafraîchissement manuel).
//   • api.setUnauthorizedHandler(logout) enregistré au montage : tout 401
//     reçu par n'importe quel appel API déclenche désormais une déconnexion
//     propre et un retour à l'écran de login, au lieu de laisser
//     l'utilisateur bloqué sur une session expirée indéfiniment.

import { useState, useEffect } from "react";
import { LayoutList, GanttChart, Network, FolderOpen, Tag, Users, Zap, Target, FileText, BarChart2, LogOut, Bell, ClipboardList } from "lucide-react";
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
  { id: "daily",       label: "Ma journée",    Icon: ClipboardList },
  { id: "projects",    label: "Projets",       Icon: FolderOpen   },
  { id: "activities",  label: "Activités",     Icon: Tag          },
  { id: "needs",       label: "Besoins",       Icon: Target       },
  { id: "notes",       label: "Notes",         Icon: FileText     },
  { id: "performance", label: "Performances",  Icon: BarChart2    },
  { id: "reports",     label: "Rapports",      Icon: FileText     },
  { id: "team",        label: "Équipe",        Icon: Users        },
];

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

  // A-04 (D-07) : enregistre le handler de déconnexion automatique dès le
  // montage. N'importe quel appel API recevant un 401 (token absent, invalide
  // ou expiré) déclenchera logout(), qui renvoie proprement vers LoginPage.
  useEffect(() => {
    api.setUnauthorizedHandler(() => logout());
  }, [logout]);

  const {
    tasks, setTasks, projects, setProjects,
    activities, setActivities, members, setMembers,
    needs, setNeeds, notes, setNotes,
    loading, error, memberColor, pert,
  } = useData(isLogged); // A-04 (D-07) : ne charge qu'une fois authentifié

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

  const unseenTotal = canSeeNotifications ? totalUnseen(diffCounts) : 0;

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
    const t = await api.updateTask(id, { status }); // payload minimal : le backend ignore le reste en mode status_only
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
  const onDeleteProject = async (id) => { await api.deleteProject(id);                 setProjects((prev) => prev.filter((p) => p.id !== id)); };

  const onAddActivity    = async (d) => { const a = await api.createActivity(d);         setActivities((prev) => [...prev, a]); };
  const onUpdateActivity = async (id, d) => { const a = await api.updateActivity(id, d); setActivities((prev) => prev.map((x) => x.id === id ? a : x)); };
  const onDeleteActivity = async (id) => { await api.deleteActivity(id);                 setActivities((prev) => prev.filter((a) => a.id !== id)); };

  const onAddMember    = async (d) => { const m = await api.createMember(d);    setMembers((prev) => [...prev, m]); };
  const onDeleteMember = async (id) => { await api.deleteMember(id);            setMembers((prev) => prev.filter((m) => m.id !== id)); };

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
          <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
            <span style={{ color: "var(--text-3)" }}>{tasks.length} tâche{tasks.length !== 1 ? "s" : ""}</span>
            {critCount > 0 && <span style={{ color: "#ef4444", fontWeight: 700 }}>● {critCount} critique{critCount > 1 ? "s" : ""}</span>}
            {critCount === 0 && tasks.length > 0 && <span style={{ color: "#22c55e", fontWeight: 600 }}>✓ OK</span>}
          </div>
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />

          {/* Cloche */}
          {canSeeNotifications && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowBell((v) => !v)} style={{
                background: unseenTotal > 0 ? "#fff7ed" : "var(--bg)",
                border: `1px solid ${unseenTotal > 0 ? "#fed7aa" : "var(--border)"}`,
                borderRadius: 8, padding: "5px 9px", cursor: "pointer",
                color: unseenTotal > 0 ? "#ea580c" : "var(--text-2)",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <Bell size={14} />
                {unseenTotal > 0 && (
                  <span style={{ background: "#ea580c", color: "white", borderRadius: 10, fontSize: 10, fontWeight: 800, padding: "1px 5px" }}>
                    {unseenTotal}
                  </span>
                )}
              </button>
              {showBell && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)",
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 12, boxShadow: "var(--shadow-md)",
                  minWidth: 280, maxWidth: 340, zIndex: 200, overflow: "hidden",
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                    Signalements non lus
                  </div>
                  {Object.entries(diffCounts).filter(([tid, count]) => hasUnseen(tid, count)).length === 0 ? (
                    <div style={{ padding: "20px 16px", fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>Aucun signalement non lu ✓</div>
                  ) : (
                    Object.entries(diffCounts).filter(([tid, count]) => hasUnseen(tid, count)).map(([tid, count]) => {
                      const task = tasks.find((t) => t.id === tid);
                      return (
                        <div key={tid} onClick={() => { setModal({ mode: "edit", task }); setShowBell(false); setTab("tasks"); }}
                          style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                </div>
              )}
            </div>
          )}

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
              {user?.name}
              {isAdmin && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: "var(--accent)", color: "white", borderRadius: 4, padding: "1px 6px" }}>ADMIN</span>}
              {isChef  && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: "#0ea5e9",    color: "white", borderRadius: 4, padding: "1px 6px" }}>CHEF</span>}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-2)" }}>{user?.email}</div>
          </div>
          <button onClick={logout} style={{
            background: "var(--danger-bg)", border: "1px solid #fecaca",
            borderRadius: 8, padding: "5px 9px", cursor: "pointer",
            color: "var(--danger)", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
          }}>
            <LogOut size={12} /> Déco
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ padding: 20, maxWidth: 1440, margin: "0 auto" }}>
        {tab === "tasks" && <TasksView tasks={filtered} projects={projects} activities={activities} members={members} pert={pert} filters={filters} setFilters={setFilters} memberColor={memberColor} onAdd={() => setModal({ mode: "add" })} onEdit={(t) => setModal({ mode: "edit", task: t })} onDelete={onDeleteTask} onArchive={onArchiveTask} onUnarchive={onUnarchiveTask} onStatusChange={onStatusChange} isAdmin={isAdmin} currentUser={user} />}
        {tab === "gantt"       && <GanttView tasks={filtered} projects={projects} members={members} pert={pert} filters={filters} setFilters={setFilters} memberColor={memberColor} />}
        {tab === "pert"        && <PERTView tasks={filtered} projects={projects} pert={pert} filters={filters} setFilters={setFilters} members={members} />}
        {tab === "daily"       && <DailyOrderView tasks={tasks} members={members} user={user} isAdmin={isAdmin} />}
        {tab === "projects"    && <ProjectsView projects={projects} onAdd={onAddProject} onUpdate={onUpdateProject} onDelete={onDeleteProject} isAdmin={isAdmin} isChef={isChef} currentUser={user} />}
        {tab === "activities"  && <ActivitiesView activities={activities} projects={projects} onAdd={onAddActivity} onUpdate={onUpdateActivity} onDelete={onDeleteActivity} isAdmin={isAdmin} isChef={isChef} />}
        {tab === "needs"       && <NeedsView needs={needs} projects={projects} activities={activities} onAdd={onAddNeed} onUpdate={onUpdateNeed} onDelete={onDeleteNeed} />}
        {tab === "notes"       && <NotesView notes={notes} projects={projects} activities={activities} tasks={tasks} onAdd={onAddNote} onUpdate={onUpdateNote} onDelete={onDeleteNote} />}
        {tab === "performance" && <PerformanceView members={members} />}
        {tab === "reports"     && <ReportsView members={members} user={user} isAdmin={isAdmin} />}
        {tab === "team"        && <TeamView members={members} onDelete={onDeleteMember} isAdmin={isAdmin} />}
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
    </div>
  );
}