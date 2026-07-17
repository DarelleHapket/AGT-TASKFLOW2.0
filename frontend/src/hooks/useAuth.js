// frontend/src/hooks/useAuth.js
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
