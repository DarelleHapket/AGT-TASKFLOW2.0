// frontend/src/components/dashboard/DashboardView.jsx
//
// Tableau de bord adaptatif : chaque section est un composant indépendant
// monté conditionnellement selon les permissions de l'utilisateur connecté
// (jamais selon son nom ou un test de rôle en dur — PI-11). Pour ajouter
// un nouveau widget/section plus tard, créer un composant dans ce dossier
// et le monter ici derrière la permission adéquate, sans toucher au reste.

import { WidgetsGlobaux } from "./WidgetsGlobaux";
import { WidgetsChef, WidgetsMembre } from "./WidgetsPersonnels";
import { WidgetsAVenir } from "./WidgetsAVenir";
import { SectionDemandes } from "./SectionDemandes";
import { SectionMembresRoles } from "./SectionMembresRoles";
import { SectionDatabase } from "./SectionDatabase";
import { SectionMesProjets } from "./SectionMesProjets";

export function DashboardView({
  user, hasPermission, isSuperadmin,
  members, projects, tasks, pendingRequests,
  onValidateRequest, onGoToTeam, onGoToRoles,
  onGetProjectMembers, onAddProjectMember, onUpdateProjectMember, onRemoveProjectMember,
}) {
  const canSeeGlobalWidgets = hasPermission("members.manage") || isSuperadmin;
  const canManageMembers    = hasPermission("members.manage") || isSuperadmin;
  const canManageRoles      = isSuperadmin; // rôles réservés strictement au Superadmin (CdC)
  const canExportDb         = hasPermission("database.export");
  const canImportDb         = hasPermission("database.import");

  const activeMembers = members.filter((m) => m.is_active !== 0 && m.status !== "pending");
  const rolesActifsCount = new Set(activeMembers.map((m) => m.role)).size;

  const myTasks = tasks.filter((t) => t.responsible === user?.name);
  const myProjects = projects.filter((p) =>
    p.chef_id === user?.id || p.owner_id === user?.id || p.user_role === "owner"
  );

  const ROLE_LABELS = {
    superadmin: "Superadmin", admin: "Admin",
    chef_projet: "Chef de projet", membre: "Membre",
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>
        Bienvenue, {user?.name}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 20 }}>
        {canSeeGlobalWidgets
          ? `Vous êtes ${ROLE_LABELS[user?.role] || user?.role} — accès aux ressources de la plateforme`
          : `Vous êtes ${ROLE_LABELS[user?.role] || user?.role} — vos projets, votre équipe et vos tâches`}
      </div>

      {canSeeGlobalWidgets ? (
        <WidgetsGlobaux
          membersActifs={activeMembers.length}
          demandesEnAttente={pendingRequests.length}
          projetsCount={projects.length}
          rolesActifs={rolesActifsCount}
        />
      ) : user?.role === "chef_projet" ? (
        <WidgetsChef
          mesProjets={myProjects.length}
          monEquipe={members.length}
          tachesEnCours={tasks.filter((t) => t.status === "in_progress").length}
          difficultesSignalees={0}
        />
      ) : (
        <WidgetsMembre
          mesTaches={myTasks.length}
          enCours={myTasks.filter((t) => t.status === "in_progress").length}
          terminees={myTasks.filter((t) => t.status === "done").length}
          enRetard={myTasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < new Date().toISOString().slice(0, 10)).length}
        />
      )}

      {canSeeGlobalWidgets && <WidgetsAVenir />}

      {!canSeeGlobalWidgets && user?.role === "chef_projet" && (
        <SectionMesProjets
          projects={myProjects}
          allMembers={members}
          onGetMembers={onGetProjectMembers}
          onAddMember={onAddProjectMember}
          onUpdateMember={onUpdateProjectMember}
          onRemoveMember={onRemoveProjectMember}
        />
      )}

      {canExportDb || canImportDb ? (
        <SectionDatabase canExport={canExportDb} canImport={canImportDb} />
      ) : null}

      {canManageMembers && (
        <SectionDemandes
          demandes={pendingRequests}
          onValidate={onValidateRequest}
          onGoToTeam={onGoToTeam}
        />
      )}

      {canManageMembers && (
        <SectionMembresRoles
          members={members}
          canManage={canManageRoles}
          onManageRoles={onGoToRoles}
        />
      )}
    </div>
  );
}
