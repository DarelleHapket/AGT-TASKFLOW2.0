"use client";

// Port fidèle de frontend/src/components/layout/Sidebar.jsx — même structure,
// mêmes libellés, mêmes couleurs (styles inline conservés tels quels).
// Seule différence : onTabChange devient une navigation Next.js (chaque id
// de section correspond à une route /<id>), puisque l'appli d'origine était
// une seule page avec un état `tab` plutôt que des routes.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, FolderOpen, Wallet, UserSquare2,
  Package, LayoutList, GanttChart, Tag, Target,
  BarChart2, FileText, GitBranch, DatabaseBackup,
} from "lucide-react";

interface SidebarItem {
  id: string;
  label: string;
  sublabel?: string;
  Icon: LucideIcon;
  permission?: string;
  comingSoon?: string;
}

interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

// id -> route Next.js
const ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  team: "/membres",
  projects: "/projets",
  tasks: "/taches",
  gantt: "/gantt",
  activities: "/activites",
  needs: "/besoins",
  performance: "/performance",
  reports: "/rapports",
  pilotage: "/pilotage",
  backups: "/admin",
  rh: "/rh",
  recrutement: "/rh/recrutement",
  signalements: "/rh/signalements",
  finances: "/finances",
  bilan: "/finances/bilan",
  previsions: "/finances/previsions",
  materiel: "/materiel",
  materielMouvements: "/materiel/mouvements",
};

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    label: "Vue d'ensemble",
    items: [
      { id: "dashboard", label: "Tableau de bord", Icon: LayoutDashboard },
    ],
  },
  {
    label: "Pilotage",
    items: [
      { id: "team", label: "Membres", sublabel: "(rôles inclus)", Icon: Users, permission: "membres.read" },
      { id: "projects", label: "Projets", Icon: FolderOpen },
    ],
  },
  {
    label: "Ressources de l'entreprise",
    items: [
      { id: "rh", label: "RH & Profils", Icon: UserSquare2, permission: "rh.read" },
      { id: "recrutement", label: "Recrutement", sublabel: "(RH)", Icon: UserSquare2, permission: "rh.recrutement.gerer" },
      { id: "signalements", label: "Signalements", sublabel: "(RH)", Icon: Target, permission: "rh.signalements.traiter" },
      { id: "finances", label: "Finances", Icon: Wallet, permission: "finances.mouvements.gerer" },
      { id: "bilan", label: "Bilan", sublabel: "(finances)", Icon: Wallet, permission: "finances.bilan.voir" },
      { id: "previsions", label: "Prévisions", sublabel: "(finances)", Icon: Target, permission: "finances.previsions.gerer" },
      { id: "materiel", label: "Matériel", Icon: Package, permission: "materiel.read" },
      { id: "materielMouvements", label: "Mouvements", sublabel: "(matériel)", Icon: Package, permission: "materiel.read" },
    ],
  },
  {
    label: "Suivi opérationnel",
    items: [
      { id: "tasks", label: "Tâches", Icon: LayoutList },
      { id: "gantt", label: "PERT / Gantt", Icon: GanttChart },
      { id: "activities", label: "Activités", Icon: Tag, permission: "operations.manage" },
      { id: "needs", label: "Besoins", Icon: Target, permission: "operations.manage" },
      { id: "performance", label: "Performances", Icon: BarChart2, permission: "operations.manage" },
      { id: "reports", label: "Rapports", Icon: FileText },
    ],
  },
  {
    label: "Suivi du stage",
    items: [
      { id: "pilotage", label: "Pilotage", sublabel: "(interne)", Icon: GitBranch, permission: "pilotage.taches.voir_soi" },
    ],
  },
  {
    label: "Administration",
    items: [
      { id: "backups", label: "Sauvegardes", Icon: DatabaseBackup, permission: "database.export" },
    ],
  },
];

function canSeeItem(item: SidebarItem, hasPermission: (code: string) => boolean) {
  if (!item.permission) return true;
  return hasPermission(item.permission);
}

interface SidebarProps {
  hasPermission: (code: string) => boolean;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ hasPermission, open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Fond semi-opaque, mobile/tablette uniquement, pour fermer le tiroir au clic à côté */}
      {open && (
        <div onClick={onClose} className="fixed inset-0 bg-black/40 z-30 lg:hidden" />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-60 flex-shrink-0 -translate-x-full transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${open ? "translate-x-0" : ""}`}
        style={{
          background: "var(--bg-card)", borderRight: "1px solid var(--border)",
          height: "100vh", display: "flex", flexDirection: "column", padding: "20px 0",
          overflowY: "auto",
        }}
      >
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 20px 20px", fontWeight: 700, fontSize: 16,
        borderBottom: "1px solid var(--border)", marginBottom: 16,
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontSize: 16,
        }}>A</div>
        AGT ERP
      </div>

      {SIDEBAR_SECTIONS.map((section) => {
        const visibleItems = section.items.filter((item) => canSeeItem(item, hasPermission));
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.label} style={{ padding: "0 12px", marginBottom: 4 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "var(--text-3)",
              letterSpacing: ".08em", padding: "12px 12px 6px",
            }}>
              {section.label}
            </div>

            {visibleItems.map((item) => {
              const route = ROUTES[item.id];
              const isActive = pathname === route;
              const isDisabled = !!item.comingSoon;

              const content = (
                <>
                  <item.Icon size={15} style={{ flexShrink: 0 }} />
                  <span>
                    {item.label}
                    {item.sublabel && (
                      <span style={{ fontSize: 9, color: "var(--text-3)", marginLeft: 4 }}>
                        {item.sublabel}
                      </span>
                    )}
                  </span>
                  {item.comingSoon && (
                    <span style={{
                      marginLeft: "auto", fontSize: 9, fontWeight: 700,
                      background: "#fff7ed", color: "var(--warning, #f59e0b)",
                      padding: "2px 6px", borderRadius: 20,
                    }}>
                      {item.comingSoon}
                    </span>
                  )}
                </>
              );

              const style: React.CSSProperties = {
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 10,
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isDisabled ? "var(--text-3)" : (isActive ? "var(--accent)" : "var(--text-2)"),
                background: isActive ? "var(--accent-bg)" : "transparent",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.55 : 1,
                marginBottom: 2,
                textDecoration: "none",
              };

              if (isDisabled || !route) {
                return <div key={item.id} style={style}>{content}</div>;
              }
              return (
                <Link key={item.id} href={route} style={style} onClick={onClose}>
                  {content}
                </Link>
              );
            })}
          </div>
        );
      })}
      </div>
    </>
  );
}
