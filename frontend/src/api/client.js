// frontend/src/api/client.js
// ⚠️  Fichier TRANSVERSAL — Poste A + Poste B
//
// A-04 — setUnauthorizedHandler (intercepteur 401)
// A-06 — getNotifications, markNotificationRead, markAllNotificationsRead
// A-07 — getProjectMembers, addProjectMember, updateProjectMember, removeProjectMember

const BASE = "/api";
const TOKEN_KEY = "agt_token";

// ── Intercepteur 401 ─────────────────────────────────────────────────────────
let _unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  _unauthorizedHandler = fn;
}

// ── Helper interne ───────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function req(method, path, body) {
  const token = getToken();
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);

  if (res.status === 401) {
    if (_unauthorizedHandler) _unauthorizedHandler();
    throw new Error("Non autorisé");
  }

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    throw new Error(data.error || `Erreur ${res.status}`);
  }

  return data;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const loginUser    = (creds) => req("POST", "/auth/login",    creds);
export const registerUser = (data)  => req("POST", "/auth/register", data);

// ── Tâches ───────────────────────────────────────────────────────────────────

export const getTasks    = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
  ).toString();
  return req("GET", `/tasks/${qs ? "?" + qs : ""}`);
};
export const createTask   = (data)        => req("POST",  "/tasks/",             data);
export const updateTask   = (id, data)    => req("PUT",   `/tasks/${id}`,         data);
export const deleteTask   = (id)          => req("DELETE", `/tasks/${id}`);
export const archiveTask  = (id)          => req("PATCH",  `/tasks/${id}/archive`);
export const unarchiveTask = (id)         => req("PATCH",  `/tasks/${id}/unarchive`);

// ── Projets ──────────────────────────────────────────────────────────────────

export const getProjects   = ()           => req("GET",    "/projects/");
export const createProject = (data)       => req("POST",   "/projects/",          data);
export const updateProject = (id, data)   => req("PUT",    `/projects/${id}`,     data);
export const deleteProject = (id)         => req("DELETE",  `/projects/${id}`);
export const setProjectChef = (id, data)  => req("PUT",    `/projects/${id}/chef`, data);

// ── Membres d'un projet (A-07) ───────────────────────────────────────────────

export const getProjectMembers   = (pid)          => req("GET",    `/projects/${pid}/members`);
export const addProjectMember    = (pid, data)     => req("POST",   `/projects/${pid}/members`,        data);
export const updateProjectMember = (pid, mid, data)=> req("PUT",    `/projects/${pid}/members/${mid}`, data);
export const removeProjectMember = (pid, mid)      => req("DELETE",  `/projects/${pid}/members/${mid}`);

// ── Activités ────────────────────────────────────────────────────────────────

export const getActivities    = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
  ).toString();
  return req("GET", `/activities/${qs ? "?" + qs : ""}`);
};
export const createActivity = (data)       => req("POST",   "/activities/",        data);
export const updateActivity = (id, data)   => req("PUT",    `/activities/${id}`,   data);
export const deleteActivity = (id)         => req("DELETE",  `/activities/${id}`);

// ── Membres ──────────────────────────────────────────────────────────────────

export const getMembers       = ()        => req("GET",    "/members/");
export const createMember     = (data)    => req("POST",   "/members/",            data);
export const deleteMember     = (id)      => req("DELETE",  `/members/${id}`);
export const setMemberRole    = (id, role)=> req("PUT",    `/members/${id}/role`,  { role });
export const getPendingMembers = ()       => req("GET",    "/members/pending");
export const validateMember   = (id, action) => req("PUT", `/members/${id}/validate`, { action });

// ── Besoins ──────────────────────────────────────────────────────────────────

export const getNeeds    = ()           => req("GET",    "/needs/");
export const createNeed  = (data)       => req("POST",   "/needs/",       data);
export const updateNeed  = (id, data)   => req("PUT",    `/needs/${id}`,  data);
export const deleteNeed  = (id)         => req("DELETE",  `/needs/${id}`);

// ── Notes ────────────────────────────────────────────────────────────────────

export const getNotes    = ()           => req("GET",    "/notes/");
export const createNote  = (data)       => req("POST",   "/notes/",       data);
export const updateNote  = (id, data)   => req("PUT",    `/notes/${id}`,  data);
export const deleteNote  = (id)         => req("DELETE",  `/notes/${id}`);

// ── Difficultés ──────────────────────────────────────────────────────────────

export const getDifficulties  = (taskId) => req("GET",    `/difficulties/?task_id=${taskId}`);
export const createDifficulty = (data)   => req("POST",   "/difficulties/",        data);
export const deleteDifficulty = (id)     => req("DELETE",  `/difficulties/${id}`);

// ── Notifications ────────────────────────────────────────────────────────────

export const getNotifications       = ()   => req("GET",   "/notifications/");
export const markNotificationRead   = (id) => req("PATCH", `/notifications/${id}/read`);
export const markAllNotificationsRead = ()  => req("PATCH", "/notifications/read-all");

// ── Rapports & Performance ───────────────────────────────────────────────────

export const getPerformance = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
  ).toString();
  return req("GET", `/performance/${qs ? "?" + qs : ""}`);
};

// ── Ordre journalier ─────────────────────────────────────────────────────────

export const getDailyOrder    = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
  ).toString();
  return req("GET", `/daily-order/${qs ? "?" + qs : ""}`);
};
export const saveDailyOrder   = (data)        => req("POST",  "/daily-order/",       data);
export const deleteDailyOrder = (id)          => req("DELETE", `/daily-order/${id}`);