"""
backend/utils/pert.py
Moteur PERT — AGT TaskFlow

Algorithme :
  1. Tri topologique de Kahn  → détecte les cycles
  2. Passe avant  (forward)   → ES (Earliest Start), EF (Earliest Finish)
  3. Passe arrière (backward) → LS (Latest Start),   LF (Latest Finish)
  4. Marge  (slack)  = LS − ES
  5. Chemin critique = slack == 0

Unité : coupons (1 coupon = 3 h, convention frontend).
Ce module travaille en entiers bruts — la conversion n'est pas de sa responsabilité.
"""

from collections import deque


# ── Exception ────────────────────────────────────────────────────────────────

class CycleError(Exception):
    """Levée quand un cycle est détecté dans le graphe de dépendances."""

    def __init__(self, cycle_ids):
        self.cycle_ids = list(cycle_ids)
        super().__init__(f"Cycle détecté impliquant : {self.cycle_ids}")


# ── Helpers internes ─────────────────────────────────────────────────────────

def _build_graph(tasks):
    """
    Construit les index prédécesseurs/successeurs.

    Paramètres
    ----------
    tasks : list[dict]
        Chaque dict doit avoir 'id' (str) et 'dependencies' (list[str]).
        Les dépendances pointant vers des IDs inconnus sont ignorées.

    Retourne
    --------
    predecessors : dict {id → list[id]}
    successors   : dict {id → list[id]}
    """
    task_ids     = {t["id"] for t in tasks}
    predecessors = {}
    successors   = {t["id"]: [] for t in tasks}

    for t in tasks:
        tid   = t["id"]
        preds = [d for d in (t.get("dependencies") or []) if d in task_ids]
        predecessors[tid] = preds
        for pred in preds:
            successors[pred].append(tid)

    return predecessors, successors


def _topological_sort(predecessors, successors):
    """
    Tri topologique par l'algorithme de Kahn.

    Lève CycleError (avec la liste des IDs impliqués) si un cycle existe.
    Retourne la liste ordonnée des IDs.
    """
    in_degree = {tid: len(preds) for tid, preds in predecessors.items()}
    queue     = deque(tid for tid, deg in in_degree.items() if deg == 0)
    order     = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for succ in successors[node]:
            in_degree[succ] -= 1
            if in_degree[succ] == 0:
                queue.append(succ)

    if len(order) != len(predecessors):
        # Les nœuds restants (in_degree > 0) font partie du cycle
        remaining = [tid for tid, deg in in_degree.items() if deg > 0]
        raise CycleError(remaining)

    return order


def _forward_pass(order, predecessors, task_map):
    """
    Passe avant : calcule ES et EF.

    ES(t) = max(EF(prédécesseurs))  ou 0 si aucun prédécesseur.
    EF(t) = ES(t) + durée(t).
    """
    es = {}
    ef = {}

    for tid in order:
        valid_ef = [ef[p] for p in predecessors[tid] if p in ef]
        es[tid]  = max(valid_ef, default=0)
        ef[tid]  = es[tid] + int(task_map[tid].get("duration") or 1)

    return es, ef


def _backward_pass(order, successors, task_map, project_duration):
    """
    Passe arrière : calcule LS et LF.

    LF(t) = min(LS(successeurs))  ou durée_projet si aucun successeur.
    LS(t) = LF(t) − durée(t).
    """
    ls = {}
    lf = {}

    for tid in reversed(order):
        valid_ls = [ls[s] for s in successors[tid] if s in ls]
        lf[tid]  = min(valid_ls, default=project_duration)
        ls[tid]  = lf[tid] - int(task_map[tid].get("duration") or 1)

    return ls, lf


# ── API publique ─────────────────────────────────────────────────────────────

def compute_pert(tasks):
    """
    Calcule les données PERT pour une liste de tâches.

    Paramètres
    ----------
    tasks : list[dict]
        Chaque tâche doit avoir :
          - 'id'           : str
          - 'duration'     : int  (en coupons, >= 1)
          - 'dependencies' : list[str]  (IDs des prédécesseurs directs)

    Retourne
    --------
    dict  { task_id: { es, ef, ls, lf, slack, critical } }
        Toutes les valeurs sont en coupons (int).
        'critical' (bool) = True si slack == 0.

    Lève
    ----
    CycleError  – si le graphe contient un cycle.
                  L'attribut .cycle_ids contient la liste des IDs impliqués.

    Cas limites
    -----------
    - Liste vide            → dict vide, pas d'erreur.
    - Tâche sans dépendance → ES = 0, chemin critique probable.
    - Dépendance vers ID inconnu → ignorée silencieusement.
    """
    if not tasks:
        return {}

    task_map                 = {t["id"]: t for t in tasks}
    predecessors, successors = _build_graph(tasks)
    order                    = _topological_sort(predecessors, successors)

    es, ef                   = _forward_pass(order, predecessors, task_map)
    project_duration         = max(ef.values(), default=0)
    ls, lf                   = _backward_pass(order, successors, task_map, project_duration)

    return {
        tid: {
            "es":       es[tid],
            "ef":       ef[tid],
            "ls":       ls[tid],
            "lf":       lf[tid],
            "slack":    ls[tid] - es[tid],
            "critical": (ls[tid] - es[tid]) == 0,
        }
        for tid in order
    }
