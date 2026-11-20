import {
  useGetMe,
  getGetMeQueryKey,
  useGetErpStoresMine,
  getGetErpStoresMineQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useMemo } from "react";

export type Role = "admin" | "employee" | "customer";

export function useMe() {
  const { token } = useAuth();
  const { data, isLoading, refetch } = useGetMe({
    query: { enabled: !!token, staleTime: 60_000, retry: false, queryKey: getGetMeQueryKey() },
  });
  const canLoadStores = !!token && (data?.role === "admin" || data?.role === "employee");
  const { data: accessibleStores, isLoading: isLoadingStores } = useGetErpStoresMine({
    query: {
      enabled: canLoadStores,
      staleTime: 60_000,
      retry: false,
      queryKey: getGetErpStoresMineQueryKey(),
    },
  });
  const user = useMemo(
    () => data ? { ...data, stores: accessibleStores ?? data.stores } : null,
    [data, accessibleStores],
  );
  const role = (data?.role ?? null) as Role | null;
  return {
    user,
    role,
    isAdmin: role === "admin",
    isEmployee: role === "employee",
    isStaff: role === "admin" || role === "employee",
    isLoading: !!token && (isLoading || (canLoadStores && isLoadingStores)),
    refetch,
  };
}
