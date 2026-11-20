import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useMe } from "@/hooks/use-me";
import { useStoreContext } from "@/contexts/store-context";
import { getActiveBaseUrl } from "@/lib/api";
import { getToken } from "@/lib/auth-storage";

export type PermSection =
  | "dashboard"
  | "orders"
  | "products"
  | "inventory"
  | "customers"
  | "purchases"
  | "settings"
  | "caisse"
  | "suppliers"
  | "employees"
  | "payroll"
  | "realtime"
  | "attendance"
  | "leaves"
  | "accounting"
  | "transfers"
  | "alerts"
  | "manufacturing";
export type PermAction = "view" | "create" | "edit" | "delete" | "complete";

export type PermRow = { section: string; action: string; granted: boolean };

interface PermContextType {
  can: (section: PermSection, action: PermAction) => boolean;
  rawPerms: PermRow[];
  isLoaded: boolean;
  refetch: () => void;
}

const PermContext = createContext<PermContextType>({
  can: () => false,
  rawPerms: [],
  isLoaded: false,
  refetch: () => {},
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { isAdmin, isLoading: meLoading } = useMe();
  const { currentStoreId } = useStoreContext();
  const [rawPerms, setRawPerms] = useState<PermRow[]>([]);
  const [permMap, setPermMap] = useState<Map<string, boolean>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const activeScope = useRef({ token, currentStoreId });
  activeScope.current = { token, currentStoreId };
  const scopeKey = token && currentStoreId ? `${token}:${currentStoreId}` : null;

  const fetchPerms = useCallback(async () => {
    if (!token || meLoading) return;
    if (isAdmin) {
      setRawPerms([]);
      setPermMap(new Map());
      setLoadedScope(scopeKey);
      setIsLoaded(true);
      return;
    }
    if (!currentStoreId) return;
    const requestScope = `${token}:${currentStoreId}`;
    try {
      const authToken = getToken();
      const res = await fetch(`${getActiveBaseUrl()}/api/erp/permissions/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (activeScope.current.token !== token || activeScope.current.currentStoreId !== currentStoreId) return;
      if (!res.ok) {
        setRawPerms([]);
        setPermMap(new Map());
        setLoadedScope(requestScope);
        setIsLoaded(true);
        return;
      }
      const rows: PermRow[] = await res.json();
      if (activeScope.current.token !== token || activeScope.current.currentStoreId !== currentStoreId) return;
      const map = new Map<string, boolean>();
      rows.forEach((r) => map.set(`${r.section}:${r.action}`, r.granted));
      setRawPerms(rows);
      setPermMap(map);
      setLoadedScope(requestScope);
      setIsLoaded(true);
    } catch {
      if (activeScope.current.token !== token || activeScope.current.currentStoreId !== currentStoreId) return;
      setRawPerms([]);
      setPermMap(new Map());
      setLoadedScope(requestScope);
      setIsLoaded(true);
    }
  }, [token, isAdmin, meLoading, currentStoreId, scopeKey]);

  useEffect(() => {
    setIsLoaded(false);
    setLoadedScope(null);
    setRawPerms([]);
    setPermMap(new Map());
    fetchPerms();
  }, [fetchPerms]);

  const can = useCallback(
    (section: PermSection, action: PermAction): boolean => {
      if (isAdmin) return true;
      if (!scopeKey || loadedScope !== scopeKey) return false;
      return permMap.get(`${section}:${action}`) ?? false;
    },
    [isAdmin, loadedScope, permMap, scopeKey],
  );

  return (
    <PermContext.Provider value={{ can, rawPerms, isLoaded: isLoaded && loadedScope === scopeKey, refetch: fetchPerms }}>
      {children}
    </PermContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermContext);
}
