import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmDialog({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") { data.onConfirm?.(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, onClose]);

  if (!data) return null;

  const danger = data.danger !== false;
  const accent = danger ? "#ef4444" : "var(--accent)";
  const accentBg = danger ? "#fef2f2" : "var(--accent-bg)";
  const accentBorder = danger ? "#fecaca" : "var(--border)";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, animation: "cdFade 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)", boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          width: "100%", maxWidth: 400, overflow: "hidden",
          animation: "cdPop 0.18s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div style={{ padding: "20px 20px 0", display: "flex", gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: accentBg,
            border: "1px solid " + accentBorder, display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <AlertTriangle size={19} style={{ color: accent }} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: "2px 0 4px", fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
              {data.title || "Confirmer l'action"}
            </h3>
            {data.message && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
                {data.message}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: 20 }}>
          <button
            onClick={onClose}
            style={{
              border: "1px solid var(--border)", background: "var(--bg)",
              borderRadius: 10, padding: "9px 16px", cursor: "pointer",
              color: "var(--text-2)", fontWeight: 600, fontSize: 13,
            }}
          >
            {data.cancelLabel || "Annuler"}
          </button>
          <button
            onClick={() => { data.onConfirm?.(); onClose(); }}
            style={{
              border: "none", background: accent, color: "white",
              borderRadius: 10, padding: "9px 18px", cursor: "pointer",
              fontWeight: 700, fontSize: 13,
            }}
          >
            {data.confirmLabel || "Confirmer"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cdFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cdPop { from { opacity: 0; transform: translateY(8px) scale(0.98) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}
