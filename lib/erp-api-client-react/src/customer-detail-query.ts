import type { GetErpCustomerParams } from "./generated/api.schemas";

export function getCustomerDetailUrl(
  id: number,
  params?: GetErpCustomerParams,
): string {
  const query = new URLSearchParams();
  if (params?.ordersLimit != null) query.set("ordersLimit", String(params.ordersLimit));
  if (params?.includeNotes != null) query.set("includeNotes", String(params.includeNotes));
  const queryString = query.toString();
  return queryString
    ? `/api/erp/customers/${id}?${queryString}`
    : `/api/erp/customers/${id}`;
}

export function getCustomerDetailQueryKey(
  id: number,
  params?: GetErpCustomerParams,
) {
  return params
    ? ([`/api/erp/customers/${id}`, params] as const)
    : ([`/api/erp/customers/${id}`] as const);
}
