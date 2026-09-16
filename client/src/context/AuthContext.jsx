import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authApi, clearLegacyToken } from "../services/api";
import { AuthContext } from "./AuthContextValue";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const sessionRevision = useRef(0);

  useEffect(() => {
    const expireSession = () => {
      sessionRevision.current += 1;
      setUser(null);
    };
    window.addEventListener("auth-expired", expireSession);
    return () => window.removeEventListener("auth-expired", expireSession);
  }, []);

  useEffect(() => {
    clearLegacyToken();
    const controller = new AbortController();
    const restoreRevision = sessionRevision.current;
    const restoreUser = async () => {
      try {
        const data = await authApi.me(controller.signal);
        if (!controller.signal.aborted && restoreRevision === sessionRevision.current) setUser(data.user);
      } catch {
        if (!controller.signal.aborted && restoreRevision === sessionRevision.current) setUser(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    restoreUser();
    return () => controller.abort();
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const data = await authApi.login({ email, password });
    sessionRevision.current += 1;
    clearLegacyToken();
    setLogoutError("");
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      await authApi.logout();
      sessionRevision.current += 1;
      clearLegacyToken();
      setUser(null);
      return true;
    } catch {
      setLogoutError("Could not log out. Check your connection and try again.");
      return false;
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  const updateUser = useCallback(async payload => {
    const data = await authApi.updateMe(payload);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "admin",
      isLoggingOut,
      logoutError,
      login,
      logout,
      updateUser,
    }),
    [user, isLoading, isLoggingOut, logoutError, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
