"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Page combinée PERT / Gantt (D-08) : le lien de menu "PERT / Gantt" ne
// pointait que vers ce Gantt, la table PERT ajoutée sur /pert restait donc
// invisible depuis la navigation. Un seul chargement de données, un toggle
// pour basculer d'une vue à l'autre — même logique que le toggle Liste/
// Tableau de la page Tâches.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GanttChart as GanttIcon, Waypoints } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { GanttView } from "@/components/gantt/GanttView";
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

export default function GanttPage() {
  const { isLogged } = useAuth();
  const router = useRouter();
  const [vue, setVue] = useState<"gantt" | "pert">("gantt");
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
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les données")));
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

  const memberColor = (id: number | null) => membres.find((m) => m.id === id)?.color || "#94a3b8";
  const pert = pertFromTasks(taches);
  pert.cycles = cycles;

  return (
    <AppShell>
      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}

      <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", width: "fit-content", marginBottom: 16 }}>
        <button onClick={() => setVue("gantt")} title="Vue Gantt"
          style={{ display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", padding: "8px 14px", fontSize: 12, fontWeight: 700, background: vue === "gantt" ? "var(--accent)" : "var(--bg-card)", color: vue === "gantt" ? "white" : "var(--text-2)" }}>
          <GanttIcon size={13} /> Gantt
        </button>
        <button onClick={() => setVue("pert")} title="Vue PERT"
          style={{ display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", padding: "8px 14px", fontSize: 12, fontWeight: 700, background: vue === "pert" ? "var(--accent)" : "var(--bg-card)", color: vue === "pert" ? "white" : "var(--text-2)" }}>
          <Waypoints size={13} /> PERT
        </button>
      </div>

      {vue === "gantt" ? (
        <GanttView tasks={taches} projects={projets} members={membres} pert={pert} filters={filters} setFilters={setFilters} memberColor={memberColor} />
      ) : (
        <PERTView tasks={taches} projects={projets} members={membres} pert={pert} filters={filters} setFilters={setFilters} onStatusChange={onStatusChange} onDelete={onDelete} />
      )}
    </AppShell>
  );
}
