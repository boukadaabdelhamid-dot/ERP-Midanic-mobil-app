import React, { useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetErpCaissesQueryKey,
  getGetSuppliersQueryKey,
  getGetSupplierOperationsQueryKey,
  useCreateSupplierOperation,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { ErrorState } from "@/components/ui";
import ContactMoneyOperationForm, { type ContactMoneyOperationInput } from "@/components/ContactMoneyOperationForm";

export default function SupplierPayment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const supplierId = Number(id);
  const { ready, isAdmin, can } = useProtectedRoute({ section: "suppliers" });
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();
  const mutation = useCreateSupplierOperation();
  const submitLocked = useRef(false);

  if (!ready) return null;
  if (!Number.isInteger(supplierId) || supplierId < 1) {
    return <ErrorState title={t("Fournisseur introuvable", "المورد غير موجود")} />;
  }
  if (!(isAdmin || can("suppliers", "create"))) {
    return <ErrorState title={t("Action non autorisée", "غير مسموح بهذا الإجراء")} />;
  }

  function handleSubmit(input: ContactMoneyOperationInput) {
    if (submitLocked.current || mutation.isPending) return;
    submitLocked.current = true;
    mutation.mutate(
      {
        id: supplierId,
        data: {
          amount: input.amount,
          date: input.date,
          type: "payment",
          reference: input.reference,
          note: input.note,
        },
      },
      {
        onSuccess: () => {
          feedback.success("Paiement enregistré", "تم تسجيل دفعة المورد");
          void queryClient.invalidateQueries({ queryKey: getGetSupplierOperationsQueryKey(supplierId) });
          void queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetErpCaissesQueryKey() });
          router.back();
        },
        onError: (error) => {
          submitLocked.current = false;
          feedback.error(error);
        },
      },
    );
  }

  return (
    <ContactMoneyOperationForm
      title={t("Nouveau paiement fournisseur", "دفعة جديدة للمورد")}
      submitLabel={t("Enregistrer le paiement", "تسجيل الدفعة")}
      caisseHint={t("Le montant sera débité de votre caisse personnelle.", "سيُخصم المبلغ من صندوقك الشخصي.")}
      submitTestId="button-submit-supplier-payment"
      loading={mutation.isPending}
      onSubmit={handleSubmit}
    />
  );
}
