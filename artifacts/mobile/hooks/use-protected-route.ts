import { useEffect } from "react";
import { useRootNavigationState, useRouter } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import { useServer } from "@/contexts/server-context";
import { useStoreContext } from "@/contexts/store-context";
import { useMe } from "@/hooks/use-me";
import { usePermissions, type PermSection } from "@/contexts/permissions-context";

/**
 * Mirrors the web ERP's <ProtectedRoute>: redirects unauthenticated/
 * unauthorized users and reports whether the screen should show a loading
 * state while auth/permission data resolves.
 */
export function useProtectedRoute(
  opts: { section?: PermSection; adminOnly?: boolean; storeKind?: "store" | "factory" } = {},
) {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { token, logout } = useAuth();
  const { serverUrl, isServerReady } = useServer();
  const { currentStoreId, stores: contextStores } = useStoreContext();
  const { isAdmin, isStaff, role, isLoading, user } = useMe();
  const { can, isLoaded: permsLoaded } = usePermissions();

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    if (role !== "customer") return;
    const timer = setTimeout(() => logout(), 0);
    return () => clearTimeout(timer);
  }, [rootNavigationState?.key, role, logout]);

  const userStores = (user as { stores?: Array<{ id: number; kind?: "store" | "factory" }> } | null)?.stores ?? [];
  const stores = (userStores.length ? userStores : contextStores) as Array<{ id: number; kind?: "store" | "factory" }>;
  const currentStore = stores.find((store) => store.id === currentStoreId);

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    let redirect: string | null = null;
    // No server configured — send to setup before anything else.
    if (isServerReady && !serverUrl) {
      redirect = "/server-setup";
    } else if (!token) {
      redirect = "/login";
    } else if (isLoading) {
      return;
    } else if (user && !isStaff) {
      redirect = "/login";
    } else if (!currentStoreId && stores.length > 0) {
      redirect = "/select-store";
    } else if (currentStoreId && !currentStore) {
      // Fail closed when a persisted or stale selection is no longer among
      // the stores this account can access.
      redirect = "/select-store";
    } else if (opts.storeKind && !currentStore) {
      redirect = "/select-store";
    } else if (opts.storeKind && currentStore && currentStore.kind !== opts.storeKind) {
      redirect = "/home";
    } else if (opts.adminOnly && !isAdmin) {
      redirect = "/home";
    } else if (opts.section && !isAdmin) {
      if (!permsLoaded) return;
      if (!can(opts.section, "view")) {
        redirect = "/home";
      }
    }
    if (!redirect) return;
    const timer = setTimeout(() => router.replace(redirect as never), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootNavigationState?.key, isServerReady, serverUrl, token, isLoading, user, isStaff, currentStoreId, stores.length, currentStore?.kind, isAdmin, permsLoaded]);

  const ready =
    !!rootNavigationState?.key &&
    !!serverUrl &&
    !!token &&
    !isLoading &&
    (!user || isStaff) &&
    (!!currentStoreId || stores.length === 0) &&
    (!currentStoreId || !!currentStore) &&
    (!opts.storeKind || currentStore?.kind === opts.storeKind) &&
    (!opts.adminOnly || isAdmin) &&
    (!opts.section || isAdmin || (permsLoaded && can(opts.section, "view")));

  return { ready, isAdmin, can };
}
