"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { StudioUser } from "@weavl/shared";
import { jsonBody, studioApi } from "@/lib/studioApi";

type AuthContextValue = {
  user: StudioUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const isPublic = (pathname: string) => pathname === "/" || pathname === "/home" || pathname === "/login";

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StudioUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    studioApi<StudioUser | null>("/auth/me")
      .then((value) => {
        if (active) setUser(value);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && !user && !isPublic(pathname)) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, pathname, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const next = await studioApi<StudioUser>("/auth/login", {
          method: "POST",
          body: jsonBody({ email, password }),
        });
        setUser(next);
      },
      logout: async () => {
        await studioApi("/auth/logout", { method: "POST" });
        setUser(null);
        router.push("/login");
      },
    }),
    [user, loading, router],
  );

  return (
    <AuthContext.Provider value={value}>
      {loading && !isPublic(pathname) ? (
        <div style={{ padding: 32, color: "var(--muted-foreground)" }}>正在打开工作台…</div>
      ) : !user && !isPublic(pathname) ? null : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is missing");
  return context;
}
