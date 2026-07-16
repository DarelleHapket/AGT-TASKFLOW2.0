import { useState, useEffect, useCallback } from "react";
import * as api from "../api/client";
import { computePERT } from "../utils/pert";

export function useData() {
  const [tasks, setTasks]           = useState([]);
  const [projects, setProjects]     = useState([]);
  const [activities, setActivities] = useState([]);
  const [members, setMembers]       = useState([]);
  const [needs, setNeeds]           = useState([]);
  const [notes, setNotes]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const load = useCallback(async () => {
    try {
      const [t, p, a, m, n, no] = await Promise.all([
        api.getTasks(), api.getProjects(), api.getActivities(),
        api.getMembers(), api.getNeeds(), api.getNotes(),
      ]);
      setTasks(t); setProjects(p); setActivities(a);
      setMembers(m); setNeeds(n); setNotes(no);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const memberColor = (name) => {
    const m = members.find((x) => x.name === name);
    return m?.color || "#94a3b8";
  };

  const pert = computePERT(tasks);

  return {
    tasks, setTasks, projects, setProjects,
    activities, setActivities, members, setMembers,
    needs, setNeeds, notes, setNotes,
    loading, error, reload: load, memberColor, pert,
  };
}