// frontend/src/hooks/useSeenAssignments.js
//
// A-06 — Notifications d'affectation :
//   Stocke en localStorage (clé par userId) les IDs de tâches
//   dont la notification "tu es responsable" a été vue.
//   Permet à tout membre (même simple) d'être notifié
//   lorsqu'il est désigné responsable d'une tâche.

import { useState, useCallback } from "react";

const storageKey = (userId) => `agt_seen_assignments_${userId}`;

function loadSeen(userId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || "{}");
  } catch {
    return {};
  }
}

export function useSeenAssignments(userId) {
  const [seen, setSeen] = useState(() => loadSeen(userId));

  // Marquer une affectation comme vue
  const markSeen = useCallback((taskId) => {
    setSeen((prev) => {
      const next = { ...prev, [taskId]: true };
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
      return next;
    });
  }, [userId]);

  // Marquer plusieurs affectations comme vues d'un coup
  const markAllSeen = useCallback((taskIds) => {
    setSeen((prev) => {
      const next = { ...prev };
      taskIds.forEach((id) => { next[id] = true; });
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
      return next;
    });
  }, [userId]);

  // Une affectation est "nouvelle" si jamais vue
  const isNew = useCallback((taskId) => !seen[taskId], [seen]);

  // Nombre de nouvelles affectations dans une liste de tâches
  const countNew = useCallback((tasks) =>
    tasks.filter((t) => !seen[t.id]).length,
  [seen]);

  return { markSeen, markAllSeen, isNew, countNew };
}