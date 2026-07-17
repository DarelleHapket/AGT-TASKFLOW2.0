// frontend/src/hooks/useData.js
// ⚠️  Fichier transversal — Poste A + Poste B
//
// Session A-03 — Étape 2.3 :
//   • computePERT() retiré — PERT fourni directement par le backend (D-05)
//   • buildPertFromTasks() reconstruit {ES,EF,LS,LF,slack,end,cycles}
//     depuis les champs es/ef/ls/lf/slack embarqués dans chaque tâche
//   • pert migré en état explicite (useState) au lieu d'une dérivée réactive
//   • Format D-05 géré : tableau plat OU {tasks, pert_cycle_ids}
//
// Session A-04 — Bugfix gestion de session (D-07) :
//   PROBLÈME : useData() lançait load() dès le montage de App, AVANT même
//   que le guard `if (!isLogged) return <LoginPage />` soit évalué (les hooks
//   s'exécutent dans l'ordre à chaque render, indépendamment des retours
//   anticipés qui les suivent dans le code). Résultat : un appel API partait
//   sans token au tout premier chargement de la page, provoquant l'erreur
//   "token invalide" — corrigée seulement par un rechargement manuel une
//   fois le token présent en storage.
//
//   CORRECTIF : useData() accepte maintenant un paramètre `isLogged`.
//   Le chargement ne se déclenche que si isLogged === true, et se redéclenche
//   automatiquement dès que isLogged passe de false à true (connexion),
//   grâce à la dépendance ajoutée dans le useEffect.
//
// LIMITATION CONNUE (D-06) — inchangée :
//   Après une mutation locale (setTasks depuis App.jsx : créer/modifier/supprimer),
//   pert reste figé à la dernière valeur backend jusqu'au prochain reload().

import { useState, useEffect, useCallback } from "react";
import * as api from "../api/client";

// ── Helper : construit l'objet pert depuis les champs embarqués (format D-05) ──
function buildPertFromTasks(tasks, cycleIds = []) {
  const cycleSet = new Set(cycleIds);

  const ES    = {};
  const EF    = {};
  const LS    = {};
  const LF    = {};
  const slack = {};

  tasks.forEach((t) => {
    ES[t.id]    = t.es    ?? 0;
    EF[t.id]    = t.ef    ?? 0;
    LS[t.id]    = t.ls    ?? null;
    LF[t.id]    = t.lf    ?? null;
    slack[t.id] = cycleSet.has(t.id) ? null : (t.slack ?? null);
  });

  const end = tasks.length
    ? Math.max(0, ...tasks.map((t) => EF[t.id] ?? 0))
    : 0;

  return { ES, EF, LS, LF, slack, end, cycles: cycleIds };
}

const PERT_EMPTY = { ES: {}, EF: {}, LS: {}, LF: {}, slack: {}, end: 0, cycles: [] };

// A-04 : isLogged est désormais requis pour piloter le déclenchement du chargement.
// Par défaut à `true` pour ne pas casser un éventuel appel existant sans argument
// (rétro-compatibilité), mais App.jsx doit passer la vraie valeur d'authentification.
export function useData(isLogged = true) {
  const [tasks,      setTasks]      = useState([]);
  const [projects,   setProjects]   = useState([]);
  const [activities, setActivities] = useState([]);
  const [members,    setMembers]    = useState([]);
  const [needs,      setNeeds]      = useState([]);
  const [notes,      setNotes]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [pert,       setPert]       = useState(PERT_EMPTY);

  const load = useCallback(async () => {
    // Jeton local à cette invocation : permet de détecter si un logout
    // (isLogged → false) est survenu pendant que les requêtes étaient en
    // vol, pour ignorer leur résultat (succès ou erreur) une fois périmé.
    // Sans ça, un 401 reçu juste après un logout automatique réécrivait
    // `error` avec "token invalide" malgré le retour à l'écran de login
    // (A-04, D-07 bis — race condition).
    const requestToken = Symbol("load");
    load._activeToken = requestToken;

    try {
      setLoading(true);
      setError(null);

      const [rawTasks, p, a, m, n, no] = await Promise.all([
        api.getTasks(),
        api.getProjects(),
        api.getActivities(),
        api.getMembers(),
        api.getNeeds(),
        api.getNotes(),
      ]);

      // Une déconnexion a eu lieu pendant l'attente : on jette ce résultat.
      if (load._activeToken !== requestToken) return;

      let tasksData, cycleIds;

      if (Array.isArray(rawTasks)) {
        tasksData = rawTasks;
        cycleIds  = [];
      } else if (rawTasks && Array.isArray(rawTasks.tasks)) {
        tasksData = rawTasks.tasks;
        cycleIds  = rawTasks.pert_cycle_ids || [];
      } else {
        console.warn("[useData] Format inattendu de api.getTasks() :", rawTasks);
        tasksData = Array.isArray(rawTasks) ? rawTasks : [];
        cycleIds  = [];
      }

      const pertData = buildPertFromTasks(tasksData, cycleIds);

      setTasks(tasksData);
      setPert(pertData);
      setProjects(p);
      setActivities(a);
      setMembers(m);
      setNeeds(n);
      setNotes(no);
    } catch (e) {
      // Idem : une erreur (ex. 401) qui arrive après un logout ne doit pas
      // ré-afficher un message d'erreur sur l'écran de login.
      if (load._activeToken !== requestToken) return;
      setError(e.message);
    } finally {
      if (load._activeToken === requestToken) setLoading(false);
    }
  }, []);

  // A-04 : le chargement ne part que si l'utilisateur est authentifié.
  // Quand isLogged passe de false à true (connexion réussie), ce useEffect
  // se redéclenche automatiquement et charge les données avec le token
  // désormais présent — plus besoin de rafraîchir la page manuellement.
  useEffect(() => {
    if (!isLogged) {
      // Pas connecté (ou déconnexion suite à un 401) : on invalide toute
      // requête en cours (voir load._activeToken), on n'en lance aucune
      // nouvelle, et on nettoie tout état résiduel d'une session précédente.
      // Sans ce reset, une erreur "token invalide" laissée par le dernier
      // appel avant déconnexion restait affichée indéfiniment, y compris
      // après un retour à l'écran de login (A-04, D-07 bis).
      load._activeToken = null;
      setLoading(false);
      setError(null);
      setTasks([]);
      setPert(PERT_EMPTY);
      return;
    }
    load();
  }, [isLogged, load]);

  const memberColor = (name) => {
    const m = members.find((x) => x.name === name);
    return m?.color || "#94a3b8";
  };

  return {
    tasks,      setTasks,
    projects,   setProjects,
    activities, setActivities,
    members,    setMembers,
    needs,      setNeeds,
    notes,      setNotes,
    loading,    error,
    reload:     load,
    memberColor,
    pert,
  };
}