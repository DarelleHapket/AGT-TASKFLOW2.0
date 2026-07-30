// frontend/src/components/layout/Sidebar.jsx
//
// Sidebar pilotée par configuration : ajouter un futur module (ex. Matériel
// quand S2 sera prêt) se fait en modifiant SIDEBAR_SECTIONS ci-dessous, sans
// toucher au reste du composant. Chaque item peut définir :
//   - id            : correspond à la valeur de `tab` dans App.jsx
//   - label
//   - Icon          : composant icône (lucide-react)
//   - permission    : code de permission requis pour afficher l'item
//                     (absent = toujours visible pour tout utilisateur connecté)
//   - comingSoon    : badge "S2".."S5" + item désactivé (non cliquable)

import {
  LayoutDashboard, Users, FolderOpen, Wallet, UserSquare2,
  Package, FileStack, LayoutList, GanttChart, Tag, Target,
  BarChart2, FileText,
} from "lucide-react";

export const SIDEBAR_SECTIONS = [
  {
    label: "Vue d'ensemble",
    items: [
      { id: "dashboard", label: "Tableau de bord", Icon: LayoutDashboard },
    ],
  },
  {
    label: "Pilotage",
    items: [
      { id: "team",      label: "Membres", sublabel: "(rôles inclus)", Icon: Users, permission: "members.manage" },
      { id: "projects",  label: "Projets", Icon: FolderOpen },
    ],
  },
  {
    label: "Ressources de l'entreprise",
    items: [
      { id: "finances",     label: "Finances",       Icon: Wallet,      comingSoon: "S4" },
      { id: "rh",           label: "RH & Profils",   Icon: UserSquare2, comingSoon: "S3" },
      { id: "materiel",     label: "Matériel",       Icon: Package,     comingSoon: "S2" },
      { id: "documentation",label: "Documentation",  Icon: FileStack,   comingSoon: "S5" },
    ],
  },
  {
    label: "Suivi opérationnel",
    items: [
      { id: "tasks",       label: "Tâches",       Icon: LayoutList },
      { id: "gantt",       label: "PERT / Gantt", Icon: GanttChart },
      { id: "activities",  label: "Activités",    Icon: Tag,       permission: "operations.manage" },
      { id: "needs",       label: "Besoins",      Icon: Target,    permission: "operations.manage" },
      { id: "performance", label: "Performances", Icon: BarChart2, permission: "operations.manage" },
      { id: "reports",     label: "Rapports",     Icon: FileText },
    ],
  },
];

function canSeeItem(item, hasPermission) {
  if (!item.permission) return true;
  return hasPermission(item.permission);
}

export function Sidebar({ activeTab, onTabChange, hasPermission }) {
  return (
    <div style={{
      width: 240, background: "var(--bg-card)", borderRight: "1px solid var(--border)",
      minHeight: "100vh", display: "flex", flexDirection: "column", padding: "20px 0",
      flexShrink: 0,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 20px 20px", fontWeight: 700, fontSize: 16,
        borderBottom: "1px solid var(--border)", marginBottom: 16,
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
              const isActive = activeTab === item.id;
              const isDisabled = !!item.comingSoon;

              return (
                <div
                  key={item.id}
                  onClick={() => !isDisabled && onTabChange(item.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 10,
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isDisabled ? "var(--text-3)" : (isActive ? "var(--accent)" : "var(--text-2)"),
                    background: isActive ? "var(--accent-bg)" : "transparent",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.55 : 1,
                    marginBottom: 2,
                  }}
                >
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
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
