"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Port fidèle de frontend/src/components/reports/ReportsView.jsx (page
// conteneur) — export PDF via jsPDF (comme l'original), corrigé pour le
// superadmin dès le départ (canProjectReport inclut isSuperadmin).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { ReportsView } from "@/components/reports/ReportsView";
import { useAuth } from "@/lib/auth";
import type { Projet, Utilisateur } from "@/lib/types";

export default function RapportsPage() {
  const { user, isLogged, isAdmin, isChef, isSuperadmin } = useAuth();
  const router = useRouter();
  const [membres, setMembres] = useState<Utilisateur[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  useEffect(() => {
    Promise.all([api.getMembres(), api.getProjets()])
      .then(([m, p]) => { setMembres(m.filter((x) => x.statut === "ACTIF")); setProjets(p); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les rapports")));
  }, []);

  return (
    <AppShell>
      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}
      <ReportsView members={membres} projects={projets} user={user} isAdmin={isAdmin} isChef={isChef} isSuperadmin={isSuperadmin} />
    </AppShell>
  );
}
