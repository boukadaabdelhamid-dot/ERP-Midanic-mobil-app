import { useStoreContext, type MobileStore } from "@/contexts/store-context";
import { useMe } from "@/hooks/use-me";

/** Prefer the refreshed ERP store profiles over the initial login payload. */
export function useCurrentStore() {
  const { currentStoreId, stores } = useStoreContext();
  const { user } = useMe();
  const id = currentStoreId ?? user?.currentStoreId;
  // /stores/mine is the authority for which branches are still accessible.
  // Fall back to context only before that refreshed list is available.
  const userStores = user?.stores as MobileStore[] | undefined;
  const currentStore = (userStores?.length ? userStores : stores).find((store) => store.id === id);
  return { currentStore, isFactory: currentStore?.kind === "factory" };
}
