"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Port fidèle de frontend/src/components/team/TeamView.jsx (page conteneur).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { TeamView } from "@/components/team/TeamView";
import { useAuth } from "@/lib/auth";
import type { Permission, Role, Utilisateur } from "@/lib/types";

export default function MembresPage() {
  const { user, isLogged, isSuperadmin, hasPermission } = useAuth();
  const router = useRouter();
  const [membres, setMembres] = useState<Utilisateur[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  function load() {
    setLoading(true);
    api.getMembres()
      .then(setMembres)
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les membres")))
      .finally(() => setLoading(false));
    // Catalogue rôles/permissions : réservé au Superadmin (RBAC), inutile
    // pour les autres rôles qui ne peuvent de toute façon rien basculer.
    if (isSuperadmin) {
      api.getRoles().then(setRoles).catch(() => setRoles([]));
      api.getPermissions().then(setPermissions).catch(() => setPermissions([]));
    }
  }
  useEffect(load, [isSuperadmin]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleRole(id: number, roleCode: string, currentlyHas: boolean) {
    if (currentlyHas) await api.revokeRole(id, roleCode);
    else await api.assignRole(id, roleCode);
    load();
  }

  async function togglePermission(id: number, permCode: string, currentlyGranted: boolean) {
    await api.setMemberPermission(id, permCode, !currentlyGranted);
  }

  async function toggleActive(m: Utilisateur) {
    const updated = await api.toggleActive(m.id);
    setMembres((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    return updated;
  }

  async function deleteMembre(id: number) {
    await api.deleteMembre(id);
    setMembres((prev) => prev.filter((m) => m.id !== id));
  }

  async function validate(id: number, action: "approve" | "reject") {
    await api.validateMembre(id, action);
    load();
  }

  return (
    <AppShell>
      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p>
      ) : (
        <TeamView
          members={membres}
          roles={roles}
          permissions={permissions}
          onDelete={deleteMembre}
          onToggleRole={toggleRole}
          onTogglePermission={togglePermission}
          onToggleActive={toggleActive}
          onValidate={validate}
          canValidate={hasPermission("membres.validate")}
          canSuspend={hasPermission("membres.suspend")}
          canManageMembers={hasPermission("membres.write")}
          isSuperadmin={isSuperadmin}
          currentUser={user}
          canSeeSalaire={hasPermission("rh.employes.gerer")}
          canEditFiche={hasPermission("rh.write")}
        />
      )}
    </AppShell>
  );
}
