// frontend/src/api/client.js
const BASE = "/api";

function getToken() {
  return localStorage.getItem("agt_token");
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
  const res = await fetch(BASE + path, opts);
  if (res.status === 401) {
    localStorage.removeItem("agt_token");
    localStorage.removeItem("agt_user");
    localStorage.setItem("agt_session_expired", "1");
    window.location.reload();
    throw new Error("Session expiree");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Tasks ───────────────────────────────────────────────────────────────────
export const getTasks = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "" && v !== false) qs.set(k, v);
  });
  const query = qs.toString();
  return req("GET", `/tasks/${query ? "?" + query : ""}`);
};
export const createTask = (t) => req("POST", "/tasks/", t);
export const updateTask = (id, t) => req("PUT", `/tasks/${id}`, t);
export const deleteTask = (id) => req("DELETE", `/tasks/${id}`);
export const archiveTask = (id) => req("PATCH", `/tasks/${id}/archive`);
export const unarchiveTask = (id) => req("PATCH", `/tasks/${id}/unarchive`);

// ── Projects ────────────────────────────────────────────────────────────────
export const getProjects = () => req("GET", "/projects/");
export const createProject = (p) => req("POST", "/projects/", p);
export const updateProject = (id, p) => req("PUT", `/projects/${id}`, p);
export const deleteProject = (id) => req("DELETE", `/projects/${id}`);
export const setProjectChef = (id, chefId) => req("PUT", `/projects/${id}/chef`, { chef_id: chefId });

// ── Activities ──────────────────────────────────────────────────────────────
export const getActivities = (pid) =>
  req("GET", `/activities/${pid ? `?project_id=${pid}` : ""}`);
export const createActivity = (a) => req("POST", "/activities/", a);
export const updateActivity = (id, a) => req("PUT", `/activities/${id}`, a);
export const deleteActivity = (id) => req("DELETE", `/activities/${id}`);

// ── Members ─────────────────────────────────────────────────────────────────
// ── Members ─────────────────────────────────────────────────────────────────
export const getMembers = () => req("GET", "/members/");
export const createMember = (m) => req("POST", "/members/", m);
export const deleteMember = (id) => req("DELETE", `/members/${id}`);
export const getPendingMembers = () => req("GET", "/members/pending");
export const validateMember    = (id, action) => req("PUT", `/members/${id}/validate`, { action });
export const setMemberRole     = (id, role) => req("PUT", `/members/${id}/role`, { role });

// ── Needs ───────────────────────────────────────────────────────────────────
export const getNeeds = () => req("GET", "/needs/");
export const getNeedTypes = () => req("GET", "/needs/types");
export const createNeed = (n) => req("POST", "/needs/", n);
export const updateNeed = (id, n) => req("PUT", `/needs/${id}`, n);
export const deleteNeed = (id) => req("DELETE", `/needs/${id}`);

// ── Notes ───────────────────────────────────────────────────────────────────
export const getNotes = () => req("GET", "/notes/");
export const createNote = (n) => req("POST", "/notes/", n);
export const updateNote = (id, n) => req("PUT", `/notes/${id}`, n);
export const deleteNote = (id) => req("DELETE", `/notes/${id}`);

// ── Performance ─────────────────────────────────────────────────────────────
export const getPerformance = (dateFrom, dateTo) => {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  return req("GET", `/performance/${qs ? "?" + qs : ""}`);
};

// ── Auth (v2 Bloc 1) ────────────────────────────────────────────────────────
export const loginUser = (email, password) =>
  req("POST", "/auth/login", { email, password });
export const getMe = () => req("GET", "/auth/me");
export const logoutUser = () => req("POST", "/auth/logout");

// ── Difficultés (v2 Bloc 1) ─────────────────────────────────────────────────
export const getDifficulties = (taskId) =>
  req("GET", `/difficulties/?task_id=${taskId}`);
export const createDifficulty = (d) => req("POST", "/difficulties/", d);
export const deleteDifficulty = (id) => req("DELETE", `/difficulties/${id}`);

// ── Ordre du jour (v2 Bloc 2) ───────────────────────────────────────────────
export const getDailyOrder = (memberId, date) =>
  req("GET", `/daily-order/?member_id=${memberId}&date=${date}`);
export const setDailyOrderBulk = (data) =>
  req("POST", "/daily-order/bulk", data);
export const deleteDailyOrder = (id) => req("DELETE", `/daily-order/${id}`);

// ── Rapports (v2 Bloc 2) ────────────────────────────────────────────────────
export const getReportData = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") qs.set(k, v);
  });
  return req("GET", `/reports/data/?${qs.toString()}`);
};
