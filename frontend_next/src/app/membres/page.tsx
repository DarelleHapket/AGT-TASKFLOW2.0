"use client";

// Port fidèle de frontend/src/components/team/TeamView.jsx (page conteneur).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { TeamView } from "@/components/team/TeamView";
import { useAuth } from "@/lib/auth";
import type { Utilisateur } from "@/lib/types";

export default function MembresPage() {
  const { user, isLogged, isAdmin, isSuperadmin, hasPermission } = useAuth();
  const router = useRouter();
  const [membres, setMembres] = useState<Utilisateur[]>([]);
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
  }
  useEffect(load, []);

  async function setMemberRole(id: number, role: "membre" | "chef_projet" | "admin") {
    const membre = membres.find((m) => m.id === id);
    const roleActuel = membre?.roles.find((r) => r === "chef_projet" || r === "admin");
    if (roleActuel && roleActuel !== role) await api.revokeRole(id, roleActuel);
    if (role !== "membre") await api.assignRole(id, role);
    load();
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
      {error && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p>
      ) : (
        <TeamView
          members={membres}
          onDelete={deleteMembre}
          onSetMemberRole={setMemberRole}
          onToggleActive={toggleActive}
          onValidate={validate}
          isAdmin={isAdmin}
          isSuperadmin={isSuperadmin}
          currentUser={user}
          canSeeSalaire={hasPermission("rh.employes.gerer")}
          canEditFiche={hasPermission("rh.write")}
        />
      )}
    </AppShell>
  );
}
