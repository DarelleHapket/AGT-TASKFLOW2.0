"use client";

// Port fidèle de la structure App.jsx (Sidebar + Topbar) — mêmes styles
// inline, même logique (compteur de tâches/critiques, cloche + panneau de
// notifications, menu profil avec badges ADMIN/CHEF et Ma journée/Notes/
// Déconnexion). Seule vraie différence : App.jsx pilotait un `tab` interne
// à une seule page ; ici chaque tab devient une route Next.js, le contenu
// (`children`) correspond à ce qu'affichait App.jsx pour ce tab.
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, ClipboardList, FileText, LogOut, KeyRound, AlertTriangle } from "lucide-react";
import * as api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "./Sidebar";
import { NotificationsPanel } from "@/components/notifications/NotificationsPanel";
import type { Notification, Tache } from "@/lib/types";

const TAB_TITLES: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/taches": "Tâches",
  "/gantt": "Gantt",
  "/pert": "PERT",
  "/projets": "Projets",
  "/activites": "Activités",
  "/besoins": "Besoins",
  "/notes": "Notes",
  "/performance": "Performances",
  "/rapports": "Rapports",
  "/membres": "Membres",
  "/rbac": "Rôles & permissions",
  "/admin": "Sauvegardes",
  "/daily": "Ma journée",
  "/pilotage": "Pilotage du stage",
  "/mon-compte": "Mon compte",
  "/rh": "RH & Profils",
  "/rh/recrutement": "Recrutement",
  "/rh/signalements": "Signalements",
  "/rh/signaler": "Signaler une difficulté",
  "/finances": "Finances",
  "/finances/bilan": "Bilan",
  "/finances/previsions": "Prévisions",
  "/materiel": "Matériel",
  "/materiel/mouvements": "Mouvements de matériel",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLogged, isAdmin, isChef, hasPermission, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [tasks, setTasks] = useState<Tache[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showBell, setShowBell] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!isLogged) return;
    api.getTaches().then((r) => setTasks(r.tasks)).catch(() => {});
    api.getNotifications().then(setNotifications).catch(() => {});
  }, [isLogged]);

  if (!isLogged || !user) return null;

  const critCount = tasks.filter((t) => t.critical).length;
  const unseenTotal = notifications.filter((n) => !n.lu_le).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex" }}>
      <Sidebar hasPermission={hasPermission} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <div style={{
          background: "var(--bg-card)", borderBottom: "1px solid var(--border)",
          padding: "0 24px", display: "flex", alignItems: "center",
          justifyContent: "space-between", height: 60,
          position: "sticky", top: 0, zIndex: 100,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            {TAB_TITLES[pathname] || ""}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
              <span style={{ color: "var(--text-3)" }}>{tasks.length} tâche{tasks.length !== 1 ? "s" : ""}</span>
              {critCount > 0 && <span style={{ color: "#ef4444", fontWeight: 700 }}>● {critCount} critique{critCount > 1 ? "s" : ""}</span>}
              {critCount === 0 && tasks.length > 0 && <span style={{ color: "#22c55e", fontWeight: 600 }}>✓ OK</span>}
            </div>
            <div style={{ width: 1, height: 20, background: "var(--border)" }} />

            {/* Cloche */}
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
                <NotificationsPanel
                  notifications={notifications}
                  onClose={() => setShowBell(false)}
                  onMarkRead={async (id) => { await api.markNotificationRead(id); setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, lu_le: new Date().toISOString() } : n)); }}
                  onMarkAllRead={async () => { await api.markAllNotificationsRead(); setNotifications((prev) => prev.map((n) => ({ ...n, lu_le: new Date().toISOString() }))); }}
                  onDeleteNotif={async (id) => { await api.deleteNotification(id); setNotifications((prev) => prev.filter((n) => n.id !== id)); }}
                  onNotifClick={(n) => { setShowBell(false); router.push(n.type === "register_request" ? "/membres" : "/taches"); }}
                />
              )}
            </div>

            {/* Profil */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowProfile((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "5px 10px", cursor: "pointer" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: user.color || "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 12 }}>
                  {(user.name || "?")[0].toUpperCase()}
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 5 }}>
                    {user.name}
                    {isAdmin && <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent)", color: "white", borderRadius: 4, padding: "1px 6px" }}>ADMIN</span>}
                    {isChef && <span style={{ fontSize: 10, fontWeight: 700, background: "#0ea5e9", color: "white", borderRadius: 4, padding: "1px 6px" }}>CHEF</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-2)" }}>{user.email}</div>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-3)" }}>▾</span>
              </button>
              {showProfile && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-md)", minWidth: 220, zIndex: 200, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: user.color || "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                      {(user.name || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 5 }}>
                        {user.name}
                        {isAdmin && <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent)", color: "white", borderRadius: 4, padding: "1px 6px" }}>ADMIN</span>}
                        {isChef && <span style={{ fontSize: 10, fontWeight: 700, background: "#0ea5e9", color: "white", borderRadius: 4, padding: "1px 6px" }}>CHEF</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{user.email}</div>
                    </div>
                  </div>
                  <button onClick={() => { setShowProfile(false); router.push("/daily"); }} style={{ width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                    <ClipboardList size={14} /> Ma journée
                  </button>
                  <button onClick={() => { setShowProfile(false); router.push("/notes"); }} style={{ width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                    <FileText size={14} /> Notes
                  </button>
                  <button onClick={() => { setShowProfile(false); router.push("/rh/signaler"); }} style={{ width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                    <AlertTriangle size={14} /> Signaler une difficulté
                  </button>
                  <button onClick={() => { setShowProfile(false); router.push("/mon-compte"); }} style={{ width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                    <KeyRound size={14} /> Mon compte
                  </button>
                  <button onClick={() => { logout(); router.push("/login"); }} style={{ width: "100%", padding: "11px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#ef4444" }}>
                    <LogOut size={14} /> Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div style={{ padding: 24, maxWidth: 1440, margin: "0 auto", width: "100%" }}>
          {user.doit_changer_mdp && pathname !== "/mon-compte" && (
            // D-11 (team-tool) assoupli : mot de passe temporaire (recrutement,
            // migration, superadmin par défaut) -> rappel permanent plutôt
            // qu'un blocage total de la navigation, pour laisser le choix du
            // moment tout en gardant le rappel visible tant que ce n'est pas fait.
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, fontSize: 12, color: "#ea580c", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={14} /> Vous utilisez un mot de passe temporaire — pensez à le changer.
              </span>
              <button onClick={() => router.push("/mon-compte")} style={{ background: "none", border: "1px solid #fed7aa", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "#ea580c", fontWeight: 700, fontSize: 11 }}>
                Changer maintenant
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
