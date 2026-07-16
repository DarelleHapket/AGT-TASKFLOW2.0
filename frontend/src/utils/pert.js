/**
 * computePERT — Calcul du chemin critique (CPM)
 * Robuste aux cycles : si un cycle est détecté, les tâches impliquées
 * sont ignorées du calcul topologique mais restent affichées.
 */
export function computePERT(tasks) {
  if (!tasks.length) return { ES: {}, EF: {}, LS: {}, LF: {}, slack: {}, end: 0, cycles: [] };

  const map = Object.fromEntries(tasks.map((t) => [t.id, t]));

  // ── Détection de cycles (DFS avec état : blanc/gris/noir) ──
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = Object.fromEntries(tasks.map((t) => [t.id, WHITE]));
  const cycleNodes = new Set();

  const detectCycle = (id) => {
    if (color[id] === BLACK) return false;
    if (color[id] === GRAY) return true; // cycle détecté
    color[id] = GRAY;
    for (const dep of (map[id]?.dependencies || []).filter((d) => map[d])) {
      if (detectCycle(dep)) {
        cycleNodes.add(id);
        cycleNodes.add(dep);
      }
    }
    color[id] = BLACK;
    return false;
  };
  tasks.forEach((t) => detectCycle(t.id));

  // ── Tri topologique (sans les nœuds en cycle) ──
  const safeTasks = tasks.filter((t) => !cycleNodes.has(t.id));
  const visited = new Set();
  const order = [];

  const dfs = (id) => {
    if (visited.has(id) || cycleNodes.has(id)) return;
    visited.add(id);
    (map[id]?.dependencies || [])
      .filter((d) => map[d] && !cycleNodes.has(d))
      .forEach(dfs);
    order.push(id);
  };
  safeTasks.forEach((t) => dfs(t.id));

  // ── Calcul ES / EF (dates au plus tôt) ──
  const ES = {}, EF = {};
  order.forEach((id) => {
    const deps = (map[id]?.dependencies || []).filter((d) => map[d] && !cycleNodes.has(d));
    ES[id] = deps.length ? Math.max(...deps.map((d) => EF[d] ?? 0)) : 0;
    EF[id] = ES[id] + (map[id]?.duration || 1);
  });

  const end = Math.max(0, ...safeTasks.map((t) => EF[t.id] ?? 0));

  // ── Calcul LS / LF (dates au plus tard) ──
  const LS = {}, LF = {};
  [...order].reverse().forEach((id) => {
    const succs = safeTasks.filter(
      (t) => (t.dependencies || []).includes(id) && !cycleNodes.has(t.id)
    );
    LF[id] = succs.length ? Math.min(...succs.map((s) => LS[s.id])) : end;
    LS[id] = LF[id] - (map[id]?.duration || 1);
  });

  // ── Marge totale ──
  const slack = Object.fromEntries(
    tasks.map((t) => [t.id, cycleNodes.has(t.id) ? null : (LS[t.id] || 0) - (ES[t.id] || 0)])
  );

  return {
    ES, EF, LS, LF, slack, end,
    cycles: [...cycleNodes], // liste des IDs en cycle pour affichage warning
  };
}

export const STATUSES = [
  { value: "todo",        label: "À faire",  color: "#64748b" },
  { value: "in_progress", label: "En cours", color: "#3b82f6" },
  { value: "done",        label: "Terminée", color: "#22c55e" },
  { value: "blocked",     label: "Bloquée",  color: "#ef4444" },
];