"use client";

// Port fidèle : la logique de filtrage vient de App.jsx (`filtered`), pas de
// paramètres serveur — l'original chargeait toutes les tâches puis filtrait
// côté client, seule la visibilité (P3) est appliquée côté backend.
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { TasksView } from "@/components/tasks/TasksView";
import { TaskModal } from "@/components/tasks/TaskModal";
import type { TaskFilters } from "@/components/shared/FilterBar";
import { useAuth } from "@/lib/auth";
import type { Activite, Projet, StatutTache, Tache, Utilisateur } from "@/lib/types";

const DEFAULT_FILTERS: TaskFilters = {
  project: "all", member: "all", status: "all", priority: "all", period: "all",
  date_from: null, date_to: null, single_date: null,
  show_overdue: false, show_critical: false, show_archived: false, search: "",
};

export default function TachesPage() {
  return (
    <Suspense fallback={null}>
      <TachesPageInner />
    </Suspense>
  );
}

function TachesPageInner() {
  const { isLogged, isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Tache[]>([]);
  const [projects, setProjects] = useState<Projet[]>([]);
  const [activities, setActivities] = useState<Activite[]>([]);
  const [members, setMembers] = useState<Utilisateur[]>([]);
  // Filtres initiaux depuis l'URL — liens des widgets du tableau de bord
  // (ex. /taches?member=3&status=in_progress) pour que les cartes stats
  // soient cliquables plutôt que purement décoratives.
  const [filters, setFilters] = useState<TaskFilters>(() => ({
    ...DEFAULT_FILTERS,
    status: searchParams.get("status") || DEFAULT_FILTERS.status,
    member: searchParams.get("member") || DEFAULT_FILTERS.member,
    show_overdue: searchParams.get("overdue") === "1",
  }));
  const [modal, setModal] = useState<{ mode: "add" | "edit"; task?: Tache } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getTaches(), api.getProjets(), api.getActivites(), api.getMembres()])
      .then(([t, p, a, m]) => {
        setTasks(t.tasks); setProjects(p); setActivities(a);
        // Admin (lecture seule) et Superadmin ne travaillent pas sur les
        // projets : ils ne doivent pas apparaître comme responsable possible.
        setMembers(m.filter((x) => x.statut === "ACTIF" && !x.roles.includes("admin") && !x.roles.includes("superadmin")));
      })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les tâches")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = tasks.filter((t) => {
    if (!filters.show_archived && t.est_archivee) return false;
    if (filters.project !== "all" && String(t.projet) !== String(filters.project)) return false;
    if (filters.member !== "all" && String(t.responsable) !== String(filters.member)) return false;
    if (filters.status !== "all" && t.statut !== filters.status) return false;
    if (filters.priority !== "all" && t.priorite !== filters.priority) return false;
    if (filters.show_overdue && !(t.date_echeance && t.date_echeance < today && t.statut !== "done")) return false;
    if (filters.show_critical && !t.critical) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const projName = projects.find((p) => p.id === t.projet)?.nom || "";
      const actName = activities.find((a) => a.id === t.activite)?.nom || "";
      if (!t.id.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q) && !projName.toLowerCase().includes(q) && !actName.toLowerCase().includes(q)) return false;
    }
    if (filters.single_date) {
      const s = t.date_debut, e = t.date_fin || t.date_echeance;
      if (s && s > filters.single_date) return false;
      if (e && e < filters.single_date) return false;
    } else if (filters.date_from || filters.date_to) {
      const s = t.date_debut, e = t.date_fin || t.date_echeance;
      if (s && filters.date_to && s > filters.date_to) return false;
      if (e && filters.date_from && e < filters.date_from) return false;
    }
    return true;
  });

  async function save(data: Partial<Tache> & { id: string }) {
    if (modal?.mode === "edit") await api.updateTache(data.id, data);
    else await api.createTache(data);
    load();
  }

  async function onStatusChange(id: string, statut: StatutTache) {
    await api.patchTache(id, { statut });
    load();
  }
  async function onDelete(id: string) { await api.deleteTache(id); load(); }

  return (
    <AppShell>
      {error && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p>
      ) : (
        <TasksView
          tasks={filtered} projects={projects} activities={activities} members={members}
          filters={filters} setFilters={setFilters}
          onAdd={() => setModal({ mode: "add" })}
          onEdit={(t) => setModal({ mode: "edit", task: t })}
          onDelete={onDelete}
          onStatusChange={onStatusChange} isAdmin={isAdmin}
        />
      )}

      {modal && (
        <TaskModal
          mode={modal.mode} initial={modal.task ?? null} tasks={tasks} members={members}
          projects={projects} activities={activities} onSave={save} onStatusChange={onStatusChange}
          onClose={() => setModal(null)} isAdmin={isAdmin}
        />
      )}
    </AppShell>
  );
}
