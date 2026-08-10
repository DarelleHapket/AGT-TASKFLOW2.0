// Port de frontend/src/utils/pert.js. Le calcul PERT/CPM canonique (la
// tâche complète) vit désormais côté backend (projets/pert.py) et arrive
// déjà calculé sur chaque Tache (es/ef/ls/lf/slack/critical). computePERT
// reste néanmoins nécessaire ici : GanttView recalcule le CPM sur des
// SOUS-ENSEMBLES filtrés par jour, dont les ES/EF diffèrent forcément de
// ceux du planning complet.
export interface PertTaskLike { id: string; duree: number; dependances: string[] }
export interface PertComputedTaskLike { id: string; es: number | null; ef: number | null; ls: number | null; lf: number | null; slack: number | null }

// Construit un PertResult à partir du calcul CPM déjà fait côté serveur
// (projets/pert.py) sur chaque tâche — utilisé pour le mode "planning complet"
// de GanttView/PERTView, par opposition à computePERT() qui recalcule un
// sous-ensemble filtré par jour côté client.
export function pertFromTasks(tasks: PertComputedTaskLike[]): PertResult {
  const ES: Record<string, number> = {}, EF: Record<string, number> = {};
  const LS: Record<string, number> = {}, LF: Record<string, number> = {};
  const slack: Record<string, number | null> = {};
  let end = 0;
  tasks.forEach((t) => {
    ES[t.id] = t.es ?? 0; EF[t.id] = t.ef ?? 0;
    LS[t.id] = t.ls ?? 0; LF[t.id] = t.lf ?? 0;
    slack[t.id] = t.slack ?? null;
    end = Math.max(end, t.ef ?? 0);
  });
  return { ES, EF, LS, LF, slack, end, cycles: [] };
}
export interface PertResult { ES: Record<string, number>; EF: Record<string, number>; LS: Record<string, number>; LF: Record<string, number>; slack: Record<string, number | null>; end: number; cycles: string[] }

export function computePERT(tasks: PertTaskLike[]): PertResult {
  if (!tasks.length) return { ES: {}, EF: {}, LS: {}, LF: {}, slack: {}, end: 0, cycles: [] };

  const map: Record<string, PertTaskLike> = Object.fromEntries(tasks.map((t) => [t.id, t]));

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color: Record<string, number> = Object.fromEntries(tasks.map((t) => [t.id, WHITE]));
  const cycleNodes = new Set<string>();

  const detectCycle = (id: string): boolean => {
    if (color[id] === BLACK) return false;
    if (color[id] === GRAY) return true;
    color[id] = GRAY;
    for (const dep of (map[id]?.dependances || []).filter((d) => map[d])) {
      if (detectCycle(dep)) { cycleNodes.add(id); cycleNodes.add(dep); }
    }
    color[id] = BLACK;
    return false;
  };
  tasks.forEach((t) => detectCycle(t.id));

  const safeTasks = tasks.filter((t) => !cycleNodes.has(t.id));
  const visited = new Set<string>();
  const order: string[] = [];

  const dfs = (id: string) => {
    if (visited.has(id) || cycleNodes.has(id)) return;
    visited.add(id);
    (map[id]?.dependances || []).filter((d) => map[d] && !cycleNodes.has(d)).forEach(dfs);
    order.push(id);
  };
  safeTasks.forEach((t) => dfs(t.id));

  const ES: Record<string, number> = {}, EF: Record<string, number> = {};
  order.forEach((id) => {
    const deps = (map[id]?.dependances || []).filter((d) => map[d] && !cycleNodes.has(d));
    ES[id] = deps.length ? Math.max(...deps.map((d) => EF[d] ?? 0)) : 0;
    EF[id] = ES[id] + (map[id]?.duree || 1);
  });

  const end = Math.max(0, ...safeTasks.map((t) => EF[t.id] ?? 0));

  const LS: Record<string, number> = {}, LF: Record<string, number> = {};
  [...order].reverse().forEach((id) => {
    const succs = safeTasks.filter((t) => (t.dependances || []).includes(id) && !cycleNodes.has(t.id));
    LF[id] = succs.length ? Math.min(...succs.map((s) => LS[s.id])) : end;
    LS[id] = LF[id] - (map[id]?.duree || 1);
  });

  const slack: Record<string, number | null> = Object.fromEntries(
    tasks.map((t) => [t.id, cycleNodes.has(t.id) ? null : (LS[t.id] || 0) - (ES[t.id] || 0)])
  );

  return { ES, EF, LS, LF, slack, end, cycles: Array.from(cycleNodes) };
}

export const STATUSES = [
  { value: "todo", label: "À faire", color: "#64748b" },
  { value: "in_progress", label: "En cours", color: "#3b82f6" },
  { value: "done", label: "Terminée", color: "#22c55e" },
  { value: "blocked", label: "Bloquée", color: "#ef4444" },
];

export const PRIORITIES = [
  { value: "critique", label: "Critique" },
  { value: "haute", label: "Haute" },
  { value: "normale", label: "Normale" },
];
