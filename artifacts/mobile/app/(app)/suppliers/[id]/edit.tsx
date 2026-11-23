import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateSupplier,
  getGetSuppliersQueryKey,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { Screen } from "@/components/Screen";
import { LoadingView, ErrorState, Button } from "@/components/ui";
import { SupplierForm, emptySupplierForm, supplierToForm, type SupplierFormValues } from "@/components/SupplierForm";
import {
  PURCHASE_FILTER_OPTIONS_QUERY_KEY,
  PURCHASES_NEEDED_QUERY_KEY,
  useSupplierById,
} from "@/hooks/use-smart-purchase";

export default function EditSupplier() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, isAdmin, can } = useProtectedRoute({ section: "suppliers" });
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();
  const supplierId = Number(id);

  const { data: supplier, isLoading, isError, refetch, isRefetching } = useSupplierById(supplierId, ready);

  const [values, setValues] = useState<SupplierFormValues>(emptySupplierForm());
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (supplier && !hydrated) {
      setValues(supplierToForm(supplier));
      setHydrated(true);
    }
  }, [supplier, hydrated]);

  const updateSupplier = useUpdateSupplier();

  if (!ready) return null;
  const canEdit = isAdmin || can("suppliers", "edit");
  if (!canEdit) {
    return <ErrorState title={t("Action non autorisée", "غير مسموح بهذا الإجراء")} />;
  }
  if (!Number.isInteger(supplierId) || supplierId < 1) {
    return <ErrorState title={t("Fournisseur introuvable", "المورد غير موجود")} />;
  }
  if (isError && !supplier) {
    return (
      <Screen>
        <ErrorState
          title={t("Impossible de charger le fournisseur", "تعذر تحميل المورد")}
          subtitle={t("Vérifiez la connexion puis réessayez.", "تحقق من الاتصال ثم أعد المحاولة.")}
        />
        <Button
          label={t("Réessayer", "إعادة المحاولة")}
          onPress={() => { void refetch(); }}
          loading={isRefetching}
          testID="button-retry-edit-supplier"
        />
      </Screen>
    );
  }
  if (isLoading || !hydrated) return <LoadingView />;
  if (!supplier) return <ErrorState title={t("Fournisseur introuvable", "المورد غير موجود")} />;

  function handleSubmit() {
    updateSupplier.mutate(
      {
        id: supplierId,
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
        onSuccess: () => {
          feedback.success("Fournisseur mis à jour", "تم تحديث المورد");
          queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
          queryClient.invalidateQueries({ queryKey: PURCHASE_FILTER_OPTIONS_QUERY_KEY });
          queryClient.invalidateQueries({ queryKey: PURCHASES_NEEDED_QUERY_KEY });
          router.replace(`/suppliers/${supplierId}` as never);
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
        submitting={updateSupplier.isPending}
        submitLabel={t("Enregistrer", "حفظ")}
      />
    </Screen>
  );
}
