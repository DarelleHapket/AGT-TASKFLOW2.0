"use client";

// Port fidèle de frontend/src/components/gantt/GanttView.jsx (page conteneur).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { GanttView } from "@/components/gantt/GanttView";
import type { TaskFilters } from "@/components/shared/FilterBar";
import { pertFromTasks } from "@/lib/pert";
import { useAuth } from "@/lib/auth";
import type { Projet, Tache, Utilisateur } from "@/lib/types";

const DEFAULT_FILTERS: TaskFilters = {
  project: "all", member: "all", status: "all", priority: "all", period: "all",
  date_from: null, date_to: null, single_date: null,
  show_overdue: false, show_critical: false, show_archived: false, search: "",
};

export default function GanttPage() {
  const { isLogged } = useAuth();
  const router = useRouter();
  const [taches, setTaches] = useState<Tache[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [membres, setMembres] = useState<Utilisateur[]>([]);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  useEffect(() => {
    Promise.all([api.getTaches(), api.getProjets(), api.getMembres()])
      .then(([t, p, m]) => { setTaches(t.tasks.filter((x) => !x.est_archivee)); setProjets(p); setMembres(m); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger le Gantt")));
  }, []);

  const memberColor = (id: number | null) => membres.find((m) => m.id === id)?.color || "#94a3b8";

  return (
    <AppShell>
      {error && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      <GanttView
        tasks={taches} projects={projets} members={membres}
        pert={pertFromTasks(taches)}
        filters={filters} setFilters={setFilters}
        memberColor={memberColor}
      />
    </AppShell>
  );
}
