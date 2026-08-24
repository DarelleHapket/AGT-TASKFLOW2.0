"use client";

// Port fidèle de frontend/src/hooks/useSeenDifficulties.js.
import { useCallback, useState } from "react";

const STORAGE_KEY = "agt_seen_difficulties";

function loadSeen(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function useSeenDifficulties() {
  const [seen, setSeen] = useState<Record<string, number>>(loadSeen);

  const markAsSeen = useCallback((taskId: string, count: number) => {
    setSeen((prev) => {
      const next = { ...prev, [taskId]: count };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const hasUnseen = useCallback((taskId: string, totalCount: number) => {
    if (!totalCount) return false;
    const seenCount = seen[taskId] ?? 0;
    return totalCount > seenCount;
  }, [seen]);

  return { markAsSeen, hasUnseen };
}
