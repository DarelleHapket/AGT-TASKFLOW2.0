// Types partagés — reflète authentification.serializers.UserSerializer (backend_django).

export type StatutCompte = "EN_ATTENTE" | "ACTIF" | "SUSPENDU" | "SUPPRIME";

export interface Utilisateur {
  id: number;
  username: string;
  name: string;
  email: string;
  is_superuser: boolean;
  is_active: boolean;
  statut: StatutCompte;
  doit_changer_mdp: boolean;
  color: string;
  roles: string[];
  permissions_effectives: string[];
  deleted_at: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: Utilisateur;
}

export interface Permission {
  id: number;
  code: string;
  module: string;
  description: string;
}

export interface Role {
  id: number;
  code: string;
  description: string;
  permissions: Permission[];
}

// Détail par permission pour un membre — distingue une permission accordée
// via un rôle ("role") d'une permission accordée/retirée directement ("direct",
// IBAC, indépendant des rôles). null = ni l'un ni l'autre, jamais touchée.
export interface PermissionDetail {
  code: string;
  module: string;
  description: string;
  granted: boolean;
  source: "role" | "direct" | "superadmin" | null;
}

// ── Domaine métier (projets/activités/tâches) — reflète projets.serializers ──

export interface Projet {
  id: number;
  nom: string;
  description: string;
  date_creation: string;
  chef_name: string | null;
  member_count: number;
  user_role: "owner" | "manager" | "contributor" | null;
}

export interface MembreProjet {
  id: number;
  utilisateur: number;
  nom: string;
  role: "owner" | "manager" | "contributor";
  rejoint_le: string;
}

export interface Activite {
  id: number;
  nom: string;
  description: string;
  projet: number;
  project_name: string;
  createur: number | null;
  can_edit: boolean;
}

export type StatutTache = "todo" | "in_progress" | "blocked" | "done";
export type PermissionTache = "full" | "status_only" | "read_only";

export interface Tache {
  id: string;
  description: string;
  projet: number | null;
  activite: number | null;
  responsable: number | null;
  createur: number | null;
  duree: number;
  statut: StatutTache;
  priorite: "critique" | "haute" | "normale";
  date_creation: string;
  date_completion: string | null;
  date_debut: string | null;
  date_fin: string | null;
  date_echeance: string | null;
  est_archivee: boolean;
  dependances: string[];
  permission: PermissionTache;
  es: number | null;
  ef: number | null;
  ls: number | null;
  lf: number | null;
  slack: number | null;
  critical: boolean | null;
}

export interface TachesResponse {
  tasks: Tache[];
  pert_cycle_ids: string[];
}

// ── Besoins / Notes / Performance / Rapports ──────────────────────────────

export interface Besoin {
  id: number;
  titre: string;
  description: string;
  type: string;
  statut: string;
  projet: number | null;
  activite: number | null;
  project_name: string | null;
  activity_name: string | null;
  cree_le: string;
}

export interface Note {
  id: number;
  titre: string;
  contenu: string;
  projet: number | null;
  activite: number | null;
  tache: string | null;
  auteur: number | null;
  author_name: string | null;
  project_name: string | null;
  activity_name: string | null;
  cree_le: string;
  mis_a_jour_le: string;
}

export interface PerformanceEntry {
  member: string;
  task_count: number;
  total_coupons: number;
  by_project: { project: string; task_count: number; total_coupons: number }[];
}

export interface RapportTache {
  id: string;
  description: string;
  project_name: string;
  responsible: string | null;
  completed_at: string | null;
  due_date: string | null;
}

export interface RapportDifficulte {
  task_id: string; task_description: string; project_name: string;
  items: { content: string; member_name: string; created_at: string }[];
}

export interface RapportMembre {
  id: number;
  name: string;
  color: string;
  summary: {
    total_assigned: number;
    total_done: number;
    total_in_progress: number;
    total_blocked: number;
    total_overdue: number;
    total_coupons: number;
  };
  done_tasks: RapportTache[];
  in_progress_tasks: RapportTache[];
  blocked_tasks: RapportTache[];
  overdue_tasks: RapportTache[];
  difficulties: RapportDifficulte[];
}

export interface RapportData {
  generated_at: string;
  generated_by: string;
  period: string;
  date_from: string | null;
  date_to: string | null;
  members: RapportMembre[];
}

export interface RapportProjetMembre { name: string; total: number; done: number; coupons: number }

export interface RapportProjet {
  generated_at: string;
  generated_by: string;
  period: string;
  date_from: string | null;
  date_to: string | null;
  project: { id: number; name: string; description: string; chef_name: string | null };
  summary: {
    total_tasks: number; total_done: number; total_in_progress: number;
    total_blocked: number; total_overdue: number; total_coupons: number;
  };
  members: RapportProjetMembre[];
  done_tasks: RapportTache[];
  in_progress_tasks: RapportTache[];
  blocked_tasks: RapportTache[];
  overdue_tasks: RapportTache[];
  difficulties: RapportDifficulte[];
}

export interface Notification {
  id: number;
  type: string;
  titre: string;
  corps: string;
  tache_id: string | null;
  lu_le: string | null;
  cree_le: string;
  sender_name: string | null;
}

export interface OrdreJournalier {
  id: number;
  membre: number;
  tache: string;
  date: string;
  ordre: number;
  note: string;
  heure_debut: string | null;
  duree_min: number | null;
  description: string;
  status: StatutTache;
  priority: "critique" | "haute" | "normale";
  project_name: string | null;
}

export interface Sauvegarde {
  name: string;
  size_bytes: number;
  modified_at: string;
}

// ── Pilotage du stage (port team-tool tree/pert) ──────────────────────────

export interface PilotageNode {
  num: number;
  kind: "start" | "work" | "valid" | "auto" | "final";
  titre: string;
  x: number;
  y: number;
  blocking: boolean;
  detail: string;
}

export interface PilotageEdge {
  from_num: number;
  to_num: number;
  label: string;
}

export interface PilotageBranch {
  slug: string;
  nom: string;
  nodes: PilotageNode[];
  edges: PilotageEdge[];
}

export interface PilotageSousTache {
  id: number;
  tache: number;
  titre: string;
  statut: string;
  ordre: number;
}

export interface PilotageTache {
  id: number;
  titre: string;
  description: string;
  branch: string;
  assignee: number;
  assignee_nom: string;
  created_by_nom: string;
  validateur: number | null;
  validateur_nom: string;
  node: PilotageNode;
  statut: string;
  jour: string;
  clos: boolean;
  created_at: string;
  sous_taches: PilotageSousTache[];
}

// ── Module 3 — Profils & RH ───────────────────────────────────────────────

export interface Competence { id: number; nom: string; description: string }

export interface Responsabilite { id: number; poste: number; nom: string; competences_requises: number[] }

export interface Poste { id: number; nom: string; description: string; responsabilites: Responsabilite[] }

export interface Equipe { id: number; nom: string; membres: number[] }

export interface Profil {
  id: number; utilisateur: number; nom: string;
  poste: number | null; poste_nom: string | null;
  competences: number[]; est_employe: boolean; employe_id: number | null;
}

export interface TypeContrat { id: number; nom: string; description: string }

export type Periodicite = "mensuelle" | "hebdomadaire" | "journaliere";

export interface Remuneration { id: number; contrat: number; montant: string; periodicite: Periodicite; cree_le: string }

export interface Contrat {
  id: number; employe: number; type_contrat: number; type_contrat_nom: string;
  date_debut: string; date_fin: string | null; remunerations: Remuneration[];
}

export interface Employe { id: number; profil: number; nom: string; date_embauche: string; contrats: Contrat[] }

export type StatutDisponibilite = "disponible" | "indisponible";

export interface Disponibilite {
  id: number; employe: number; statut: StatutDisponibilite;
  periode_debut: string; periode_fin: string | null;
}

export interface OffreEmploi { id: number; poste: number; poste_nom: string; description: string; statut: string }

export type StatutCandidature = "recue" | "entretien" | "retenue" | "refusee";

export interface Candidat {
  id: number; offre: number; nom: string; contact: string; cv: string | null; statut: StatutCandidature;
}

export interface Formation { id: number; nom: string; description: string; competences_visees: number[] }

export type StatutInscriptionFormation = "prevue" | "en_cours" | "terminee";

export interface InscriptionFormation {
  id: number; employe: number; employe_nom: string; formation: number; formation_nom: string;
  statut: StatutInscriptionFormation;
}

export type StatutSignalement = "ouvert" | "traite";

export interface Signalement {
  id: number; auteur: number; auteur_nom: string; description: string; statut: StatutSignalement; cree_le: string;
}

// ── Module 4 — Finances ────────────────────────────────────────────────────

export type SensMouvement = "entree" | "sortie";

export interface TypeMouvementFinancier { id: number; nom: string; description: string; sens: SensMouvement }

export type NiveauFinancier = "entreprise" | "projet" | "employe";

export interface MouvementFinancier {
  id: number; type_mouvement: number; type_nom: string; sens: SensMouvement;
  montant: string; date_mouvement: string; niveau: NiveauFinancier;
  projet: number | null; projet_nom: string | null;
  employe: number | null; employe_nom: string | null;
  remuneration: number | null;
}

export interface Prevision {
  id: number; periode_debut: string; periode_fin: string; montant_prevu: string; niveau: NiveauFinancier;
  projet: number | null; projet_nom: string | null; employe: number | null; employe_nom: string | null;
}

export interface Bilan { entrees: string; sorties: string; solde: string }

export interface EcartPrevision { prevu: string; reel: string; ecart: string }

// ── Module 2 — Matériel ──────────────────────────────────────────────────

export interface TypeMateriel { id: number; nom: string; description: string }

export interface Materiel {
  id: number; nom: string; description: string;
  type: number; type_nom: string; quantite: number; date_achat: string;
  projet: number | null; projet_nom: string | null;
}

export type SensMouvementMateriel = "achat" | "affectation" | "retour" | "rebut";

export interface MouvementMateriel {
  id: number; materiel: number; materiel_nom: string; type_mouvement: SensMouvementMateriel;
  quantite: number; date_mouvement: string;
  projet: number | null; projet_nom: string | null;
  employe: number | null; employe_nom: string | null; commentaire: string;
}

export interface Stock {
  total: number;
  par_type: { type: string; quantite: number }[];
  par_projet: { projet: string; quantite: number }[];
}
