"use client";

// Port fidèle de frontend/src/components/needs/NeedsView.jsx (page conteneur).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { NeedsView } from "@/components/needs/NeedsView";
import { useAuth } from "@/lib/auth";
import type { Activite, Besoin, Projet } from "@/lib/types";

export default function BesoinsPage() {
  const { isLogged } = useAuth();
  const router = useRouter();
  const [besoins, setBesoins] = useState<Besoin[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getBesoins(), api.getProjets(), api.getActivites()])
      .then(([b, p, a]) => { setBesoins(b); setProjets(p); setActivites(a); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les besoins")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <AppShell>
      {error && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p>
      ) : (
        <NeedsView
          needs={besoins} projects={projets} activities={activites}
          onAdd={async (d) => { await api.createBesoin(d); load(); }}
          onUpdate={async (id, d) => { await api.updateBesoin(id, d); load(); }}
          onDelete={async (id) => { await api.deleteBesoin(id); load(); }}
        />
      )}
    </AppShell>
  );
}
