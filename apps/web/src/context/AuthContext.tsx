import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/client";

export interface User {
  id: string;
  email: string;
  role: "OWNER" | "OPERATOR";
}

export interface GhostSettings {
  id: string;
  mode: "OBSERVE" | "ASSIST" | "AUTOPILOT" | "LOCKDOWN";
  killSwitchEnabled: boolean;
  killSwitchReason?: string | null;
  version: number;
}

interface AuthContextType {
  user: User | null;
  settings: GhostSettings | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateMode: (mode: GhostSettings["mode"]) => Promise<void>;
  freezeGhost: (reason: string) => Promise<void>;
  unfreezeGhost: (reason: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<GhostSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSettings = async () => {
    try {
      const res = await api.get<{ settings: GhostSettings }>("/settings/ghost");
      setSettings(res.settings);
    } catch {
      // non-fatal
    }
  };

  const checkUser = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ user: User }>("/auth/me");
      setUser(res.user);
      await refreshSettings();
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
    const handleExpired = () => setUser(null);
    window.addEventListener("auth-expired", handleExpired);
    return () => window.removeEventListener("auth-expired", handleExpired);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/login", {
      email,
      password: pass,
    });
    api.setToken(res.token);
    setUser(res.user);
    await refreshSettings();
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      api.clearToken();
      setUser(null);
    }
  };

  const updateMode = async (mode: GhostSettings["mode"]) => {
    const res = await api.patch<{ settings: GhostSettings }>("/settings/ghost/mode", { mode });
    setSettings(res.settings);
  };

  const freezeGhost = async (reason: string) => {
    const res = await api.post<{ settings: GhostSettings }>("/settings/ghost/freeze", { reason });
    setSettings(res.settings);
  };

  const unfreezeGhost = async (reason: string) => {
    const res = await api.post<{ settings: GhostSettings }>("/settings/ghost/unfreeze", { reason });
    setSettings(res.settings);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        isLoading,
        login,
        logout,
        updateMode,
        freezeGhost,
        unfreezeGhost,
        refreshSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
