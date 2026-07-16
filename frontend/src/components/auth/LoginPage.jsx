// frontend/src/components/auth/LoginPage.jsx
import { useState, useEffect } from "react";
import { LogIn, Mail, Lock, AlertCircle, Zap } from "lucide-react";

export function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState(null);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleSubmit() {
    setError(null);
    if (!email || !password) { setError("Email et mot de passe requis"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Identifiants incorrects"); return; }
      onLogin(data.access_token, data.user);
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "#0a0f1e",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* ── Fond animé avec grille et lueurs ── */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `
          linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
      }} />
      <div style={{
        position: "absolute", top: "-20%", left: "-10%",
        width: "60%", height: "70%",
        background: "radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-20%", right: "-10%",
        width: "55%", height: "65%",
        background: "radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      {/* ── Panneau gauche — branding ── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "60px 80px",
        position: "relative", zIndex: 1,
      }}>
        <div style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.7s cubic-bezier(.16,1,.3,1)",
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 64 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 32px rgba(99,102,241,0.5)",
            }}>
              <Zap size={22} color="white" fill="white" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>
              AGT TaskFlow
            </span>
          </div>

          {/* Titre principal */}
          <h1 style={{
            fontSize: 52, fontWeight: 800, color: "white",
            lineHeight: 1.1, letterSpacing: "-0.03em", margin: "0 0 20px",
          }}>
            Pilotez vos<br />
            <span style={{
              background: "linear-gradient(90deg, #6366f1, #a78bfa)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              projets
            </span>{" "}avec<br />précision.
          </h1>

          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth: 380, margin: 0 }}>
            Outil de pilotage interne d'AG Technologies — Tâches, Gantt, PERT et performances en temps réel.
          </p>

          {/* Stats décoratifs */}
          <div style={{ display: "flex", gap: 40, marginTop: 56 }}>
            {[
              { val: "100%", label: "Usage interne" },
              { val: "3h",   label: "Par coupon" },
              { val: "∞",    label: "Productivité" },
            ].map(({ val, label }) => (
              <div key={label}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>{val}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Panneau droit — formulaire ── */}
      <div style={{
        width: 480, display: "flex", alignItems: "center",
        justifyContent: "center", padding: 40,
        position: "relative", zIndex: 1,
      }}>
        <div style={{
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24, padding: 40,
          backdropFilter: "blur(24px)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(32px)",
          transition: "all 0.8s cubic-bezier(.16,1,.3,1) 0.15s",
        }}>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: "white", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Connexion
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 32px" }}>
            Entrez vos identifiants pour accéder à votre espace
          </p>

          {/* Erreur */}
          {error && (
            <div style={{
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12, padding: "12px 16px", marginBottom: 24,
              display: "flex", alignItems: "center", gap: 10,
              color: "#fca5a5", fontSize: 13,
              animation: "shake 0.3s ease",
            }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {/* Champ Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 8, letterSpacing: "0.08em" }}>
              ADRESSE EMAIL
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={15} style={{
                position: "absolute", left: 14, top: "50%",
                transform: "translateY(-50%)",
                color: focused === "email" ? "#6366f1" : "rgba(255,255,255,0.25)",
                transition: "color 0.2s",
              }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="gabriel@ag-technologies.tech"
                style={{
                  width: "100%", padding: "13px 14px 13px 40px",
                  background: "rgba(255,255,255,0.06)",
                  border: `1.5px solid ${focused === "email" ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 12, fontSize: 13, color: "white",
                  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                  transition: "border-color 0.2s, background 0.2s",
                }}
              />
            </div>
          </div>

          {/* Champ Mot de passe */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 8, letterSpacing: "0.08em" }}>
              MOT DE PASSE
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={15} style={{
                position: "absolute", left: 14, top: "50%",
                transform: "translateY(-50%)",
                color: focused === "password" ? "#6366f1" : "rgba(255,255,255,0.25)",
                transition: "color 0.2s",
              }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="••••••••"
                style={{
                  width: "100%", padding: "13px 14px 13px 40px",
                  background: "rgba(255,255,255,0.06)",
                  border: `1.5px solid ${focused === "password" ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 12, fontSize: 13, color: "white",
                  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                  transition: "border-color 0.2s, background 0.2s",
                }}
              />
            </div>
          </div>

          {/* Bouton connexion */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "14px",
              background: loading ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none", borderRadius: 12, color: "white",
              fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: loading ? "none" : "0 8px 32px rgba(99,102,241,0.4)",
              transition: "all 0.2s", letterSpacing: "-0.01em",
              transform: loading ? "scale(0.98)" : "scale(1)",
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "white", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
                Connexion en cours…
              </>
            ) : (
              <><LogIn size={16} /> Se connecter</>
            )}
          </button>

          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 24, marginBottom: 0 }}>
            AG Technologies · Usage interne uniquement
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px #1a1f35 inset !important;
          -webkit-text-fill-color: white !important;
        }
      `}</style>
    </div>
  );
}