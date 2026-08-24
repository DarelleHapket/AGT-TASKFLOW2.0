"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Port fidèle de frontend/src/components/performance/PerformanceView.jsx
// (page conteneur).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { PerformanceView } from "@/components/performance/PerformanceView";
import { useAuth } from "@/lib/auth";
import type { Utilisateur } from "@/lib/types";

export default function PerformancePage() {
  const { isLogged } = useAuth();
  const router = useRouter();
  const [membres, setMembres] = useState<Utilisateur[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  useEffect(() => {
    api.getMembres().then(setMembres).catch((e) => setError(api.errorMessage(e, "Impossible de charger les performances")));
  }, []);

  return (
    <AppShell>
      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}
      <PerformanceView members={membres} />
    </AppShell>
  );
}
