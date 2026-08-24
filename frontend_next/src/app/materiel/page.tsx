"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Module 2 — Matériel (BF-09 à BF-11). Types de matériel (référentiel) +
// inventaire (création, quantité tenue à jour par les mouvements — voir
// /materiel/mouvements) + encart stock agrégé par type/projet.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import type { AlerteMateriel, Materiel, Projet, Stock, TypeAlerte, TypeMateriel } from "@/lib/types";

const ALERTE_LABEL: Record<TypeAlerte, string> = {
  rupture_stock: "Rupture de stock", anomalie: "Anomalie", rappel: "Rappel",
};

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
  const [alertes, setAlertes] = useState<AlerteMateriel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canWrite = hasPermission("materiel.write");

  useEffect(() => { if (!isLogged) router.replace("/login"); }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getTypesMateriel(), api.getInventaire(), api.getProjets(), api.getStock(), api.getAlertesMateriel("ouverte")])
      .then(([t, i, p, s, a]) => { setTypes(t); setInventaire(i); setProjets(p); setStock(s); setAlertes(a); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger le matériel")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const [reporting, setReporting] = useState(false);
  const [alerteMateriel, setAlerteMateriel] = useState("");
  const [alerteType, setAlerteType] = useState<TypeAlerte>("anomalie");
  const [alerteMessage, setAlerteMessage] = useState("");
  const [alerteErr, setAlerteErr] = useState<string | null>(null);

  async function signalerAlerte() {
    setAlerteErr(null);
    if (!alerteMateriel) { setAlerteErr("Choisissez un matériel."); return; }
    try {
      await api.createAlerteMateriel({ materiel: Number(alerteMateriel), type_alerte: alerteType, message: alerteMessage || undefined });
      setReporting(false); setAlerteMateriel(""); setAlerteType("anomalie"); setAlerteMessage("");
      load();
    } catch (e) {
      setAlerteErr(api.errorMessage(e, "Signalement impossible"));
    }
  }

  async function traiterAlerte(id: number) {
    await api.traiterAlerteMateriel(id);
    load();
  }

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

  // Types de matériel — modifier/supprimer (BF-02) : suppression bloquée
  // par le backend si du matériel y est rattaché (message clair, pas de 500).
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editTypeNom, setEditTypeNom] = useState("");
  const [typeErr, setTypeErr] = useState<string | null>(null);

  function commencerEditionType(t: TypeMateriel) {
    setEditingTypeId(t.id); setEditTypeNom(t.nom); setTypeErr(null);
  }

  async function enregistrerEditionType() {
    if (editingTypeId === null || !editTypeNom.trim()) return;
    setTypeErr(null);
    try {
      await api.updateTypeMateriel(editingTypeId, { nom: editTypeNom.trim() });
      setEditingTypeId(null);
      load();
    } catch (e) {
      setTypeErr(api.errorMessage(e, "Modification impossible"));
    }
  }

  async function supprimerType(t: TypeMateriel) {
    setTypeErr(null);
    try {
      await api.deleteTypeMateriel(t.id);
      load();
    } catch (e) {
      setTypeErr(api.errorMessage(e, `Impossible de supprimer « ${t.nom} »`));
    }
  }

  // Matériel — modifier (toujours possible, y compris avec des mouvements :
  // corriger un nom/une description ne touche pas l'historique) vs supprimer
  // (bloqué par le backend si des mouvements existent — message clair).
  const [editingMaterielId, setEditingMaterielId] = useState<number | null>(null);
  const [editMaterielNom, setEditMaterielNom] = useState("");
  const [editMaterielType, setEditMaterielType] = useState("");
  const [editMaterielProjet, setEditMaterielProjet] = useState("");
  const [materielErr, setMaterielErr] = useState<string | null>(null);

  function commencerEditionMateriel(m: Materiel) {
    setEditingMaterielId(m.id); setEditMaterielNom(m.nom); setEditMaterielType(String(m.type)); setEditMaterielProjet(m.projet ? String(m.projet) : "");
    setMaterielErr(null);
  }

  async function enregistrerEditionMateriel() {
    if (editingMaterielId === null || !editMaterielNom.trim() || !editMaterielType) return;
    setMaterielErr(null);
    try {
      await api.updateMateriel(editingMaterielId, {
        nom: editMaterielNom.trim(), type: Number(editMaterielType), projet: editMaterielProjet ? Number(editMaterielProjet) : null,
      });
      setEditingMaterielId(null);
      load();
    } catch (e) {
      setMaterielErr(api.errorMessage(e, "Modification impossible"));
    }
  }

  async function supprimerMateriel(m: Materiel) {
    setMaterielErr(null);
    try {
      await api.deleteMateriel(m.id);
      load();
    } catch (e) {
      setMaterielErr(api.errorMessage(e, `Impossible de supprimer « ${m.nom} »`));
    }
  }

  // Filtre par statut (nouveau BF) : "hors service" se lit sur la quantité —
  // un matériel dont le stock est retombé à 0 (mouvement hors service/
  // consommation) est archivé de fait, son historique reste intact. Ce
  // filtre évite que ces lignes ne polluent la vue par défaut.
  const [filtreStatut, setFiltreStatut] = useState<"" | "en_stock" | "hors_service">("");
  const inventaireAffiche = inventaire.filter((m) => {
    if (filtreStatut === "en_stock") return m.quantite > 0;
    if (filtreStatut === "hors_service") return m.quantite === 0;
    return true;
  });

  return (
    <AppShell>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Matériel</h2>
      <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Types, inventaire et stock. Le détail des mouvements est sur la page Mouvements</p>

      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}

      {loading ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p> : (
        <>
          {stock && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 14, marginBottom: 20 }}>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, marginBottom: 6 }}>STOCK TOTAL</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{stock.total}</div>
              </div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, marginBottom: 6 }}>ALERTES OUVERTES</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: stock.alertes_ouvertes > 0 ? "var(--danger)" : "var(--text)" }}>{stock.alertes_ouvertes}</div>
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

          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16, marginBottom: 20 }}>
            <div style={card}>
              <div style={{ ...sectionHead, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>ALERTES OUVERTES ({alertes.length})</span>
                <button onClick={() => setReporting((v) => !v)} style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}>
                  Signaler
                </button>
              </div>
              {reporting && (
                <div style={{ padding: 12, borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <select style={inp} value={alerteMateriel} onChange={(e) => setAlerteMateriel(e.target.value)}>
                    <option value="">Matériel concerné</option>
                    {inventaire.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                  <select style={inp} value={alerteType} onChange={(e) => setAlerteType(e.target.value as TypeAlerte)}>
                    <option value="anomalie">Anomalie</option>
                    {canWrite && <option value="rappel">Rappel (avant expiration)</option>}
                  </select>
                  <input style={inp} placeholder="Message (optionnel)" value={alerteMessage} onChange={(e) => setAlerteMessage(e.target.value)} />
                  {alerteErr && <span style={{ fontSize: 11, color: "var(--danger)" }}>{alerteErr}</span>}
                  <button onClick={signalerAlerte} style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer", fontWeight: 700 }}>Envoyer le signalement</button>
                </div>
              )}
              {alertes.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--danger)" }}>{ALERTE_LABEL[a.type_alerte]}</span>
                    <span style={{ fontSize: 12, color: "var(--text)", marginLeft: 8 }}>{a.materiel_nom}</span>
                    {a.message && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{a.message}</div>}
                  </div>
                  {canWrite && (
                    <button onClick={() => traiterAlerte(a.id)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--text-2)" }}>
                      Traiter
                    </button>
                  )}
                </div>
              ))}
              {alertes.length === 0 && !reporting && <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>Aucune alerte ouverte.</div>}
            </div>

            <div style={card}>
              <div style={sectionHead}>DERNIERS MOUVEMENTS</div>
              {stock?.derniers_mouvements.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{m.materiel_nom}</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>{m.type_mouvement}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>{new Date(m.date_mouvement).toLocaleDateString("fr-FR")}</span>
                </div>
              ))}
              {(!stock || stock.derniers_mouvements.length === 0) && <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>Aucun mouvement enregistré.</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]" style={{ gap: 16 }}>
            <div style={card}>
              <div style={sectionHead}>TYPES DE MATÉRIEL ({types.length})</div>
              {typeErr && <div style={{ padding: "8px 14px", fontSize: 11, color: "var(--danger)" }}>{typeErr}</div>}
              {types.map((t) => (
                <div key={t.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                  {editingTypeId === t.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input style={{ ...inp, flex: 1 }} value={editTypeNom} onChange={(e) => setEditTypeNom(e.target.value)} />
                      <button onClick={enregistrerEditionType} style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}>OK</button>
                      <button onClick={() => setEditingTypeId(null)} style={{ ...inp, cursor: "pointer" }}>Annuler</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t.nom}</span>
                      {canWrite && (
                        <>
                          <button onClick={() => commencerEditionType(t)} title="Modifier" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}><Pencil size={13} /></button>
                          <button onClick={() => supprimerType(t)} title="Supprimer" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}><X size={13} /></button>
                        </>
                      )}
                    </div>
                  )}
                </div>
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
                <div style={{ ...sectionHead, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>INVENTAIRE ({inventaireAffiche.length}{filtreStatut ? ` / ${inventaire.length}` : ""})</span>
                  <select style={{ ...inp, fontSize: 11, padding: "4px 8px" }} value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value as typeof filtreStatut)}>
                    <option value="">Tous les statuts</option>
                    <option value="en_stock">En stock</option>
                    <option value="hors_service">Hors service</option>
                  </select>
                </div>
                {materielErr && <div style={{ padding: "8px 14px", fontSize: 11, color: "var(--danger)" }}>{materielErr}</div>}
                {inventaireAffiche.map((m) => (
                  <div key={m.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                    {editingMaterielId === m.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <input style={inp} value={editMaterielNom} onChange={(e) => setEditMaterielNom(e.target.value)} placeholder="Nom" />
                        <select style={inp} value={editMaterielType} onChange={(e) => setEditMaterielType(e.target.value)}>
                          {types.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
                        </select>
                        <select style={inp} value={editMaterielProjet} onChange={(e) => setEditMaterielProjet(e.target.value)}>
                          <option value="">Aucun projet associé</option>
                          {projets.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                        </select>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={enregistrerEditionMateriel} style={{ ...inp, background: "var(--accent)", color: "white", border: "none", cursor: "pointer" }}>Enregistrer</button>
                          <button onClick={() => setEditingMaterielId(null)} style={{ ...inp, cursor: "pointer" }}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{m.nom}</span>
                          <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>{m.type_nom}{m.projet_nom ? ` · ${m.projet_nom}` : ""}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{m.quantite}</span>
                        {canWrite && (
                          <>
                            <button onClick={() => commencerEditionMateriel(m)} title="Modifier" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}><Pencil size={13} /></button>
                            <button onClick={() => supprimerMateriel(m)} title="Supprimer" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}><X size={13} /></button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {inventaireAffiche.length === 0 && <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>{filtreStatut ? "Aucun matériel pour ce statut." : "Aucun matériel enregistré."}</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
