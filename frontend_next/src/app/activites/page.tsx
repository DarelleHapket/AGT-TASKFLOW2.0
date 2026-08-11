"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Port fidèle de frontend/src/components/activities/ActivitiesView.jsx
// (page conteneur) — n'existait pas encore côté Next.js (référencée par le
// Sidebar mais 404 jusqu'ici).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { ActivitiesView } from "@/components/activities/ActivitiesView";
import { useAuth } from "@/lib/auth";
import type { Activite, Projet } from "@/lib/types";

export default function ActivitesPage() {
  const { isLogged, isAdmin } = useAuth();
  const router = useRouter();
  const [activites, setActivites] = useState<Activite[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getActivites(), api.getProjets()])
      .then(([a, p]) => { setActivites(a); setProjets(p); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les activités")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <AppShell>
      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p>
      ) : (
        <ActivitiesView
          activities={activites} projects={projets} isAdmin={isAdmin}
          onAdd={async (d) => { await api.createActivite(d); load(); }}
          onUpdate={async (id, d) => { await api.updateActivite(id, d); load(); }}
          onDelete={async (id) => { await api.deleteActivite(id); load(); }}
        />
      )}
    </AppShell>
  );
}
