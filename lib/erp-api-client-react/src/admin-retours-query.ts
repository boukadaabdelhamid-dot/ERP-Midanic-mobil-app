import type { GetAdminRetoursParams } from "./generated/api.schemas";

export function getAdminRetoursUrl(params?: GetAdminRetoursParams): string {
  const query = new URLSearchParams();
  if (params?.clientUserId != null) query.set("clientUserId", String(params.clientUserId));
  if (params?.limit != null) query.set("limit", String(params.limit));
  const queryString = query.toString();
  return queryString ? `/api/admin/retours?${queryString}` : "/api/admin/retours";
}

export function getAdminRetoursQueryKey(params?: GetAdminRetoursParams) {
  return params
    ? (["/api/admin/retours", params] as const)
    : (["/api/admin/retours"] as const);
}
