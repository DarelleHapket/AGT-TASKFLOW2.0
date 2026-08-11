"use client";
import { AccessDenied } from "@/components/AccessDenied";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { ProjectsView } from "@/components/projects/ProjectsView";
import { useAuth } from "@/lib/auth";
import type { Projet, Utilisateur } from "@/lib/types";

export default function ProjetsPage() {
  const { isLogged, isChef, isSuperadmin } = useAuth();
  const router = useRouter();
  const [projets, setProjets] = useState<Projet[]>([]);
  const [membres, setMembres] = useState<Utilisateur[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getProjets(), api.getMembres()])
      .then(([p, m]) => {
        setProjets(p);
        // Admin (lecture seule) et Superadmin ne travaillent pas sur les
        // projets : ils ne doivent pas apparaître dans la liste des membres
        // assignables à un projet.
        setMembres(m.filter((x) => x.statut === "ACTIF" && !x.roles.includes("admin") && !x.roles.includes("superadmin")));
      })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les projets")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <AppShell>
      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p>
      ) : (
        <ProjectsView
          projects={projets} members={membres} isChef={isChef} isSuperadmin={isSuperadmin}
          onAdd={async (d) => { await api.createProjet(d); load(); }}
          onUpdate={async (id, d) => { await api.updateProjet(id, d); load(); }}
          onDelete={async (id) => { await api.deleteProjet(id); load(); }}
          onGetProjectMembers={api.getMembresProjet}
          onAddProjectMember={api.addMembreProjet}
          onUpdateProjectMember={api.updateMembreProjet}
          onRemoveProjectMember={api.removeMembreProjet}
        />
      )}
    </AppShell>
  );
}
