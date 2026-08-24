"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Port fidèle de frontend/src/components/dashboard/DashboardView.jsx.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { WidgetsChef, WidgetsGlobaux, WidgetsMembre, WidgetsRessources } from "@/components/dashboard/Widgets";
import { SectionDemandes } from "@/components/dashboard/SectionDemandes";
import { SectionMembresRoles } from "@/components/dashboard/SectionMembresRoles";
import { SectionDatabase } from "@/components/dashboard/SectionDatabase";
import { SectionMesProjets } from "@/components/dashboard/SectionMesProjets";
import { ROLE_LABELS } from "@/components/rbac/RBACView";
import { useAuth } from "@/lib/auth";
import type { MouvementFinancier, Projet, Tache, Utilisateur } from "@/lib/types";

export default function DashboardPage() {
  const { user, isLogged, isSuperadmin, hasPermission } = useAuth();
  const router = useRouter();
  const [membres, setMembres] = useState<Utilisateur[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [taches, setTaches] = useState<Tache[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rhStats, setRhStats] = useState({ postes: 0, equipes: 0 });
  const [soldeMois, setSoldeMois] = useState<string | null>(null);
  const [mouvementsRecents, setMouvementsRecents] = useState<MouvementFinancier[]>([]);
  const [stockTotal, setStockTotal] = useState<number | null>(null);
  const [alertesOuvertes, setAlertesOuvertes] = useState(0);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  useEffect(() => {
    Promise.all([api.getMembres(), api.getProjets(), api.getTaches()])
      .then(([m, p, t]) => { setMembres(m); setProjets(p); setTaches(t.tasks); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger le tableau de bord")));
  }, []);

  const canRh = hasPermission("rh.read");
  const canFinances = hasPermission("finances.bilan.voir");
  const canMateriel = hasPermission("materiel.read");

  useEffect(() => {
    if (canRh) Promise.all([api.getPostes(), api.getEquipes()]).then(([p, e]) => setRhStats({ postes: p.length, equipes: e.length })).catch(() => {});
  }, [canRh]);

  useEffect(() => {
    if (canMateriel) api.getStock().then((s) => { setStockTotal(s.total); setAlertesOuvertes(s.alertes_ouvertes); }).catch(() => {});
  }, [canMateriel]);

  useEffect(() => {
    if (!canFinances) return;
    const now = new Date();
    const date_from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const date_to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    api.getBilan({ date_from, date_to }).then((b) => { setSoldeMois(b.solde); setMouvementsRecents(b.derniers_mouvements); }).catch(() => {});
  }, [canFinances]);

  if (!user) return null;

  const role = user.roles[0] || "user";
  const canSeeGlobalWidgets = hasPermission("membres.write") || isSuperadmin;
  const canManageMembers = hasPermission("membres.write") || isSuperadmin;
  const canManageRoles = isSuperadmin;
  // Capacité "chef de projet" = permission projets.write (catalogue réduit à
  // 2 rôles, 2026-08-19) — plus un nom de rôle "chef_projet", qui n'existe
  // plus. Bug trouvé le 2026-08-23 : ce fichier comparait encore role ===
  // "chef_projet" directement, jamais vrai depuis la migration -> widget et
  // section "Mes projets" invisibles pour tout le monde.
  const isChefProjet = hasPermission("projets.write");
  const canExportDb = hasPermission("database.export");
  const canImportDb = hasPermission("database.import");

  const enAttente = membres.filter((m) => m.statut === "EN_ATTENTE");
  const activeMembers = membres.filter((m) => m.statut === "ACTIF");
  const rolesActifsCount = new Set(activeMembers.flatMap((m) => m.roles)).size;

  const myTasks = taches.filter((t) => t.responsable === user.id);
  const myProjects = projets.filter((p) => p.user_role === "owner");

  async function traiter(id: number, action: "approve" | "reject") {
    await api.validateMembre(id, action);
    setMembres((prev) => prev.filter((m) => m.id !== id));
  }

  async function getMembresProjet(pid: number) {
    return api.getMembresProjet(pid);
  }
  async function addMembreProjet(pid: number, utilisateur: number, r: "manager" | "contributor") {
    return api.addMembreProjet(pid, utilisateur, r);
  }
  async function updateMembreProjet(pid: number, mid: number, r: "manager" | "contributor") {
    return api.updateMembreProjet(pid, mid, r);
  }
  async function removeMembreProjet(pid: number, mid: number) {
    await api.removeMembreProjet(pid, mid);
  }

  return (
    <AppShell>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Bienvenue, {user.name}</div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 20 }}>
        {canSeeGlobalWidgets
          ? `Vous êtes ${ROLE_LABELS[role] || role} : accès aux ressources de la plateforme`
          : `Vous êtes ${ROLE_LABELS[role] || role} : vos projets, votre équipe et vos tâches`}
      </div>

      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}

      {canSeeGlobalWidgets ? (
        <WidgetsGlobaux membersActifs={activeMembers.length} demandesEnAttente={enAttente.length} projetsCount={projets.length} rolesActifs={rolesActifsCount} />
      ) : isChefProjet ? (
        <WidgetsChef mesProjets={myProjects.length} monEquipe={membres.length} tachesEnCours={taches.filter((t) => t.statut === "in_progress").length} difficultesSignalees={0} />
      ) : (
        <WidgetsMembre
          mesTaches={myTasks.length}
          enCours={myTasks.filter((t) => t.statut === "in_progress").length}
          terminees={myTasks.filter((t) => t.statut === "done").length}
          enRetard={myTasks.filter((t) => t.statut !== "done" && t.date_echeance && t.date_echeance < new Date().toISOString().slice(0, 10)).length}
          userId={user.id}
        />
      )}

      {canSeeGlobalWidgets && (
        <WidgetsRessources canRh={canRh} canFinances={canFinances} canMateriel={canMateriel} postes={rhStats.postes} equipes={rhStats.equipes} soldeMois={soldeMois} stockTotal={stockTotal} alertesOuvertes={alertesOuvertes} />
      )}

      {canSeeGlobalWidgets && canFinances && mouvementsRecents.length > 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "10px 14px", background: "var(--bg-hover)", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em" }}>
            MOUVEMENTS FINANCIERS RÉCENTS
          </div>
          {mouvementsRecents.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{m.type_nom}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>
                  {m.niveau === "projet" ? m.projet_nom : m.niveau === "employe" ? m.employe_nom : "Entreprise"}
                </span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: m.sens === "entree" ? "#16a34a" : "#ef4444" }}>
                {m.sens === "entree" ? "+" : "-"}{m.montant}
              </span>
            </div>
          ))}
        </div>
      )}

      {!canSeeGlobalWidgets && isChefProjet && (
        <SectionMesProjets projects={myProjects} allMembers={membres} onGetMembers={getMembresProjet} onAddMember={addMembreProjet} onUpdateMember={updateMembreProjet} onRemoveMember={removeMembreProjet} />
      )}

      {(canExportDb || canImportDb) && <SectionDatabase canExport={canExportDb} canImport={canImportDb} />}

      {canManageMembers && (
        <SectionDemandes demandes={enAttente.map((m) => ({ id: m.id, name: m.name, email: m.email }))} onValidate={traiter} onGoToTeam={() => router.push("/membres")} canValidate />
      )}

      {canManageMembers && (
        <SectionMembresRoles members={membres} canManage={canManageRoles} onManageRoles={() => router.push("/rbac")} />
      )}
    </AppShell>
  );
}
