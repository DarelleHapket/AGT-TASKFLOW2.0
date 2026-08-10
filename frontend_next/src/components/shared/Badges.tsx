// Port fidèle de frontend/src/components/shared/Badges.jsx.
import { STATUSES } from "@/lib/pert";
import type { StatutTache } from "@/lib/types";

export function StatusBadge({ statut }: { statut: StatutTache }) {
  const s = STATUSES.find((x) => x.value === statut) || STATUSES[0];
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.color + "18", color: s.color, border: `1px solid ${s.color}33`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

export function CriticalBadge() {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 9, fontWeight: 700, background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", letterSpacing: ".06em" }}>
      ● CRITIQUE
    </span>
  );
}

export function MemberBadge({ name, color }: { name?: string | null; color?: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: (color || "#6366f1") + "18", color: color || "#6366f1", border: `1px solid ${(color || "#6366f1")}33`, whiteSpace: "nowrap" }}>
      {name || "Non assigné"}
    </span>
  );
}

export function TaskIdBadge({ id }: { id: string }) {
  return (
    <code style={{ fontSize: 10, color: "#64748b", background: "#f1f5f9", padding: "1px 7px", borderRadius: 4, border: "1px solid #e2e8f0", fontFamily: "'DM Mono', monospace" }}>
      {id}
    </code>
  );
}
