"use client";

// Port fidèle de WidgetsGlobaux.jsx + WidgetsPersonnels.jsx + WidgetsAVenir.jsx,
// enrichi de liens de navigation : chaque widget mène désormais à la page
// filtrée correspondante (ex. "Membres actifs" -> /membres), pour rester
// intuitif plutôt que purement décoratif.
import Link from "next/link";

function Widget({ label, value, color, href }: { label: string; value: number; color?: string; href?: string }) {
  const content = (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)", cursor: href ? "pointer" : "default", transition: "border-color .15s, transform .15s" }}>
      <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || "var(--text)" }}>{value}</div>
    </div>
  );
  if (!href) return content;
  return <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>{content}</Link>;
}

export function WidgetsGlobaux({ membersActifs, demandesEnAttente, projetsCount, rolesActifs }: {
  membersActifs: number; demandesEnAttente: number; projetsCount: number; rolesActifs: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 14, marginBottom: 24 }}>
      <Widget label="MEMBRES ACTIFS" value={membersActifs} href="/membres" />
      <Widget label="DEMANDES EN ATTENTE" value={demandesEnAttente} href="/membres" />
      <Widget label="PROJETS" value={projetsCount} href="/projets" />
      <Widget label="RÔLES ACTIFS" value={rolesActifs} href="/rbac" />
    </div>
  );
}

export function WidgetsChef({ mesProjets, monEquipe, tachesEnCours, difficultesSignalees }: {
  mesProjets: number; monEquipe: number; tachesEnCours: number; difficultesSignalees: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 14, marginBottom: 24 }}>
      <Widget label="MES PROJETS" value={mesProjets} href="/projets" />
      <Widget label="MON ÉQUIPE" value={monEquipe} href="/membres" />
      <Widget label="TÂCHES EN COURS" value={tachesEnCours} href="/taches?status=in_progress" />
      <Widget label="DIFFICULTÉS SIGNALÉES" value={difficultesSignalees} color="var(--warning, #f59e0b)" />
    </div>
  );
}

export function WidgetsMembre({ mesTaches, enCours, terminees, enRetard, userId }: {
  mesTaches: number; enCours: number; terminees: number; enRetard: number; userId: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 14, marginBottom: 24 }}>
      <Widget label="MES TÂCHES" value={mesTaches} href={`/taches?member=${userId}`} />
      <Widget label="EN COURS" value={enCours} color="#2563eb" href={`/taches?member=${userId}&status=in_progress`} />
      <Widget label="TERMINÉES" value={terminees} color="var(--success, #22c55e)" href={`/taches?member=${userId}&status=done`} />
      <Widget label="EN RETARD" value={enRetard} color={enRetard > 0 ? "var(--danger)" : "var(--text)"} href={`/taches?member=${userId}&overdue=1`} />
    </div>
  );
}

function WidgetVide({ label }: { label: string }) {
  return (
    <div style={{ background: "var(--bg-hover)", border: "1.5px dashed var(--border-2, #cbd5e1)", borderRadius: "var(--radius-lg)", padding: 18, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>▢</div>
      {label}
    </div>
  );
}

function WidgetTexte({ label, value, href, sublabel }: { label: string; value: string; href: string; sublabel?: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)", cursor: "pointer" }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{value}</div>
        {sublabel && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", marginTop: 4 }}>{sublabel}</div>}
      </div>
    </Link>
  );
}

// Encarts RH (BF-24), Finances (BF-31) et Matériel (BF-14). Chaque encart
// retombe en WidgetVide si l'utilisateur n'a pas la permission de lecture
// correspondante (rare pour un profil qui voit déjà cette section, mais
// respecte le RBAC/IBAC à la marge).
export function WidgetsRessources({ canRh, canFinances, canMateriel, postes, equipes, soldeMois, stockTotal, alertesOuvertes }: {
  canRh: boolean; canFinances: boolean; canMateriel: boolean;
  postes: number; equipes: number; soldeMois: string | null; stockTotal: number | null; alertesOuvertes?: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 14, marginBottom: 24 }}>
      {canMateriel ? (
        <WidgetTexte
          label="MATÉRIEL — STOCK TOTAL"
          value={stockTotal !== null ? String(stockTotal) : "—"}
          sublabel={alertesOuvertes ? `${alertesOuvertes} alerte${alertesOuvertes !== 1 ? "s" : ""} ouverte${alertesOuvertes !== 1 ? "s" : ""}` : undefined}
          href="/materiel"
        />
      ) : (
        <WidgetVide label="Matériel" />
      )}
      {canRh ? (
        <WidgetTexte label="RH" value={`${postes} poste${postes !== 1 ? "s" : ""} · ${equipes} équipe${equipes !== 1 ? "s" : ""}`} href="/rh" />
      ) : (
        <WidgetVide label="RH" />
      )}
      {canFinances ? (
        <WidgetTexte label="FINANCES — SOLDE DU MOIS" value={soldeMois ?? "—"} href="/finances/bilan" />
      ) : (
        <WidgetVide label="Finances" />
      )}
    </div>
  );
}
