"use client";
import { AccessDenied } from "@/components/AccessDenied";

// Port fidèle de frontend/src/components/notes/NotesView.jsx (page conteneur).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { NotesView } from "@/components/notes/NotesView";
import { useAuth } from "@/lib/auth";
import type { Activite, Note, Projet, Tache } from "@/lib/types";

export default function NotesPage() {
  const { user, isLogged } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [projets, setProjets] = useState<Projet[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [taches, setTaches] = useState<Tache[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLogged) router.replace("/login");
  }, [isLogged, router]);

  function load() {
    setLoading(true);
    Promise.all([api.getNotes(), api.getProjets(), api.getActivites(), api.getTaches()])
      .then(([n, p, a, t]) => { setNotes(n); setProjets(p); setActivites(a); setTaches(t.tasks); })
      .catch((e) => setError(api.errorMessage(e, "Impossible de charger les notes")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <AppShell>
      {error && (error.startsWith("Permission requise") ? <AccessDenied code={error.replace("Permission requise : ", "")} /> : <p style={{ marginBottom: 12, fontSize: 12, color: "var(--danger)" }}>{error}</p>)}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Chargement…</p>
      ) : (
        <NotesView
          notes={notes} projects={projets} activities={activites} tasks={taches} user={user}
          onAdd={async (d) => { await api.createNote(d); load(); }}
          onUpdate={async (id, d) => { await api.updateNote(id, d); load(); }}
          onDelete={async (id) => { await api.deleteNote(id); load(); }}
        />
      )}
    </AppShell>
  );
}
