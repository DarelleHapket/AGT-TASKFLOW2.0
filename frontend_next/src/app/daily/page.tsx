"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Port fidèle de frontend/src/components/daily/DailyOrderView.jsx (page
// conteneur) — référencée depuis le menu profil ("Ma journée"), route
// inexistante jusqu'ici (404).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { DailyOrderView } from "@/components/daily/DailyOrderView";
import { useAuth } from "@/lib/auth";
import type { Tache, Utilisateur } from "@/lib/types";

export default function DailyPage() {
  const { user, isLogged, isAdmin, isChef } = useAuth();
  const router = useRouter();
  const [taches, setTaches] = useState<Tache[]>([]);
  const [membres, setMembres] = useState<Utilisateur[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  useEffect(() => {
    Promise.all([api.getTaches(), api.getMembres()])
      .then(([t, m]) => { setTaches(t.tasks); setMembres(m.filter((x) => x.statut === "ACTIF")); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger votre journée")));
  }, []);

  return (
    <AppShell>
      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}
      <DailyOrderView tasks={taches} members={membres} user={user} isAdmin={isAdmin} isChef={isChef} />
    </AppShell>
  );
}
