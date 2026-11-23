/**
 * Shared order status-transition rules, mirroring the web ERP's lifecycle
 * (`pending → processing → shipped → delivered`, with `cancelled` reachable
 * from any non-terminal state). `delivered` and `cancelled` are terminal —
 * the API rejects any further status change on those orders.
 */
export type OrderStatusValue = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export type StatusAction = {
  status: OrderStatusValue;
  label: string;
  labelAr: string;
  labelEn: string;
  destructive?: boolean;
};

const TRANSITIONS: Record<string, StatusAction[]> = {
  pending: [
    { status: "processing", label: "Marquer en traitement", labelAr: "وضع علامة قيد المعالجة", labelEn: "Mark as processing" },
    { status: "cancelled", label: "Annuler la commande", labelAr: "إلغاء الطلب", labelEn: "Cancel order", destructive: true },
  ],
  processing: [
    { status: "shipped", label: "Marquer comme expédiée", labelAr: "وضع علامة تم الشحن", labelEn: "Mark as shipped" },
    { status: "cancelled", label: "Annuler la commande", labelAr: "إلغاء الطلب", labelEn: "Cancel order", destructive: true },
  ],
  shipped: [
    { status: "delivered", label: "Marquer comme livrée", labelAr: "وضع علامة تم التسليم", labelEn: "Mark as delivered" },
    { status: "cancelled", label: "Annuler la commande", labelAr: "إلغاء الطلب", labelEn: "Cancel order", destructive: true },
  ],
  delivered: [],
  cancelled: [],
};

export function getStatusActions(status: string): StatusAction[] {
  return TRANSITIONS[status] ?? [];
}

export const STATUS_LABELS: Record<string, { fr: string; ar: string }> = {
  pending: { fr: "En attente", ar: "قيد الانتظار" },
  processing: { fr: "En traitement", ar: "قيد المعالجة" },
  shipped: { fr: "Expédiée", ar: "تم الشحن" },
  delivered: { fr: "Livrée", ar: "تم التسليم" },
  cancelled: { fr: "Annulée", ar: "ملغاة" },
};
