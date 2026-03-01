import { createContext, useContext, useState, ReactNode } from "react";
import type { AuthUser } from "../lib/api";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  orgName: string | null;
  setAuth: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp > Date.now() / 1000) {
      return { email: payload.sub, tenantId: payload.tenantId, orgName: payload.orgName };
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const t = localStorage.getItem("sensill_token");
    if (!t) return null;
    // Clear expired tokens on load
    if (!decodeToken(t)) {
      localStorage.removeItem("sensill_token");
      return null;
    }
    return t;
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = localStorage.getItem("sensill_token");
    return t ? decodeToken(t) : null;
  });

  const setAuth = (newToken: string) => {
    const decoded = decodeToken(newToken);
    if (!decoded) throw new Error("Invalid token");
    localStorage.setItem("sensill_token", newToken);
    setToken(newToken);
    setUser(decoded);
  };

  const logout = () => {
    localStorage.removeItem("sensill_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, orgName: user?.orgName ?? null, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
