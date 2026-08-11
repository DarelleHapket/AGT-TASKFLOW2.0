"use client";

import { Lock } from "lucide-react";

export function AccessDenied({ code }: { code?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "48px 24px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        gap: 12,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#fff7ed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ea580c",
        }}
      >
        <Lock size={22} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
        Vous n&apos;avez pas encore accès à cette page
      </div>
      <div style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 360 }}>
        Contactez votre superadmin pour demander l&apos;accès nécessaire
        {code ? (
          <>
            {" "}
            (<code style={{ fontSize: 12 }}>{code}</code>)
          </>
        ) : null}
        .
      </div>
    </div>
  );
}
