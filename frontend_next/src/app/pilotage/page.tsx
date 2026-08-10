"use client";

// Port simplifié de team-tool frontend/src/app/taches (VuesTaches.tsx +
// DetailTache.tsx) — pilotage du travail de l'équipe elle-même (workflow de
// dev), distinct du métier ERP. Rendu en liste (pas le graphe SVG de branche
// GrapheBranche.tsx) : statut dérivé affiché + actions "avancer" limitées
// aux transitions réellement possibles depuis le nœud courant.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { PilotageBranch, PilotageTache, Utilisateur } from "@/lib/types";

const STATUT_LABEL: Record<string, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  en_validation: "En validation",
  bloque: "Bloqué",
  fait: "Fait",
};

export default function PilotagePage() {
  const { isLogged, user } = useAuth();
  const router = useRouter();
  const [taches, setTaches] = useState<PilotageTache[]>([]);
  const [branches, setBranches] = useState<PilotageBranch[]>([]);
  const [membres, setMembres] = useState<Utilisateur[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [titre, setTitre] = useState("");
  const [branchSlug, setBranchSlug] = useState("tronc");
  const [assignee, setAssignee] = useState<number | "">("");

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getPilotageTaches(), api.getPilotageBranches(), api.getMembres()])
      .then(([t, b, m]) => {
        setTaches(t);
        setBranches(b);
        setMembres(m.filter((x) => x.statut === "ACTIF"));
      })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger le pilotage")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function edgesDepuis(t: PilotageTache) {
    const branch = branches.find((b) => b.slug === t.branch);
    return branch?.edges.filter((e) => e.from_num === t.node.num) ?? [];
  }

  async function avancer(t: PilotageTache, toNum: number) {
    try {
      await api.avancerPilotageTache(t.id, toNum);
      load();
    } catch (e) {
      setError(api.errorMessage(e, "Transition refusée"));
    }
  }

  async function creerTache() {
    if (!titre.trim() || assignee === "") return;
    try {
      await api.createPilotageTache({ titre, branch: branchSlug, assignee: Number(assignee) });
      setTitre("");
      setCreating(false);
      load();
    } catch (e) {
      setError(api.errorMessage(e, "Création impossible"));
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-text">Pilotage du stage</h1>
        <button onClick={() => setCreating((v) => !v)} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white">
          + Nouvelle tâche
        </button>
      </div>
      <p className="mb-6 text-sm text-text-3">
        Suivi du travail de l&apos;équipe elle-même (dev, validation, tests), distinct des projets métier AG Technologies.
      </p>

      {creating && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-bg-card p-5 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold text-text-2">Titre</label>
            <input className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm" value={titre} onChange={(e) => setTitre(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-text-2">Branche</label>
            <select className="rounded-lg border border-border bg-bg-input px-3 py-2 text-sm" value={branchSlug} onChange={(e) => setBranchSlug(e.target.value)}>
              {branches.map((b) => <option key={b.slug} value={b.slug}>{b.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-text-2">Assigné</label>
            <select className="rounded-lg border border-border bg-bg-input px-3 py-2 text-sm" value={assignee} onChange={(e) => setAssignee(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Choisir</option>
              {membres.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <button onClick={creerTache} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white">Créer</button>
        </div>
      )}

      {loading && <p className="text-sm text-text-3">Chargement…</p>}
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-3">
        {taches.map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-text">{t.titre}</div>
                <div className="text-xs text-text-3">
                  {t.assignee_nom} · branche {t.branch} · validateur {t.validateur_nom || "aucun"}
                </div>
              </div>
              <span className="rounded-full bg-accent-bg px-2 py-0.5 text-[11px] font-semibold text-accent">
                {STATUT_LABEL[t.statut] ?? t.statut}
              </span>
            </div>
            <div className="text-xs text-text-3">Nœud actuel : {t.node.titre} {t.node.blocking && "(bloquant, validateur requis)"}</div>
            {!t.clos && edgesDepuis(t).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {edgesDepuis(t).map((e) => (
                  <button
                    key={e.to_num}
                    onClick={() => avancer(t, e.to_num)}
                    className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-text-2 hover:bg-bg-hover"
                  >
                    → {branches.find((b) => b.slug === t.branch)?.nodes.find((n) => n.num === e.to_num)?.titre}
                    {e.label && ` (${e.label})`}
                  </button>
                ))}
              </div>
            )}
            {t.sous_taches.length > 0 && (
              <ul className="mt-2 flex flex-col gap-0.5 border-t border-border pt-2">
                {t.sous_taches.map((s) => (
                  <li key={s.id} className="text-xs text-text-2">• {s.titre} : {STATUT_LABEL[s.statut] ?? s.statut}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {!loading && taches.length === 0 && <p className="text-sm text-text-3">Aucune tâche de pilotage visible pour {user?.name}.</p>}
      </div>
    </AppShell>
  );
}
