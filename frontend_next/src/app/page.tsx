"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AuthLayout } from "@/components/auth/AuthLayout";

const NAVY = "#0D1B2A";
const MUTED = "#64748b";
const ACCENT = "#6366f1";

export default function Home() {
  const { isLogged, initializing } = useAuth();
  const router = useRouter();

  // `isLogged` est optimiste (true) tant que `initializing` — le temps de lire
  // le token dans localStorage (cf. lib/auth.tsx) — pour éviter un flash vers
  // /login sur les pages protégées. Cette page fait l'inverse (redirige vers
  // /dashboard si connecté) : il ne faut donc PAS se fier à `isLogged` avant
  // que l'état réel soit résolu, sinon tout visiteur non connecté est
  // optimistiquement renvoyé vers /dashboard, qui le rebalance vers /login —
  // la page d'accueil n'est alors jamais vue (bug trouvé le 2026-08-24).
  useEffect(() => {
    if (!initializing && isLogged) router.replace("/dashboard");
  }, [initializing, isLogged, router]);

  if (initializing) return null;
  if (isLogged) return null;

  return (
    <AuthLayout>
      <div className="w-full lg:w-[480px] p-6 lg:p-10" style={{ flex: 1, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <div style={{
          width: "100%", background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,176,195,0.18)",
          borderRadius: 24, padding: 40, backdropFilter: "blur(24px)", boxShadow: "0 32px 80px rgba(0,100,130,0.12)",
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Bienvenue
          </h2>
          <p style={{ fontSize: 13, color: MUTED, margin: "0 0 32px", lineHeight: 1.6 }}>
            Connectez-vous pour accéder à votre espace, ou demandez la création d&apos;un compte si vous n&apos;en avez pas encore.
          </p>

          <button onClick={() => router.push("/login")} style={{
            width: "100%", padding: "13px", borderRadius: 14, border: "none", cursor: "pointer",
            background: ACCENT, color: "white", fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12,
          }}>
            <LogIn size={16} /> Se connecter
          </button>

          <button onClick={() => router.push("/login?mode=register")} style={{
            width: "100%", padding: "13px", borderRadius: 14, cursor: "pointer",
            background: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(0,150,170,0.25)", color: NAVY, fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <UserPlus size={16} /> Créer un compte
          </button>

          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11, marginTop: 24, marginBottom: 0 }}>
            AG Technologies · Usage interne uniquement
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
