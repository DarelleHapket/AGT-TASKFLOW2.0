"use client";

// Module 2 — Matériel (BF-09 à BF-11). Types de matériel (référentiel) +
// inventaire (création, quantité tenue à jour par les mouvements — voir
// /materiel/mouvements) + encart stock agrégé par type/projet.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { Materiel, Projet, Stock, TypeMateriel } from "@/lib/types";

const inp: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-card)", color: "var(--text)" };
const card: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden" };
const sectionHead: React.CSSProperties = { padding: "10px 14px", background: "var(--bg-hover)", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em" };

export default function MaterielPage() {
  const { isLogged, hasPermission } = useAuth();
  const router = useRouter();
  const [types, setTypes] = useState<TypeMateriel[]>([]);
  const [inventaire, setInventaire] = useState<Materiel[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [stock, setStock] = useState<Stock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canWrite = hasPermission("materiel.write");

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getTypesMateriel(), api.getInventaire(), api.getProjets(), api.getStock()])
      .then(([t, i, p, s]) => { setTypes(t); setInventaire(i); setProjets(p); setStock(s); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger le matériel")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const [newType, setNewType] = useState("");
  const [creating, setCreating] = useState(false);
  const [nom, setNom] = useState("");
  const [type, setType] = useState("");
  const [dateAchat, setDateAchat] = useState("");
  const [projet, setProjet] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);

  async function creerMateriel() {
    setCreateErr(null);
    if (!nom.trim() || !type || !dateAchat) {
      setCreateErr("Nom, type et date d'achat sont obligatoires.");
      return;
    }
    try {
      await api.createMateriel({ nom: nom.trim(), type: Number(type), date_achat: dateAchat, projet: projet ? Number(projet) : undefined });
      setCreating(false); setNom(""); setType(""); setDateAchat(""); setProjet("");
      load();
    } catch (e) {
      setCreateErr(api.errorMessage(e, "Création impossible"));
    }
  }

  return (
    <AppShell>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Matériel</h2>
      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Types, inventaire et stock — le détail des mouvements est sur la page Mouvements</p>

      {error && <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>}

      {loading ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p> : (
        <>
          {stock && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20, maxWidth: 760 }}>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, marginBottom: 6 }}>STOCK TOTAL</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{stock.total}</div>
              </div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, marginBottom: 6 }}>PAR TYPE</div>
                {stock.par_type.map((t) => <div key={t.type} style={{ fontSize: 12, color: "var(--text)" }}>{t.type} : <strong>{t.quantite}</strong></div>)}
                {stock.par_type.length === 0 && <span style={{ fontSize: 12, color: "var(--text-3)" }}>—</span>}
              </div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, marginBottom: 6 }}>PAR PROJET</div>
                {stock.par_projet.map((p) => <div key={p.projet} style={{ fontSize: 12, color: "var(--text)" }}>{p.projet} : <strong>{p.quantite}</strong></div>)}
                {stock.par_projet.length === 0 && <span style={{ fontSize: 12, color: "var(--text-3)" }}>—</span>}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
            <div style={card}>
              <div style={sectionHead}>TYPES DE MATÉRIEL ({types.length})</div>
              {types.map((t) => (
                <div key={t.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t.nom}</div>
              ))}
              {canWrite && (
                <div style={{ display: "flex", gap: 6, padding: 12 }}>
                  <input style={{ ...inp, flex: 1 }} value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Ex: Ordinateur, Licence" />
                  <button onClick={async () => { if (!newType.trim()) return; await api.createTypeMateriel({ nom: newType.trim() }); setNewType(""); load(); }}
                    style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}><Plus size={13} /></button>
                </div>
              )}
            </div>

            <div>
              {canWrite && (
                <div style={{ marginBottom: 12 }}>
                  {!creating ? (
                    <button onClick={() => setCreating(true)} style={{ background: "var(--accent)", color: "white", border: "none", padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                      <Plus size={15} /> Ajouter un matériel
                    </button>
                  ) : (
                    <div style={card}>
                      <div style={sectionHead}>NOUVEAU MATÉRIEL</div>
                      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
                        <input style={inp} placeholder="Nom (ex: Laptop Dell XPS)" value={nom} onChange={(e) => setNom(e.target.value)} />
                        <select style={inp} value={type} onChange={(e) => setType(e.target.value)}>
                          <option value="">Type de matériel</option>
                          {types.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                        </select>
                        <input style={inp} type="date" value={dateAchat} onChange={(e) => setDateAchat(e.target.value)} />
                        <select style={inp} value={projet} onChange={(e) => setProjet(e.target.value)}>
                          <option value="">Aucun projet associé</option>
                          {projets.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                        </select>
                        {createErr && <span style={{ fontSize: 11, color: "var(--danger)" }}>{createErr}</span>}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={creerMateriel} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Créer</button>
                          <button onClick={() => setCreating(false)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontSize: 12, color: "var(--text-2)" }}>Annuler</button>
                        </div>
                        <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>La quantité initiale s&apos;ajoute via un mouvement « Achat » depuis la page Mouvements.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={card}>
                <div style={sectionHead}>INVENTAIRE ({inventaire.length})</div>
                {inventaire.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{m.nom}</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>{m.type_nom}{m.projet_nom ? ` · ${m.projet_nom}` : ""}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{m.quantite}</span>
                  </div>
                ))}
                {inventaire.length === 0 && <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>Aucun matériel enregistré.</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
