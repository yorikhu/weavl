"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AccountSummary } from "@weavl/shared";
import { usePathname } from "next/navigation";
import { studioApi } from "@/lib/studioApi";
import { useAuth } from "./AuthProvider";

interface AccountContextValue {
  account: AccountSummary | null;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const refresh = useCallback(async () => {
    if (!user) {
      setAccount(null);
      return;
    }
    try {
      setAccount(await studioApi<AccountSummary>("/studio/account"));
    } catch {
      setAccount(null);
    }
  }, [user]);
  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);
  const value = useMemo(() => ({ account, refresh }), [account, refresh]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("AccountProvider is missing");
  return context;
}
