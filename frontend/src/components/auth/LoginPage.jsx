// frontend/src/components/auth/LoginPage.jsx
//
// A-08 — Fond remplacé : bleu nuit (#0a0f1e) → cyan clair (#E1F2F5)
// Toutes les couleurs de texte adaptées pour rester lisibles sur fond clair.

import { useState, useEffect } from "react";
import { LogIn, Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle, UserPlus, Zap } from "lucide-react";

// Palette
const NAVY   = "#0D1B2A";   // texte principal
const SLATE  = "#475569";   // texte secondaire
const MUTED  = "#64748b";   // texte discret
const GHOST  = "#94a3b8";   // texte très discret
const ACCENT = "#6366f1";   // indigo (accent)
const BG     = "#E1F2F5";   // fond page

export function LoginPage({ onLogin }) {
  const [mode, setMode]         = useState("login");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState(null);
  const [mounted, setMounted]   = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem("agt_session_expired")) {
      setSessionExpired(true);
      localStorage.removeItem("agt_session_expired");
    }
  }, []);

  function switchMode() {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    if (mode === "register") { handleRegister(); return; }
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

  async function handleRegister() {
    if (!name || !email || !password) { setError("Nom, email et mot de passe requis"); return; }
    if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Impossible d'envoyer la demande"); return; }
      setSuccess(data.message || "Demande envoyée. En attente de validation par l'administrateur.");
      setName(""); setEmail(""); setPassword("");
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setLoading(false);
    }
  }

  // Style partagé champ de saisie
  const inputStyle = (field) => ({
    width: "100%",
    padding: field === "password" ? "13px 44px 13px 40px" : "13px 14px 13px 40px",
    background: focused === field ? "white" : "rgba(255,255,255,0.6)",
    border: `1.5px solid ${focused === field ? ACCENT : "rgba(0,150,170,0.25)"}`,
    borderRadius: 12, fontSize: 13, color: NAVY,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
    transition: "border-color 0.2s, background 0.2s",
  });

  const iconColor = (field) => focused === field ? ACCENT : MUTED;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: BG,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* ── Grille subtile sur fond clair ── */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0,150,170,0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,150,170,0.07) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
        pointerEvents: "none",
      }} />

      {/* ── Lueur indigo haut-gauche ── */}
      <div style={{
        position: "absolute", top: "-20%", left: "-10%",
        width: "60%", height: "70%",
        background: "radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      {/* ── Lueur cyan bas-droite ── */}
      <div style={{
        position: "absolute", bottom: "-20%", right: "-10%",
        width: "55%", height: "65%",
        background: "radial-gradient(ellipse, rgba(0,176,195,0.12) 0%, transparent 65%)",
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
              boxShadow: "0 0 28px rgba(99,102,241,0.35)",
            }}>
              <Zap size={22} color="white" fill="white" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: NAVY, letterSpacing: "-0.02em" }}>
              AGT TaskFlow
            </span>
          </div>

          {/* Titre principal */}
          <h1 style={{
            fontSize: 52, fontWeight: 800, color: NAVY,
            lineHeight: 1.1, letterSpacing: "-0.03em", margin: "0 0 20px",
          }}>
            Pilotez vos<br />
            <span style={{
              background: "linear-gradient(90deg, #6366f1, #00B4C8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              projets
            </span>{" "}avec<br />précision.
          </h1>

          <p style={{ fontSize: 16, color: SLATE, lineHeight: 1.7, maxWidth: 380, margin: 0 }}>
            Outil de pilotage interne d'AG Technologies — Tâches, Gantt, PERT et performances en temps réel.
          </p>

          {/* Stats */}
          <div style={{ display: "flex", gap: 40, marginTop: 56 }}>
            {[
              { val: "100%", label: "Usage interne" },
              { val: "3h",   label: "Par coupon" },
              { val: "∞",    label: "Productivité" },
            ].map(({ val, label }) => (
              <div key={label}>
                <div style={{ fontSize: 28, fontWeight: 800, color: NAVY, letterSpacing: "-0.02em" }}>{val}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{label}</div>
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
          background: "rgba(255,255,255,0.72)",
          border: "1px solid rgba(0,176,195,0.18)",
          borderRadius: 24, padding: 40,
          backdropFilter: "blur(24px)",
          boxShadow: "0 32px 80px rgba(0,100,130,0.12)",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(32px)",
          transition: "all 0.8s cubic-bezier(.16,1,.3,1) 0.15s",
        }}>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            {mode === "login" ? "Connexion" : "Demande de compte"}
          </h2>
          <p style={{ fontSize: 13, color: MUTED, margin: "0 0 32px" }}>
            {mode === "login"
              ? "Entrez vos identifiants pour accéder à votre espace"
              : "Votre demande sera transmise à l'administrateur pour validation"}
          </p>

          {/* Session expirée */}
          {sessionExpired && (
            <div style={{
              marginBottom: 16, padding: "10px 14px",
              background: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: 10,
              display: "flex", alignItems: "center", gap: 8,
              color: "#92400e", fontSize: 13,
            }}>
              <AlertCircle size={15} />
              Session expirée. Veuillez vous reconnecter.
            </div>
          )}

          {/* Message succès */}
          {success && (
            <div style={{
              marginBottom: 16, padding: "10px 14px",
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 10,
              display: "flex", alignItems: "center", gap: 8,
              color: "#15803d", fontSize: 13,
            }}>
              <CheckCircle size={15} />
              {success}
            </div>
          )}

          {/* Message erreur */}
          {error && (
            <div style={{
              marginBottom: 16, padding: "10px 14px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 10,
              display: "flex", alignItems: "center", gap: 8,
              color: "#dc2626", fontSize: 13,
              animation: "shake 0.3s ease",
            }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {/* Champ Nom — inscription uniquement */}
          {mode === "register" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: SLATE, display: "block", marginBottom: 8, letterSpacing: "0.08em" }}>
                NOM
              </label>
              <div style={{ position: "relative" }}>
                <User size={15} style={{
                  position: "absolute", left: 14, top: "50%",
                  transform: "translateY(-50%)",
                  color: iconColor("name"), transition: "color 0.2s",
                }} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocused("name")}
                  onBlur={() => setFocused(null)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="Votre nom"
                  style={inputStyle("name")}
                />
              </div>
            </div>
          )}

          {/* Champ Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: SLATE, display: "block", marginBottom: 8, letterSpacing: "0.08em" }}>
              ADRESSE EMAIL
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={15} style={{
                position: "absolute", left: 14, top: "50%",
                transform: "translateY(-50%)",
                color: iconColor("email"), transition: "color 0.2s",
              }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="gabriel@ag-technologies.tech"
                style={inputStyle("email")}
              />
            </div>
          </div>

          {/* Champ Mot de passe */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: SLATE, display: "block", marginBottom: 8, letterSpacing: "0.08em" }}>
              MOT DE PASSE
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={15} style={{
                position: "absolute", left: 14, top: "50%",
                transform: "translateY(-50%)",
                color: iconColor("password"), transition: "color 0.2s",
              }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="••••••••"
                style={inputStyle("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Masquer" : "Afficher"}
                style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  padding: 4, display: "flex", alignItems: "center",
                  color: iconColor("password"), transition: "color 0.2s",
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Bouton principal */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "14px",
              background: loading ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none", borderRadius: 12, color: "white",
              fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: loading ? "none" : "0 8px 28px rgba(99,102,241,0.35)",
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
                {mode === "login" ? "Connexion en cours…" : "Envoi en cours…"}
              </>
            ) : mode === "login" ? (
              <><LogIn size={16} /> Se connecter</>
            ) : (
              <><UserPlus size={16} /> Envoyer la demande</>
            )}
          </button>

          {/* Bascule login / inscription */}
          <p style={{ textAlign: "center", fontSize: 13, color: MUTED, marginTop: 24, marginBottom: 0 }}>
            {mode === "login" ? "Pas encore de compte ? " : "Vous avez déjà un compte ? "}
            <span
              onClick={switchMode}
              style={{ color: ACCENT, fontWeight: 700, cursor: "pointer" }}
            >
              {mode === "login" ? "Demander un compte" : "Se connecter"}
            </span>
          </p>

          <p style={{ textAlign: "center", color: GHOST, fontSize: 11, marginTop: 16, marginBottom: 0 }}>
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
        input::placeholder { color: rgba(100,116,139,0.55); }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px #E1F2F5 inset !important;
          -webkit-text-fill-color: #0D1B2A !important;
        }
      `}</style>
    </div>
  );
}
