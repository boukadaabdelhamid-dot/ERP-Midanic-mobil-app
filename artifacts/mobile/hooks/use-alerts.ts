import { useQuery } from "@tanstack/react-query";
import { erpFetch } from "@/hooks/use-smart-purchase";

export type CrossStoreMissingRow = {
  source_product_id: number;
  name_en: string;
  name_ar: string;
  image_url: string | null;
  reference: string | null;
  barcode: string | null;
  source_stock: number;
  source_store_id: number;
  source_store_name_en: string;
  source_store_name_ar: string;
  local_stock: number;
};

export type SlowMoverRow = {
  id: number;
  name_en: string;
  name_ar: string;
  image_url: string | null;
  reference: string | null;
  barcode: string | null;
  stock: number;
  selling_price: number | null;
  cost_price: number | null;
  category_name_en: string | null;
  category_name_ar: string | null;
  last_sold_at: string | null;
  days_since_last_sale: number | null;
};

export type SlowMoversResponse = {
  items: SlowMoverRow[];
  stats: { count: number; slowValue: number; totalValue: number; pctOfTotal: number };
};

export type ExpiringProductRow = {
  batch_id: number;
  product_id: number;
  quantity: number;
  expiry_date: string;
  lot_number: string | null;
  notes: string | null;
  name_en: string;
  name_ar: string;
  reference: string | null;
  barcode: string | null;
  image_url: string | null;
  days_left: number;
};

export const ALERTS_QUERY_KEYS = {
  crossStoreMissing: ["erp-alerts", "cross-store-missing"] as const,
  slowMovers: (days: number) => ["erp-alerts", "slow-movers", days] as const,
  expiring: (days: number) => ["erp-alerts", "expiring", days] as const,
};

export function useCrossStoreMissing(enabled: boolean) {
  return useQuery({
    queryKey: ALERTS_QUERY_KEYS.crossStoreMissing,
    queryFn: () => erpFetch("/api/erp/alerts/cross-store-missing") as Promise<CrossStoreMissingRow[]>,
    enabled,
  });
}

export function useSlowMovers(days: number, enabled: boolean) {
  return useQuery({
    queryKey: ALERTS_QUERY_KEYS.slowMovers(days),
    queryFn: () => erpFetch(`/api/erp/alerts/slow-movers?days=${days}`) as Promise<SlowMoversResponse>,
    enabled,
  });
}

export function useExpiringProducts(days: number, enabled: boolean) {
  return useQuery({
    queryKey: ALERTS_QUERY_KEYS.expiring(days),
    queryFn: () => erpFetch(`/api/erp/alerts/expiring-products?days=${days}`) as Promise<ExpiringProductRow[]>,
    enabled,
  });
}
