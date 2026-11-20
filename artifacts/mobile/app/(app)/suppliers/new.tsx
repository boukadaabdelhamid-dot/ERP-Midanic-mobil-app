import React, { useState } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateSupplier, getGetSuppliersQueryKey } from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { Screen } from "@/components/Screen";
import { ErrorState } from "@/components/ui";
import { SupplierForm, emptySupplierForm, type SupplierFormValues } from "@/components/SupplierForm";
import { PURCHASE_FILTER_OPTIONS_QUERY_KEY, PURCHASES_NEEDED_QUERY_KEY } from "@/hooks/use-smart-purchase";

export default function NewSupplier() {
  const { ready, isAdmin, can } = useProtectedRoute({ section: "suppliers" });
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();

  const [values, setValues] = useState<SupplierFormValues>(emptySupplierForm());
  const createSupplier = useCreateSupplier();

  if (!ready) return null;
  const canCreate = isAdmin || can("suppliers", "create");
  if (!canCreate) {
    return <ErrorState title={t("Action non autorisée", "غير مسموح بهذا الإجراء")} />;
  }

  function handleSubmit() {
    createSupplier.mutate(
      {
        data: {
          name: values.name.trim(),
          contactName: values.contactName.trim() || undefined,
          email: values.email.trim() || undefined,
          phone: values.phone.trim() || undefined,
          address: values.address.trim() || undefined,
          wilaya: values.wilaya.trim(),
          commune: values.commune.trim(),
          latitude: values.latitude,
          longitude: values.longitude,
          ...{
            locationAccuracyMeters: values.locationAccuracyMeters,
            locationCapturedAt: values.locationCapturedAt,
          },
          notes: values.notes.trim() || undefined,
          contactType: values.contactType,
        },
      },
      {
        onSuccess: (supplier) => {
          feedback.success("Fournisseur créé", "تم إنشاء المورد");
          queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
          queryClient.invalidateQueries({ queryKey: PURCHASE_FILTER_OPTIONS_QUERY_KEY });
          queryClient.invalidateQueries({ queryKey: PURCHASES_NEEDED_QUERY_KEY });
          router.replace(`/suppliers/${supplier.id}` as never);
        },
        onError: (e) => feedback.error(e),
      },
    );
  }

  return (
    <Screen>
      <SupplierForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        submitting={createSupplier.isPending}
        submitLabel={t("Créer le fournisseur", "إنشاء المورد")}
      />
    </Screen>
  );
}
