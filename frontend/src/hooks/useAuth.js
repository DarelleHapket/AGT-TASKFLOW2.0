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
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:4001"}/api/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const user = await res.json();
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setAuth({ token, user });
    } catch {
      // réseau indisponible → on garde l'état actuel, pas de crash
    }
  }, []);
  const role = auth.user?.role ?? (auth.user?.is_admin ? "admin" : "membre");
  const permissions = auth.user?.permissions ?? [];
  const hasPermission = useCallback(
    (code) => role === "superadmin" || permissions.includes(code),
    [role, permissions]
  );
  return {
    token: auth.token,
    user: auth.user,
    role,
    permissions,
    hasPermission,
    isSuperadmin: role === "superadmin",
    isAdmin: role === "admin",
    isChef: role === "chef_projet",
    isMembre: role === "membre",
    isLogged: !!auth.token,
    login,
    logout,
    refreshUser,
  };
}
