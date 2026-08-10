"use client";

// Port fidèle de frontend/src/components/pert/PERTView.jsx (page conteneur).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { PERTView } from "@/components/pert/PERTView";
import type { TaskFilters } from "@/components/shared/FilterBar";
import { pertFromTasks } from "@/lib/pert";
import { useAuth } from "@/lib/auth";
import type { Projet, StatutTache, Tache, Utilisateur } from "@/lib/types";

const DEFAULT_FILTERS: TaskFilters = {
  project: "all", member: "all", status: "all", priority: "all", period: "all",
  date_from: null, date_to: null, single_date: null,
  show_overdue: false, show_critical: false, show_archived: false, search: "",
};

export default function PertPage() {
  const { isLogged } = useAuth();
  const router = useRouter();
  const [taches, setTaches] = useState<Tache[]>([]);
  const [cycles, setCycles] = useState<string[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [membres, setMembres] = useState<Utilisateur[]>([]);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  function load() {
    Promise.all([api.getTaches(), api.getProjets(), api.getMembres()])
      .then(([t, p, m]) => {
        setTaches(t.tasks.filter((x) => !x.est_archivee));
        setCycles(t.pert_cycle_ids);
        setProjets(p); setMembres(m);
      })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger le PERT")));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onStatusChange(id: string, statut: StatutTache) {
    await api.patchTache(id, { statut });
    load();
  }

  async function onDelete(id: string) {
    await api.deleteTache(id);
    load();
  }

  const pert = pertFromTasks(taches);
  pert.cycles = cycles;

  return (
    <AppShell>
      {error && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      <PERTView tasks={taches} projects={projets} members={membres} pert={pert} filters={filters} setFilters={setFilters} onStatusChange={onStatusChange} onDelete={onDelete} />
    </AppShell>
  );
}
