// frontend/src/hooks/useAuth.js
//
// A-04 — Bugfix gestion de session (D-07) :
//   Aucun changement de logique interne ici : login/logout fonctionnaient déjà
//   correctement en isolation. Le bug venait de l'absence de connexion entre
//   un 401 API et l'appel de logout() (corrigé dans App.jsx via
//   setUnauthorizedHandler), et du déclenchement prématuré de useData()
//   avant authentification (corrigé dans useData.js).
//   Ce fichier est inclus tel quel dans la livraison de session pour
//   traçabilité — sa signature exportée est strictement inchangée.

import { useState, useCallback } from "react";

const TOKEN_KEY = "agt_token";
const USER_KEY = "agt_user";

function loadFromStorage() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function useAuth() {
  const [auth, setAuth] = useState(loadFromStorage);

  const login = useCallback((token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setAuth({ token, user });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuth({ token: null, user: null });
  }, []);

  const role = auth.user?.role ?? (auth.user?.is_admin ? "admin" : "membre");

  return {
    token: auth.token,
    user: auth.user,
    role,
    isAdmin: role === "admin",
    isChef: role === "chef_projet",
    isMembre: role === "membre",
    isLogged: !!auth.token,
    login,
    logout,
  };
}