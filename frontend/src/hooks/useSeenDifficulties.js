// frontend/src/hooks/useSeenDifficulties.js
import { useState, useCallback } from "react";

const STORAGE_KEY = "agt_seen_difficulties";

function loadSeen() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function useSeenDifficulties() {
  const [seen, setSeen] = useState(loadSeen);

  // Marquer les difficultés d'une tâche comme vues
  // On stocke le nombre de difficultés vues pour cette tâche
  const markAsSeen = useCallback((taskId, count) => {
    setSeen((prev) => {
      const next = { ...prev, [taskId]: count };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Retourne true si la tâche a des difficultés non vues
  const hasUnseen = useCallback((taskId, totalCount) => {
    if (!totalCount) return false;
    const seenCount = seen[taskId] ?? 0;
    return totalCount > seenCount;
  }, [seen]);

  // Nombre total de signalements non vus sur toutes les tâches
  const totalUnseen = useCallback((difficultiesByTask) => {
    return Object.entries(difficultiesByTask).reduce((acc, [taskId, count]) => {
      const seenCount = seen[taskId] ?? 0;
      return acc + Math.max(0, count - seenCount);
    }, 0);
  }, [seen]);

  return { markAsSeen, hasUnseen, totalUnseen };
}