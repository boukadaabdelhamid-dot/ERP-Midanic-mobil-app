import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProduct,
  useUpdateProduct,
  getGetProductQueryKey,
  getGetProductsQueryKey,
  type UpdateProductRequest,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { Screen } from "@/components/Screen";
import { LoadingView, ErrorState } from "@/components/ui";
import { ProductForm, emptyProductForm, productToForm, type ProductFormValues } from "@/components/ProductForm";

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { ready, isAdmin, can } = useProtectedRoute({ section: "products" });
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();
  const rawId = Array.isArray(id) ? id[0] : id;
  const productId = Number(rawId);

  const { data: product, isLoading, isError } = useGetProduct(productId, {
    query: { enabled: ready && !!productId, queryKey: getGetProductQueryKey(productId) },
  });

  const [values, setValues] = useState<ProductFormValues>(emptyProductForm());
  const [hydratedProductId, setHydratedProductId] = useState<number | null>(null);
  useEffect(() => {
    if (product && hydratedProductId !== productId) {
      setValues(productToForm(product));
      setHydratedProductId(productId);
    }
  }, [product, productId, hydratedProductId]);

  const updateProduct = useUpdateProduct();

  if (!ready) return null;
  const canEdit = isAdmin || can("products", "edit");
  if (!canEdit) {
    return <ErrorState title={t("Action non autorisée", "غير مسموح بهذا الإجراء")} />;
  }
  if (isLoading || hydratedProductId !== productId) return <LoadingView />;
  if (isError || !product) return <ErrorState title={t("Produit introuvable", "المنتج غير موجود")} />;

  function handleSubmit() {
    const payload = {
      nameEn: values.nameEn.trim(),
      nameAr: values.nameAr.trim(),
      price: values.price.trim(),
      categoryId: values.categoryId,
      reference: values.reference.trim() || null,
      barcode: values.barcode.trim() || null,
      costPrice: values.costPrice.trim() || null,
      priceGros: values.priceGros.trim() || null,
      brand: values.brand.trim() || null,
      model: values.model.trim() || null,
      color: values.color.trim() || null,
      minStock: values.minStock.trim() ? Number(values.minStock) : null,
      isActive: values.isActive,
      isExposed: values.isExposed,
    } as unknown as UpdateProductRequest;

    updateProduct.mutate(
      { id: productId, data: payload },
      {
        onSuccess: () => {
          feedback.success("Produit mis à jour", "تم تحديث المنتج");
          queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
          queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
          router.replace({ pathname: "/products/[id]", params: { id: String(productId) } } as never);
        },
        onError: (e) => feedback.error(e),
      },
    );
  }

  return (
    <Screen>
      <ProductForm
        mode="edit"
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        submitting={updateProduct.isPending}
        submitLabel={t("Enregistrer", "حفظ")}
      />
    </Screen>
  );
}
