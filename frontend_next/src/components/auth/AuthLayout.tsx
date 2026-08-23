"use client";

// Coquille commune aux écrans non authentifiés (accueil, login) : fond
// décoratif + panneau de branding (logo, accroche, stats), extrait de
// app/login/page.tsx pour ne pas dupliquer ce bloc sur la page d'accueil.
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

const NAVY = "#0D1B2A";
const SLATE = "#475569";
const MUTED = "#64748b";
const BG = "#E1F2F5";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col lg:flex-row" style={{
      minHeight: "100vh", background: BG,
      fontFamily: "'DM Sans', system-ui, sans-serif", overflow: "hidden", position: "relative",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(rgba(0,150,170,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,150,170,0.07) 1px, transparent 1px)`,
        backgroundSize: "48px 48px", pointerEvents: "none",
      }} />
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "70%", background: "radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: "55%", height: "65%", background: "radial-gradient(ellipse, rgba(0,176,195,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div className="hidden lg:flex" style={{ flex: 1, flexDirection: "column", justifyContent: "center", padding: "60px 80px", position: "relative", zIndex: 1 }}>
        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(24px)", transition: "all 0.7s cubic-bezier(.16,1,.3,1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 64 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 28px rgba(99,102,241,0.35)" }}>
              <Zap size={22} color="white" fill="white" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: NAVY, letterSpacing: "-0.02em" }}>AGT TaskFlow</span>
          </div>

          <h1 style={{ fontSize: 52, fontWeight: 800, color: NAVY, lineHeight: 1.1, letterSpacing: "-0.03em", margin: "0 0 20px" }}>
            Pilotez vos<br />
            <span style={{ background: "linear-gradient(90deg, #6366f1, #00B4C8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>projets</span>{" "}avec<br />précision.
          </h1>

          <p style={{ fontSize: 16, color: SLATE, lineHeight: 1.7, maxWidth: 380, margin: 0 }}>
            Outil de pilotage interne d&apos;AG Technologies. Tâches, Gantt, PERT et performances en temps réel.
          </p>

          <div style={{ display: "flex", gap: 40, marginTop: 56 }}>
            {[
              { val: "100%", label: "Usage interne" },
              { val: "3h", label: "Par coupon" },
              { val: "∞", label: "Productivité" },
            ].map(({ val, label }) => (
              <div key={label}>
                <div style={{ fontSize: 28, fontWeight: 800, color: NAVY, letterSpacing: "-0.02em" }}>{val}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
