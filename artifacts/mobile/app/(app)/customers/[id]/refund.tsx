import React, { useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCustomerOperationsQueryKey,
  getGetErpCaissesQueryKey,
  getGetErpCustomerQueryKey,
  getGetErpCustomersQueryKey,
  useCreateCustomerOperation,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { ErrorState } from "@/components/ui";
import ContactMoneyOperationForm, { type ContactMoneyOperationInput } from "@/components/ContactMoneyOperationForm";

export default function CustomerRefund() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = Number(id);
  const { ready, isAdmin, can } = useProtectedRoute({ section: "customers" });
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();
  const mutation = useCreateCustomerOperation();
  const submitLocked = useRef(false);

  if (!ready) return null;
  if (!Number.isInteger(customerId) || customerId < 1) {
    return <ErrorState title={t("Client introuvable", "الزبون غير موجود")} />;
  }
  if (!(isAdmin || can("customers", "edit"))) {
    return <ErrorState title={t("Action non autorisée", "غير مسموح بهذا الإجراء")} />;
  }

  function handleSubmit(input: ContactMoneyOperationInput) {
    if (submitLocked.current || mutation.isPending) return;
    submitLocked.current = true;
    mutation.mutate(
      {
        id: customerId,
        data: {
          type: "remboursement",
          amount: input.amount,
          date: input.date,
          reference: input.reference,
          note: input.note,
        },
      },
      {
        onSuccess: () => {
          feedback.success("Remboursement enregistré", "تم تسجيل استرداد المبلغ للزبون");
          void queryClient.invalidateQueries({ queryKey: getGetCustomerOperationsQueryKey(customerId) });
          void queryClient.invalidateQueries({ queryKey: getGetErpCustomerQueryKey(customerId) });
          void queryClient.invalidateQueries({ queryKey: getGetErpCustomersQueryKey() });
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
      title={t("Rembourser le client", "استرداد مبلغ للزبون")}
      submitLabel={t("Enregistrer le remboursement", "تسجيل الاسترداد")}
      caisseHint={t("Le montant sera débité de votre caisse personnelle.", "سيُخصم المبلغ من صندوقك الشخصي.")}
      submitTestId="button-submit-customer-refund"
      loading={mutation.isPending}
      onSubmit={handleSubmit}
    />
  );
}
