import React from "react";
import { Badge } from "@/components/ui";
import { useLang } from "@/contexts/lang-context";

const STATUS_LABELS: Record<string, { fr: string; ar: string; tone: "success" | "warning" | "danger" | "muted" | "info" }> = {
  requested: { fr: "En attente", ar: "قيد الانتظار", tone: "warning" },
  approved: { fr: "Approuvé", ar: "تمت الموافقة", tone: "info" },
  prepared: { fr: "Préparé", ar: "تم التجهيز", tone: "info" },
  in_transit: { fr: "En transit", ar: "قيد النقل", tone: "info" },
  received: { fr: "Reçu", ar: "تم الاستلام", tone: "success" },
  rejected: { fr: "Refusé", ar: "مرفوض", tone: "danger" },
  cancelled: { fr: "Annulé", ar: "ملغى", tone: "danger" },
};

export function TransferStatusBadge({ status }: { status: string }) {
  const { t } = useLang();
  const meta = STATUS_LABELS[status];
  return <Badge label={meta ? t(meta.fr, meta.ar) : status} tone={meta?.tone ?? "muted"} />;
}
