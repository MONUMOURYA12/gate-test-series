import { useEffect, useMemo, useState } from "react";
import {
  authApi,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "../services/api";
import { AuthContext } from "./AuthContextValue";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const expireSession = () => setUser(null);
    window.addEventListener("auth-expired", expireSession);
    return () => window.removeEventListener("auth-expired", expireSession);
  }, []);

  useEffect(() => {
    const restoreUser = async () => {
      const token = getStoredToken();

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await authApi.me();
        setUser(data.user);
      } catch {
        clearStoredToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreUser();
  }, []);

  const login = async ({ email, password }) => {
    const data = await authApi.login({ email, password });
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "admin",
      login,
      logout,
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
