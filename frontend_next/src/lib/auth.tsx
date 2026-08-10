"use client";

// Port de frontend/src/hooks/useAuth.js — en contexte React (Next.js) plutôt
// qu'un hook autonome, pour que tout l'arbre de composants partage le même
// état de connexion.
//
// BUG-03 (Flask) non reproduit : ici, setUnauthorizedHandler est bien branché
// sur logout() dans le useEffect ci-dessous, dès le montage du provider — pas
// seulement défini quelque part sans jamais être appelé.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as api from "./api";
import { setToken, setUnauthorizedHandler } from "./api";
import type { Utilisateur } from "./types";

const USER_KEY = "agt_user";
const SESSION_EXPIRED_KEY = "agt_session_expired";

interface AuthState {
  user: Utilisateur | null;
  isLogged: boolean;
  isSuperadmin: boolean;
  isAdmin: boolean;
  isChef: boolean;
  hasPermission: (code: string) => boolean;
  login: (token: string, user: Utilisateur) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function loadUser(): Utilisateur | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // État initial toujours null (y compris côté client) pour correspondre au
  // rendu serveur, qui n'a jamais accès à localStorage — lire l'utilisateur
  // dans l'initialiseur de useState causait un mismatch d'hydratation
  // systématique (serveur: null, client: utilisateur réel dès le premier
  // rendu), React jetait alors tout le HTML serveur et re-rendait à froid
  // côté client sur CHAQUE page. Lu à la place dans un effet, après montage.
  const [user, setUser] = useState<Utilisateur | null>(null);
  // `initializing` (littéral, pas de lecture externe) est identique au
  // premier rendu serveur et client — pas de mismatch possible. Tant qu'il
  // est vrai, isLogged reste optimiste (true) pour que les ~25 pages qui
  // font `if (!isLogged) router.replace("/login")` dans leur propre effet
  // ne redirigent pas avant que cet effet-ci (sur le composant parent
  // AuthProvider) ait eu la chance de restaurer l'utilisateur — les effets
  // des enfants se déclenchent toujours avant ceux du parent.
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    setUser(loadUser());
    setInitializing(false);
  }, []);

  const login = useCallback((token: string, u: Utilisateur) => {
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!api.getToken()) return;
    try {
      const fresh = await api.me();
      localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      setUser(fresh);
    } catch {
      // token invalide -> l'intercepteur 401 gère déjà le logout, rien à faire ici
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.setItem(SESSION_EXPIRED_KEY, "1");
      logout();
    });
  }, [logout]);

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roles = user?.roles ?? [];
  const permissions = user?.permissions_effectives ?? [];
  const isSuperadmin = roles.includes("superadmin");
  const value: AuthState = {
    user,
    isLogged: initializing ? true : !!user,
    isSuperadmin,
    isAdmin: roles.includes("admin"),
    isChef: roles.includes("chef_projet"),
    hasPermission: (code) => isSuperadmin || permissions.includes(code),
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}

export function consumeSessionExpiredFlag(): boolean {
  if (typeof window === "undefined") return false;
  const had = !!localStorage.getItem(SESSION_EXPIRED_KEY);
  if (had) localStorage.removeItem(SESSION_EXPIRED_KEY);
  return had;
}
