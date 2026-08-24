// Client API — port de frontend/src/api/client.js (AGT TaskFlow).
//
// Leçon de BUG-03 (Flask) : l'intercepteur 401 existait mais n'était jamais
// branché à logout(), laissant l'appli bloquée sur un token périmé. Ici,
// setUnauthorizedHandler est appelé explicitement au montage de AuthProvider
// (src/lib/auth.tsx) — voir le commentaire là-bas.
import type {
  Activite, AlerteMateriel, Besoin, Bilan, Candidat, Competence, Conge, Disponibilite, EcartPrevision, Employe, EmployeListe, Equipe,
  FichePaie, Formation, InscriptionFormation, LoginResponse, Materiel, MembreProjet, MouvementFinancier,
  MouvementMateriel, NiveauFinancier, Note, NoteFrais,
  Notification, OffreEmploi, OrdreJournalier, Periodicite, Permission, PermissionDetail, PerformanceEntry,
  PermissionProjetCode, PermissionProjetDetail,
  PilotageBranch, PilotageTache, Poste, Prevision, Profil, Projet, RapportData, RapportProjet,
  Role, Sauvegarde, Signalement, StatutCandidature, StatutDemande, StatutDisponibilite, StatutInscriptionFormation,
  Stock, Tache, TachesResponse, TypeAlerte, TypeContrat, TypeMateriel, TypeMouvementFinancier, SensMouvement,
  SensMouvementMateriel, Utilisateur,
} from "./types";

const BASE = "/api";
const TOKEN_KEY = "agt_token";

let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    unauthorizedHandler?.();
    throw new Error("Non autorisé");
  }

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* réponse vide (ex: DELETE) */
  }

  if (!res.ok) {
    const message = (data?.error as string) || (data?.detail as string) || `Erreur ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

// ── Auth ─────────────────────────────────────────────────────────────────
// Pas de slash final : le proxy de rewrite Next.js (next.config.mjs) ne le
// préserve pas dans les segments capturés par :path*, et les routes Django
// sont définies sans slash final (APPEND_SLASH=False) pour cette raison.
export const login = (email: string, password: string) =>
  req<LoginResponse>("POST", "/auth/login", { email, password });
export const register = (name: string, email: string, password: string) =>
  req<{ message: string }>("POST", "/auth/register", { name, email, password });
export const me = () => req<Utilisateur>("GET", "/auth/me");
export const changerMdp = (ancien: string, nouveau: string) =>
  req("POST", "/auth/changer-mdp", { ancien, nouveau });
export const updateMe = (data: { first_name?: string; color?: string }) =>
  req<Utilisateur>("PATCH", "/auth/me", data);

// ── Membres / RBAC ───────────────────────────────────────────────────────
export const getMembres = () => req<Utilisateur[]>("GET", "/membres");
export const validateMembre = (id: number, action: "approve" | "reject") =>
  req(`PUT`, `/membres/${id}/validate`, { action });
export const toggleActive = (id: number) => req<Utilisateur>(`PUT`, `/membres/${id}/toggle-active`);
export const deleteMembre = (id: number) => req<{ deleted: number }>("DELETE", `/membres/${id}`);
export const getDeletedMembres = () => req<Utilisateur[]>("GET", "/membres/deleted");
export const getRoles = () => req<Role[]>("GET", "/roles");
export const createRole = (data: { code: string; description?: string }) => req<Role>("POST", "/roles", data);
export const deleteRole = (id: number) => req<void>("DELETE", `/roles/${id}`);
export const setRolePermissions = (id: number, permission_ids: number[]) =>
  req<Role>("PATCH", `/roles/${id}`, { permission_ids });
export const getPermissions = () => req<Permission[]>("GET", "/permissions");
export const createPermission = (data: { code: string; module: string; description?: string }) =>
  req<Permission>("POST", "/permissions", data);
export const deletePermission = (id: number) => req<void>("DELETE", `/permissions/${id}`);
export const assignRole = (id: number, role: string) => req<Utilisateur>("POST", `/rbac/membres/${id}/roles`, { role });
export const revokeRole = (id: number, role: string) => req<Utilisateur>("DELETE", `/rbac/membres/${id}/roles/${role}`);
export const setMemberPermission = (id: number, permCode: string, granted: boolean) =>
  req<Utilisateur>("PUT", `/rbac/membres/${id}/permissions/${permCode}`, { granted });
export const getMemberPermissionsDetail = (id: number) =>
  req<PermissionDetail[]>("GET", `/rbac/membres/${id}/permissions`);

// ── Projets ──────────────────────────────────────────────────────────────
export const getProjets = () => req<Projet[]>("GET", "/projets");
export const createProjet = (data: { nom: string; description?: string }) =>
  req<Projet>("POST", "/projets", data);
export const updateProjet = (id: number, data: { nom: string; description?: string }) =>
  req<Projet>("PUT", `/projets/${id}`, data);
export const deleteProjet = (id: number) => req("DELETE", `/projets/${id}`);
export const getMembresProjet = (id: number) => req<MembreProjet[]>("GET", `/projets/${id}/membres`);
export const addMembreProjet = (id: number, utilisateur: number, role: "manager" | "contributor") =>
  req<MembreProjet>("POST", `/projets/${id}/membres`, { utilisateur, role });
export const updateMembreProjet = (pid: number, mid: number, role: "manager" | "contributor") =>
  req<MembreProjet>("PUT", `/projets/${pid}/membres/${mid}`, { role });
export const removeMembreProjet = (pid: number, mid: number) => req<void>("DELETE", `/projets/${pid}/membres/${mid}`);
export const getMembreProjetPermissions = (pid: number, mid: number) =>
  req<PermissionProjetDetail[]>("GET", `/projets/${pid}/membres/${mid}/permissions`);
export const setMembreProjetPermission = (pid: number, mid: number, code: PermissionProjetCode, granted: boolean) =>
  req<{ code: string; granted: boolean }>("PUT", `/projets/${pid}/membres/${mid}/permissions/${code}`, { granted });

// ── Activités ────────────────────────────────────────────────────────────
export const getActivites = (projetId?: number) =>
  req<Activite[]>("GET", `/activites${projetId ? `?projet=${projetId}` : ""}`);
export const createActivite = (data: { nom: string; description?: string; projet: number }) =>
  req<Activite>("POST", "/activites", data);
export const updateActivite = (id: number, data: { nom: string; description?: string }) =>
  req<Activite>("PUT", `/activites/${id}`, data);
export const deleteActivite = (id: number) => req("DELETE", `/activites/${id}`);

// ── Tâches ───────────────────────────────────────────────────────────────
export const getTaches = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return req<TachesResponse>("GET", `/taches${qs ? `?${qs}` : ""}`);
};
export const createTache = (data: Partial<Tache>) => req<Tache>("POST", "/taches", data);
export const updateTache = (id: string, data: Partial<Tache>) => req<Tache>("PUT", `/taches/${id}`, data);
export const patchTache = (id: string, data: Partial<Tache>) => req<Tache>("PATCH", `/taches/${id}`, data);
export const deleteTache = (id: string) => req("DELETE", `/taches/${id}`);
export const archiveTache = (id: string) => req<Tache>("PATCH", `/taches/${id}/archive`);
export const unarchiveTache = (id: string) => req<Tache>("PATCH", `/taches/${id}/unarchive`);

// ── Difficultés ──────────────────────────────────────────────────────────
export interface Difficulte { id: number; tache: string; membre: number; member_name: string; contenu: string; cree_le: string }
export const getDifficulties = (taskId: string) => req<Difficulte[]>("GET", `/difficultes?task_id=${taskId}`);
export const createDifficulty = (taskId: string, content: string) => req<Difficulte>("POST", "/difficultes/creer", { task_id: taskId, content });
export const deleteDifficulty = (id: number) => req("DELETE", `/difficultes/${id}`);

// ── Besoins ──────────────────────────────────────────────────────────────
export const getBesoins = () => req<Besoin[]>("GET", "/besoins");
export const createBesoin = (data: Partial<Besoin>) => req<Besoin>("POST", "/besoins", data);
export const updateBesoin = (id: number, data: Partial<Besoin>) => req<Besoin>("PUT", `/besoins/${id}`, data);
export const deleteBesoin = (id: number) => req("DELETE", `/besoins/${id}`);
export const getBesoinTypes = () => req<string[]>("GET", "/besoins-types");
export const getBesoinStatuts = () => req<string[]>("GET", "/besoins-statuts");

// ── Notes ────────────────────────────────────────────────────────────────
export const getNotes = () => req<Note[]>("GET", "/notes");
export const createNote = (data: Partial<Note>) => req<Note>("POST", "/notes", data);
export const updateNote = (id: number, data: Partial<Note>) => req<Note>("PUT", `/notes/${id}`, data);
export const deleteNote = (id: number) => req("DELETE", `/notes/${id}`);

// ── Performance / Rapports ───────────────────────────────────────────────
export const getPerformance = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return req<PerformanceEntry[]>("GET", `/performance${qs ? `?${qs}` : ""}`);
};
export const getRapportData = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return req<RapportData>("GET", `/rapports/data${qs ? `?${qs}` : ""}`);
};
export const getProjectReport = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return req<RapportProjet>("GET", `/rapports/projet${qs ? `?${qs}` : ""}`);
};

// ── Administration (sauvegardes) ────────────────────────────────────────
export const listBackups = () => req<{ is_postgres: boolean; backups: Sauvegarde[] }>("GET", "/admin/backups");
export const createBackup = () => req<{ created: string }>("POST", "/admin/backups/creer");
export const deleteBackup = (nom: string) => req("DELETE", `/admin/backups/${nom}`);

export async function downloadBackup(nom: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE}/admin/backups/${nom}/telecharger`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nom; a.click();
  URL.revokeObjectURL(url);
}

// Import destructif — confirmation="REMPLACER" requise côté serveur (port
// de team-tool D-05 : remplace toute la base courante par la sauvegarde).
export async function importBackup(file: File, confirmation: string): Promise<{ message: string }> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  form.append("confirmation", confirmation);
  const res = await fetch(`${BASE}/admin/backups/importer`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
  return data;
}

// ── Ma journée (ordre journalier) ───────────────────────────────────────
export const getDailyOrder = (memberId: number | string, date: string) =>
  req<OrdreJournalier[]>("GET", `/ordre-journalier?member_id=${memberId}&date=${date}`);
export interface DailyOrderTaskInput { task_id: string; order_index: number; note: string; start_time: string | null; duration_min: number | null }
export const setDailyOrderBulk = (data: { member_id: number | string; date: string; tasks: DailyOrderTaskInput[] }) =>
  req<{ success: boolean; count: number }>("POST", "/ordre-journalier/bulk", data);
export const deleteDailyOrder = (id: number) => req<{ deleted: number }>("DELETE", `/ordre-journalier/${id}`);

// ── Notifications (cloche) ───────────────────────────────────────────────
export const getNotifications = () => req<Notification[]>("GET", "/notifications");
export const markNotificationRead = (id: number) => req("PATCH", `/notifications/${id}/read`);
export const markAllNotificationsRead = () => req("PATCH", "/notifications/read-all");
export const deleteNotification = (id: number) => req("DELETE", `/notifications/${id}/delete`);
export const deleteAllNotifications = () => req("DELETE", "/notifications/delete-all");

// ── Pilotage du stage ────────────────────────────────────────────────────
export const getPilotageBranches = () => req<PilotageBranch[]>("GET", "/pilotage/branches");
export const getPilotageTaches = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return req<PilotageTache[]>("GET", `/pilotage/taches${qs ? `?${qs}` : ""}`);
};
export const createPilotageTache = (data: { titre: string; description?: string; branch: string; assignee: number }) =>
  req<PilotageTache>("POST", "/pilotage/taches", data);
export const avancerPilotageTache = (id: number, to_num: number, commentaire?: string) =>
  req<PilotageTache>("POST", `/pilotage/taches/${id}/avancer`, { to_num, commentaire });
export const soliciterPilotageTache = (id: number, vers: number, message: string) =>
  req<PilotageTache>("POST", `/pilotage/taches/${id}/solliciter`, { vers, message });

// ── Module 3 — Profils & RH ───────────────────────────────────────────────
export const getCompetences = () => req<Competence[]>("GET", "/rh/competences");
export const createCompetence = (data: { nom: string; description?: string }) => req<Competence>("POST", "/rh/competences", data);
export const getPostes = () => req<Poste[]>("GET", "/rh/postes");
export const createPoste = (data: { nom: string; description?: string }) => req<Poste>("POST", "/rh/postes", data);
export const getEquipes = () => req<Equipe[]>("GET", "/rh/equipes");
export const createEquipe = (data: { nom: string; membres?: number[] }) => req<Equipe>("POST", "/rh/equipes", data);
export const getTypesContrat = () => req<TypeContrat[]>("GET", "/rh/types-contrat");
export const createTypeContrat = (data: { nom: string; description?: string }) => req<TypeContrat>("POST", "/rh/types-contrat", data);
export const getMonProfil = () => req<Profil>("GET", "/rh/profils/moi");
export const getProfil = (id: number) => req<Profil>("GET", `/rh/profils/${id}`);
export const getProfilParUtilisateur = (utilisateurId: number) => req<Profil>("GET", `/rh/profils/par-utilisateur?utilisateur=${utilisateurId}`);
export const updateProfil = (id: number, data: { poste?: number | null; competences?: number[] }) =>
  req<Profil>("PATCH", `/rh/profils/${id}`, data);
export const creerEmploye = (data: { profil: number; type_contrat: number; date_embauche: string; montant: string; periodicite?: Periodicite }) =>
  req<Employe>("POST", "/rh/employes", data);
export const getEmployes = () => req<EmployeListe[]>("GET", "/rh/employes");
export const getMonSalaire = () => req<Employe>("GET", "/rh/employes/moi/salaire");
export const getSalaireEmploye = (id: number) => req<Employe>("GET", `/rh/employes/${id}/salaire`);
export const changerRemuneration = (id: number, data: { montant: string; periodicite?: Periodicite }) =>
  req<Employe>("POST", `/rh/employes/${id}/remuneration`, data);
export const getDisponibilites = () => req<Disponibilite[]>("GET", "/rh/disponibilites");
export const createDisponibilite = (data: { employe: number; statut: StatutDisponibilite; periode_debut: string; periode_fin?: string }) =>
  req<Disponibilite>("POST", "/rh/disponibilites", data);
export const getOffres = () => req<OffreEmploi[]>("GET", "/rh/offres");
export const createOffre = (data: { poste: number; description?: string }) => req<OffreEmploi>("POST", "/rh/offres", data);
export const getCandidats = () => req<Candidat[]>("GET", "/rh/candidats");
export const createCandidat = (data: { offre: number; nom: string; contact: string }) => req<Candidat>("POST", "/rh/candidats", data);
export const updateCandidatStatut = (id: number, data: { offre: number; nom: string; contact: string; statut: StatutCandidature }) =>
  req<Candidat>("PUT", `/rh/candidats/${id}`, data);
export const getFormations = () => req<Formation[]>("GET", "/rh/formations");
export const createFormation = (data: { nom: string; description?: string; competences_visees?: number[] }) => req<Formation>("POST", "/rh/formations", data);
export const getInscriptionsFormation = () => req<InscriptionFormation[]>("GET", "/rh/inscriptions-formation");
export const createInscriptionFormation = (data: { employe: number; formation: number }) => req<InscriptionFormation>("POST", "/rh/inscriptions-formation", data);
export const updateInscriptionFormationStatut = (id: number, statut: StatutInscriptionFormation) =>
  req<InscriptionFormation>("PUT", `/rh/inscriptions-formation/${id}`, { statut });
export const getSignalements = () => req<Signalement[]>("GET", "/rh/signalements");
export const createSignalement = (description: string) => req<Signalement>("POST", "/rh/signalements", { description });
export const traiterSignalement = (id: number) => req<Signalement>("PATCH", `/rh/signalements/${id}`, { statut: "traite" });
export const supprimerSignalement = (id: number) => req<void>("DELETE", `/rh/signalements/${id}`);

// Espace salarié — congés & notes de frais (hors CDC initial, ajouté le 2026-08-10).
export const getConges = () => req<Conge[]>("GET", "/rh/conges");
export const createConge = (data: { date_debut: string; date_fin: string; motif?: string }) =>
  req<Conge>("POST", "/rh/conges", data);
export const traiterConge = (id: number, statut: StatutDemande, commentaire_validation?: string) =>
  req<Conge>("PATCH", `/rh/conges/${id}`, { statut, commentaire_validation });
export const annulerConge = (id: number) => req<void>("DELETE", `/rh/conges/${id}`);

export const getNotesFrais = () => req<NoteFrais[]>("GET", "/rh/notes-frais");
export const createNoteFrais = (data: { montant: string; motif: string; date_depense: string }) =>
  req<NoteFrais>("POST", "/rh/notes-frais", data);
export const traiterNoteFrais = (id: number, statut: StatutDemande, commentaire_validation?: string) =>
  req<NoteFrais>("PATCH", `/rh/notes-frais/${id}`, { statut, commentaire_validation });
export const annulerNoteFrais = (id: number) => req<void>("DELETE", `/rh/notes-frais/${id}`);

// BF-54 : historique des fiches de paie générées par le cron mensuel (BF-26).
export const getMesFichesPaie = () => req<FichePaie[]>("GET", "/rh/fiches-paie/moi");

// ── Module 4 — Finances ────────────────────────────────────────────────────
export const getTypesMouvement = () => req<TypeMouvementFinancier[]>("GET", "/finances/types-mouvement");
export const createTypeMouvement = (data: { nom: string; description?: string; sens: SensMouvement }) =>
  req<TypeMouvementFinancier>("POST", "/finances/types-mouvement", data);
export const updateTypeMouvement = (id: number, data: { nom?: string; description?: string; sens?: SensMouvement }) =>
  req<TypeMouvementFinancier>("PATCH", `/finances/types-mouvement/${id}`, data);
export const deleteTypeMouvement = (id: number) => req<void>("DELETE", `/finances/types-mouvement/${id}`);
export const getMouvements = () => req<MouvementFinancier[]>("GET", "/finances/mouvements");
export const createMouvement = (data: { type_mouvement: number; montant: string; niveau: NiveauFinancier; projet?: number; employe?: number }) =>
  req<MouvementFinancier>("POST", "/finances/mouvements", data);
export const getBilan = (params: { date_from: string; date_to: string; niveau?: string; projet?: string; employe?: string }) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return req<Bilan>("GET", `/finances/bilan?${qs}`);
};
export const getPrevisions = () => req<Prevision[]>("GET", "/finances/previsions");
export const createPrevision = (data: { periode_debut: string; periode_fin: string; montant_prevu: string; niveau: NiveauFinancier; projet?: number; employe?: number }) =>
  req<Prevision>("POST", "/finances/previsions", data);
export const getEcartPrevision = (id: number) => req<EcartPrevision>("GET", `/finances/previsions/${id}/ecart`);
export const creerRapportFinancier = (data: { format: "pdf" | "txt"; periode_debut: string; periode_fin: string }) =>
  req("POST", "/finances/rapports", data);

// ── Module 2 — Matériel ──────────────────────────────────────────────────
export const getTypesMateriel = () => req<TypeMateriel[]>("GET", "/materiel/types");
export const createTypeMateriel = (data: { nom: string; description?: string }) =>
  req<TypeMateriel>("POST", "/materiel/types", data);
export const updateTypeMateriel = (id: number, data: { nom?: string; description?: string }) =>
  req<TypeMateriel>("PATCH", `/materiel/types/${id}`, data);
export const deleteTypeMateriel = (id: number) => req<void>("DELETE", `/materiel/types/${id}`);
export const getInventaire = () => req<Materiel[]>("GET", "/materiel/inventaire");
export const createMateriel = (data: { nom: string; description?: string; type: number; date_achat: string; projet?: number }) =>
  req<Materiel>("POST", "/materiel/inventaire", data);
export const updateMateriel = (id: number, data: { nom?: string; description?: string; type?: number; projet?: number | null }) =>
  req<Materiel>("PATCH", `/materiel/inventaire/${id}`, data);
export const deleteMateriel = (id: number) => req<void>("DELETE", `/materiel/inventaire/${id}`);
export const getStock = () => req<Stock>("GET", "/materiel/stock");
export const getMouvementsMateriel = () => req<MouvementMateriel[]>("GET", "/materiel/mouvements");
export const createMouvementMateriel = (data: { materiel: number; type_mouvement: SensMouvementMateriel; quantite: number; projet?: number; employe?: number; commentaire?: string }) =>
  req<MouvementMateriel>("POST", "/materiel/mouvements", data);
export const getAlertesMateriel = (statut?: string) =>
  req<AlerteMateriel[]>("GET", statut ? `/materiel/alertes?statut=${statut}` : "/materiel/alertes");
export const createAlerteMateriel = (data: { materiel: number; type_alerte: TypeAlerte; message?: string }) =>
  req<AlerteMateriel>("POST", "/materiel/alertes", data);
export const traiterAlerteMateriel = (id: number) => req<AlerteMateriel>("POST", `/materiel/alertes/${id}/traiter`);

export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export { req };
