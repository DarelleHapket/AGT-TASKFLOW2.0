"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Port fidèle de frontend/src/components/rbac/RBACView.jsx (page conteneur),
// réservé au Superadmin comme côté Flask (require_role("superadmin")).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { RBACView } from "@/components/rbac/RBACView";
import { useAuth } from "@/lib/auth";
import type { Permission, Role, Utilisateur } from "@/lib/types";

export default function RbacPage() {
  const { isLogged, isSuperadmin } = useAuth();
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [membres, setMembres] = useState<Utilisateur[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
    else if (!isSuperadmin) router.replace("/dashboard");
  }, [isLogged, isSuperadmin, router]);

  // silent=true pour les rafraîchissements déclenchés depuis RBACView (ajout/
  // retrait de rôle) : on ne remonte pas le spinner plein écran, qui
  // démonterait RBACView et refermerait le panneau de permissions ouvert.
  function load(silent = false) {
    if (!isSuperadmin) return;
    if (!silent) setLoading(true);
    Promise.all([api.getRoles(), api.getPermissions(), api.getMembres()])
      .then(([r, p, m]) => { setRoles(r); setPermissions(p); setMembres(m.filter((x) => x.statut === "ACTIF")); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger le RBAC")))
      .finally(() => { if (!silent) setLoading(false); });
  }
  useEffect(() => load(), [isSuperadmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSuperadmin) return null;

  return (
    <AppShell>
      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p>
      ) : (
        <RBACView members={membres} roles={roles} permissions={permissions} onReload={() => load(true)} />
      )}
    </AppShell>
  );
}
