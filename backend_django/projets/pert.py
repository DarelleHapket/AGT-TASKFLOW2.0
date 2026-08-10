"""Moteur PERT — port direct de backend/utils/pert.py (AGT TaskFlow Flask).

Algorithme :
  1. Tri topologique de Kahn  -> détecte les cycles
  2. Passe avant  (forward)   -> ES (Earliest Start), EF (Earliest Finish)
  3. Passe arrière (backward) -> LS (Latest Start),   LF (Latest Finish)
  4. Marge (slack) = LS - ES
  5. Chemin critique = slack == 0

Module pur (aucune dépendance Django/DB) — porté sans changement de logique,
seul le nom du module a changé de place (projets/pert.py au lieu de
backend/utils/pert.py).
"""

from collections import deque


class CycleError(Exception):
    def __init__(self, cycle_ids):
        self.cycle_ids = list(cycle_ids)
        super().__init__(f"Cycle détecté impliquant : {self.cycle_ids}")


def _build_graph(tasks):
    task_ids = {t["id"] for t in tasks}
    predecessors = {}
    successors = {t["id"]: [] for t in tasks}
    for t in tasks:
        tid = t["id"]
        preds = [d for d in (t.get("dependencies") or []) if d in task_ids]
        predecessors[tid] = preds
        for pred in preds:
            successors[pred].append(tid)
    return predecessors, successors


def _topological_sort(predecessors, successors):
    in_degree = {tid: len(preds) for tid, preds in predecessors.items()}
    queue = deque(tid for tid, deg in in_degree.items() if deg == 0)
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for succ in successors[node]:
            in_degree[succ] -= 1
            if in_degree[succ] == 0:
                queue.append(succ)
    if len(order) != len(predecessors):
        remaining = [tid for tid, deg in in_degree.items() if deg > 0]
        raise CycleError(remaining)
    return order


def _forward_pass(order, predecessors, task_map):
    es, ef = {}, {}
    for tid in order:
        valid_ef = [ef[p] for p in predecessors[tid] if p in ef]
        es[tid] = max(valid_ef, default=0)
        ef[tid] = es[tid] + int(task_map[tid].get("duration") or 1)
    return es, ef


def _backward_pass(order, successors, task_map, project_duration):
    ls, lf = {}, {}
    for tid in reversed(order):
        valid_ls = [ls[s] for s in successors[tid] if s in ls]
        lf[tid] = min(valid_ls, default=project_duration)
        ls[tid] = lf[tid] - int(task_map[tid].get("duration") or 1)
    return ls, lf


def compute_pert(tasks):
    """tasks: list[dict] avec 'id', 'duration', 'dependencies'.
    Retourne {task_id: {es, ef, ls, lf, slack, critical}}. Lève CycleError."""
    if not tasks:
        return {}
    task_map = {t["id"]: t for t in tasks}
    predecessors, successors = _build_graph(tasks)
    order = _topological_sort(predecessors, successors)
    es, ef = _forward_pass(order, predecessors, task_map)
    project_duration = max(ef.values(), default=0)
    ls, lf = _backward_pass(order, successors, task_map, project_duration)
    return {
        tid: {
            "es": es[tid], "ef": ef[tid], "ls": ls[tid], "lf": lf[tid],
            "slack": ls[tid] - es[tid], "critical": (ls[tid] - es[tid]) == 0,
        }
        for tid in order
    }
