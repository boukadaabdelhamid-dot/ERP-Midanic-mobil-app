import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelManufacturingOrder,
  completeManufacturingOrder,
  createManufacturingOrder,
  createManufacturingRecipe,
  getManufacturingCatalogue,
  getManufacturingOrders,
  getManufacturingRecipes,
  getManufacturingReplenishment,
  manufacturingQueryKeys,
  updateManufacturingRecipe,
  type ManufacturingOrder,
  type ManufacturingProduct,
  type ManufacturingRecipe,
  type ManufacturingReplenishmentItem,
  type ManufacturingRecipeInput,
  type ManufacturingRecipeUpdate,
  getGetProductsQueryKey,
  getGetInventoryStockQueryKey,
  getGetInventoryMovementsQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { localeForLanguage, useLang, type ErpLang } from "@/contexts/lang-context";
import { useStoreContext } from "@/contexts/store-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { useConfirm } from "@/contexts/confirm-context";
import { Screen } from "@/components/Screen";
import { Button, Card, EmptyState, ErrorState, LoadingView, SectionTitle } from "@/components/ui";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { colors } from "@/lib/colors";

type Tab = "recipes" | "replenishment" | "planned" | "history";
type RecipeForm = {
  id?: number;
  outputProductId: number | null;
  yieldQuantity: string;
  instructions: string;
  materials: Record<number, string>;
};
type ChargeDraft = { description: string; amount: string };

const FACTORY_GREEN = "#29483f";
const FACTORY_BRONZE = "#d5b47e";

function numberText(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("fr-FR", { maximumFractionDigits: 3 }) : "—";
}

export default function ManufacturingScreen() {
  const { ready, can } = useProtectedRoute({ section: "manufacturing", storeKind: "factory" });
  const { t, lang } = useLang();
  const { currentStoreId } = useStoreContext();
  const router = useRouter();
  const feedback = useApiFeedback();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("recipes");
  const [recipeForm, setRecipeForm] = useState<RecipeForm | null>(null);
  const [recipeProductPicker, setRecipeProductPicker] = useState(false);
  const [recipeError, setRecipeError] = useState("");
  const [orderForm, setOrderForm] = useState<{ recipeId: number | null; quantity: string; notes: string } | null>(null);
  const [orderRecipePicker, setOrderRecipePicker] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [completionOrder, setCompletionOrder] = useState<ManufacturingOrder | null>(null);
  const [charges, setCharges] = useState<ChargeDraft[]>([{ description: "", amount: "" }]);
  const [completionError, setCompletionError] = useState("");
  const [expandedOrderIds, setExpandedOrderIds] = useState<number[]>([]);

  const catalogueQ = useQuery({
    queryKey: [...manufacturingQueryKeys.catalogue, currentStoreId],
    queryFn: getManufacturingCatalogue,
    enabled: ready,
  });
  const recipesQ = useQuery({
    queryKey: [...manufacturingQueryKeys.recipes, currentStoreId],
    queryFn: getManufacturingRecipes,
    enabled: ready,
  });
  const ordersQ = useQuery({
    queryKey: [...manufacturingQueryKeys.orders, currentStoreId],
    queryFn: getManufacturingOrders,
    enabled: ready,
  });
  const replenishmentQ = useQuery({
    queryKey: [...manufacturingQueryKeys.replenishment, currentStoreId],
    queryFn: getManufacturingReplenishment,
    enabled: ready,
    refetchInterval: 60_000,
  });

  const products = catalogueQ.data ?? [];
  const recipes = recipesQ.data ?? [];
  const orders = ordersQ.data ?? [];
  const activeRecipes = recipes.filter((recipe) => recipe.isActive);
  const rawMaterials = products.filter((product) => product.manufacturingRole === "raw_material");
  const finishedProducts = products.filter((product) => product.manufacturingRole === "finished_good");
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const canCreate = can("manufacturing", "create");
  const canEdit = can("manufacturing", "edit");
  const canComplete = can("manufacturing", "complete");
  const isLoading = catalogueQ.isLoading || recipesQ.isLoading || ordersQ.isLoading || replenishmentQ.isLoading;
  const hasError = catalogueQ.isError || recipesQ.isError || ordersQ.isError || replenishmentQ.isError;

  function invalidateManufacturing() {
    void queryClient.invalidateQueries({ queryKey: manufacturingQueryKeys.catalogue });
    void queryClient.invalidateQueries({ queryKey: manufacturingQueryKeys.recipes });
    void queryClient.invalidateQueries({ queryKey: manufacturingQueryKeys.orders });
    void queryClient.invalidateQueries({ queryKey: manufacturingQueryKeys.replenishment });
  }

  const saveRecipeMutation = useMutation({
    mutationFn: (input: { id?: number; data: ManufacturingRecipeInput | ManufacturingRecipeUpdate }) =>
      input.id
        ? updateManufacturingRecipe(input.id, input.data as ManufacturingRecipeUpdate)
        : createManufacturingRecipe(input.data as ManufacturingRecipeInput),
    onSuccess: () => {
      invalidateManufacturing();
      setRecipeForm(null);
      setRecipeError("");
      feedback.success("Recette enregistrée", "تم حفظ الوصفة");
    },
    onError: (error) => feedback.error(error),
  });
  const toggleRecipeMutation = useMutation({
    mutationFn: (recipe: ManufacturingRecipe) => updateManufacturingRecipe(recipe.id, { isActive: !recipe.isActive }),
    onSuccess: () => {
      invalidateManufacturing();
      feedback.success("Recette mise à jour", "تم تحديث الوصفة");
    },
    onError: (error) => feedback.error(error),
  });
  const createOrderMutation = useMutation({
    mutationFn: createManufacturingOrder,
    onSuccess: () => {
      invalidateManufacturing();
      setOrderForm(null);
      setOrderError("");
      setTab("planned");
      feedback.success("Ordre de production créé", "تم إنشاء أمر الإنتاج");
    },
    onError: (error) => feedback.error(error),
  });
  const completeMutation = useMutation({
    mutationFn: ({ id, items }: { id: number; items: Array<{ description: string; amount: number }> }) =>
      completeManufacturingOrder(id, items),
    onSuccess: () => {
      invalidateManufacturing();
      void queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
      void queryClient.invalidateQueries({ predicate: (query) =>
        typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/products/") });
      void queryClient.invalidateQueries({ queryKey: getGetInventoryStockQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetInventoryMovementsQueryKey() });
      // Production charges affect the acting user's caisse as well as stock.
      void queryClient.invalidateQueries({ predicate: (query) =>
        typeof query.queryKey[0] === "string" && query.queryKey[0].includes("/caisse") });
      setCompletionOrder(null);
      setCharges([{ description: "", amount: "" }]);
      setCompletionError("");
      feedback.success("Production terminée", "تم إتمام الإنتاج");
    },
    onError: (error) => feedback.error(error),
  });
  const cancelMutation = useMutation({
    mutationFn: cancelManufacturingOrder,
    onSuccess: () => {
      invalidateManufacturing();
      feedback.success("Ordre annulé", "تم إلغاء الأمر");
    },
    onError: (error) => feedback.error(error),
  });

  function openRecipe(recipe?: ManufacturingRecipe, outputProductId?: number) {
    setRecipeError("");
    setRecipeProductPicker(false);
    setRecipeForm(recipe
      ? {
          id: recipe.id,
          outputProductId: recipe.outputProductId,
          yieldQuantity: String(recipe.yieldQuantity),
          instructions: recipe.instructions ?? "",
          materials: Object.fromEntries(recipe.components.map((component) => [component.productId, String(component.quantity)])),
        }
      : { outputProductId: outputProductId ?? null, yieldQuantity: "1", instructions: "", materials: {} });
  }

  function saveRecipe() {
    if (!recipeForm) return;
    const yieldQuantity = Number(recipeForm.yieldQuantity.replace(",", "."));
    const items = Object.entries(recipeForm.materials)
      .map(([productId, quantity]) => ({ productId: Number(productId), quantity: Number(quantity.replace(",", ".")) }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);
    if (!recipeForm.outputProductId || !Number.isFinite(yieldQuantity) || yieldQuantity <= 0 || items.length === 0) {
      setRecipeError(t("Choisissez le produit fini, un rendement positif et au moins une matière.", "اختر المنتج النهائي وكمية إنتاج موجبة ومادة أولية واحدة على الأقل."));
      return;
    }
    saveRecipeMutation.mutate({
      id: recipeForm.id,
      data: recipeForm.id
        ? {
            yieldQuantity,
            instructions: recipeForm.instructions.trim() || null,
            items,
          }
        : {
            outputProductId: recipeForm.outputProductId,
            yieldQuantity,
            instructions: recipeForm.instructions.trim() || null,
            items,
          },
    });
  }

  function openOrder(recipeId?: number) {
    setOrderError("");
    setOrderRecipePicker(false);
    setOrderForm({ recipeId: recipeId ?? activeRecipes[0]?.id ?? null, quantity: "1", notes: "" });
  }

  function saveOrder() {
    if (!orderForm) return;
    const quantity = Number(orderForm.quantity.replace(",", "."));
    if (!orderForm.recipeId || !Number.isFinite(quantity) || quantity <= 0) {
      setOrderError(t("Choisissez une recette et une quantité positive.", "اختر وصفة وكمية موجبة."));
      return;
    }
    createOrderMutation.mutate({
      recipeId: orderForm.recipeId,
      quantity,
      notes: orderForm.notes.trim() || null,
    });
  }

  async function cancelOrder(order: ManufacturingOrder) {
    const accepted = await confirm({
      title: t("Annuler l'ordre de production ?", "إلغاء أمر الإنتاج؟"),
      message: t("L'ordre planifié sera annulé.", "سيتم إلغاء أمر الإنتاج المخطط."),
      destructive: true,
    });
    if (accepted) cancelMutation.mutate(order.id);
  }

  function completeOrder() {
    if (!completionOrder) return;
    const filled = charges.filter((charge) => charge.description.trim() || charge.amount.trim());
    const incomplete = filled.some((charge) =>
      !charge.description.trim() || !Number.isFinite(Number(charge.amount.replace(",", "."))) || Number(charge.amount.replace(",", ".")) <= 0,
    );
    if (incomplete) {
      setCompletionError(t("Chaque charge doit avoir une désignation et un montant positif.", "يجب إدخال وصف ومبلغ موجب لكل تكلفة."));
      return;
    }
    setCompletionError("");
    completeMutation.mutate({
      id: completionOrder.id,
      items: filled.map((charge) => ({ description: charge.description.trim(), amount: Number(charge.amount.replace(",", ".")) })),
    });
  }

  function productName(product: ManufacturingProduct | undefined) {
    if (!product) return "—";
    return lang === "ar" ? product.nameAr || product.nameEn : product.nameEn || product.nameAr;
  }

  function refresh() {
    void catalogueQ.refetch();
    void recipesQ.refetch();
    void ordersQ.refetch();
    void replenishmentQ.refetch();
  }

  if (!ready) return null;

  const visibleOrders = orders.filter((order) => tab === "planned" ? order.status === "planned" : order.status !== "planned");
  const tabs: { key: Tab; fr: string; ar: string; icon: IconName }[] = [
    { key: "recipes", fr: "Recettes", ar: "الوصفات", icon: "book-open" },
    { key: "replenishment", fr: "Besoins", ar: "الاحتياج", icon: "trending-up" },
    { key: "planned", fr: "À produire", ar: "مخطط", icon: "clock" },
    { key: "history", fr: "Historique", ar: "السجل", icon: "archive" },
  ];
  const activeQuery = tab === "recipes" ? recipesQ : tab === "replenishment" ? replenishmentQ : ordersQ;

  return (
    <Screen onRefresh={refresh} refreshing={catalogueQ.isRefetching || recipesQ.isRefetching || ordersQ.isRefetching || replenishmentQ.isRefetching}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Feather name="tool" size={20} color={FACTORY_BRONZE} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{t("UNITÉ DE PRODUCTION", "وحدة إنتاج")}</Text>
          <Text style={styles.title}>{t("Production", "الإنتاج")}</Text>
        </View>
        {tab === "recipes" && canCreate ? (
          <Pressable onPress={() => openRecipe()} style={styles.headerAction} testID="button-new-recipe">
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.headerActionText}>{t("Recette", "وصفة")}</Text>
          </Pressable>
        ) : tab === "planned" && canCreate ? (
          <Pressable onPress={() => openOrder()} style={styles.headerAction} testID="button-new-production-order">
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.headerActionText}>{t("Ordre", "أمر")}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.tabActive]} testID={`manufacturing-tab-${item.key}`}>
            <Feather name={item.icon} size={15} color={tab === item.key ? FACTORY_GREEN : colors.textMuted} />
            <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelActive]}>{t(item.fr, item.ar)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.actionsRow}>
        <Button label={t("Matières premières", "المواد الأولية")} variant="secondary" onPress={() => router.push("/products" as never)} testID="production-open-products" />
      </View>

      {hasError ? (
        <View>
          <ErrorState title={t("Impossible de charger la production", "تعذر تحميل بيانات الإنتاج")} />
          <Button label={t("Réessayer", "إعادة المحاولة")} onPress={refresh} variant="secondary" />
        </View>
      ) : isLoading ? (
        <LoadingView />
      ) : tab === "recipes" ? (
        <>
          <SectionTitle>{t("Recettes de fabrication", "وصفات التصنيع")}</SectionTitle>
          {recipes.length === 0 ? <EmptyState title={t("Aucune recette enregistrée", "لا توجد وصفات مسجلة")} /> : null}
          {recipes.map((recipe) => (
            <Card key={recipe.id} style={styles.recipeCard}>
              <View style={styles.cardHeading}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{recipe.outputNameAr && lang === "ar" ? recipe.outputNameAr : recipe.outputNameEn || recipe.outputNameAr}</Text>
                  <Text style={styles.meta}>{t("Rendement", "المردود")}: {numberText(recipe.yieldQuantity)}</Text>
                </View>
                <View style={[styles.statusPill, recipe.isActive ? styles.statusActive : styles.statusOff]}>
                  <Text style={[styles.statusText, recipe.isActive ? styles.statusActiveText : styles.statusOffText]}>
                    {recipe.isActive ? t("Active", "مفعلة") : t("Inactive", "متوقفة")}
                  </Text>
                </View>
              </View>
              <View style={styles.materialList}>
                {recipe.components.map((component) => (
                  <View key={component.productId} style={styles.materialRow}>
                    <Text style={styles.materialName}>{lang === "ar" ? component.nameAr || component.nameEn : component.nameEn || component.nameAr}</Text>
                    <Text style={styles.materialQty}>× {numberText(component.quantity)}</Text>
                  </View>
                ))}
              </View>
              {recipe.instructions ? <Text style={styles.instructions}>{recipe.instructions}</Text> : null}
              {(canEdit || canCreate) ? (
                <View style={styles.actionsRow}>
                  {canEdit ? (
                    <Pressable onPress={() => toggleRecipeMutation.mutate(recipe)} style={styles.textAction} disabled={toggleRecipeMutation.isPending}>
                      <Feather name={recipe.isActive ? "pause-circle" : "play-circle"} size={16} color={FACTORY_GREEN} />
                      <Text style={styles.actionLabel}>{recipe.isActive ? t("Désactiver", "إيقاف") : t("Réactiver", "تفعيل")}</Text>
                    </Pressable>
                  ) : null}
                  {canEdit ? (
                    <Pressable onPress={() => openRecipe(recipe)} style={styles.textAction} testID={`button-edit-recipe-${recipe.id}`}>
                      <Feather name="edit-2" size={14} color={FACTORY_GREEN} />
                      <Text style={styles.actionLabel}>{t("Modifier", "تعديل")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </Card>
          ))}
        </>
      ) : tab === "replenishment" ? (
        <>
          <SectionTitle>{t("Matières premières", "المواد الأولية")}</SectionTitle>
          {(replenishmentQ.data?.rawMaterials ?? []).length === 0 ? <EmptyState title={t("Aucun besoin de matière première", "لا توجد حاجة لمواد أولية")} /> : null}
          {(replenishmentQ.data?.rawMaterials ?? []).map((item) => (
            <ReplenishmentCard
              key={`raw-${item.productId}`}
              item={item}
              lang={lang}
              t={t}
              productName={item.nameAr && lang === "ar" ? item.nameAr : item.nameEn || item.nameAr}
              onAction={() => router.push("/smart-purchase" as never)}
              actionLabel={t("Ouvrir les achats", "فتح المشتريات")}
              actionIcon="shopping-cart"
              disabled={!can("purchases", "view")}
            />
          ))}
          <SectionTitle>{t("Produits finis", "المنتجات النهائية")}</SectionTitle>
          {(replenishmentQ.data?.finishedGoods ?? []).length === 0 ? <EmptyState title={t("Aucun produit fini à réapprovisionner", "لا توجد منتجات نهائية تحتاج إلى إنتاج")} /> : null}
          {(replenishmentQ.data?.finishedGoods ?? []).map((item) => {
            const recipe = recipes.find((candidate) => candidate.outputProductId === item.productId);
            const label = recipe?.isActive
              ? t("Planifier la production", "تخطيط الإنتاج")
              : recipe
                ? t("Réactiver la recette", "تفعيل الوصفة")
                : t("Créer une recette", "إنشاء وصفة");
            return (
              <ReplenishmentCard
                key={`finished-${item.productId}`}
                item={item}
                lang={lang}
                t={t}
                productName={item.nameAr && lang === "ar" ? item.nameAr : item.nameEn || item.nameAr}
                actionLabel={label}
                actionIcon="tool"
                onAction={() => {
                  if (!recipe && !canCreate) return;
                  if (!recipe) openRecipe(undefined, item.productId);
                  else if (!recipe.isActive && canEdit) toggleRecipeMutation.mutate(recipe);
                  else {
                    openOrder(recipe.id);
                    setOrderForm({ recipeId: recipe.id, quantity: String(item.suggestedQuantity), notes: "" });
                  }
                }}
                disabled={recipe ? (recipe.isActive ? !canCreate : !canEdit) : !canCreate}
              />
            );
          })}
        </>
      ) : (
        <>
          <SectionTitle>{tab === "planned" ? t("Ordres planifiés", "أوامر مخططة") : t("Production terminée ou annulée", "إنتاج مكتمل أو ملغى")}</SectionTitle>
          {visibleOrders.length === 0 ? <EmptyState title={tab === "planned" ? t("Aucun ordre en attente", "لا توجد أوامر معلقة") : t("Aucun historique de production", "لا يوجد سجل إنتاج")} /> : null}
          {visibleOrders.map((order) => {
            const expanded = expandedOrderIds.includes(order.id);
            const output = productMap.get(order.outputProductId);
            const statusText = order.status === "planned" ? t("Planifié", "مخطط") : order.status === "completed" ? t("Terminé", "مكتمل") : t("Annulé", "ملغى");
            return (
              <Card key={order.id} style={styles.orderCard}>
                <Pressable onPress={() => setExpandedOrderIds((ids) => expanded ? ids.filter((id) => id !== order.id) : [...ids, order.id])} style={styles.cardHeading}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{productName(output)} · #{order.id}</Text>
                    <Text style={styles.meta}>{numberText(order.quantity)} {t("lot(s)", "دفعة")} · {new Date(order.createdAt).toLocaleDateString(localeForLanguage(lang))}</Text>
                  </View>
                  <View style={[styles.statusPill, order.status === "planned" ? styles.statusPlanned : order.status === "completed" ? styles.statusActive : styles.statusOff]}>
                    <Text style={[styles.statusText, order.status === "planned" ? styles.statusPlannedText : order.status === "completed" ? styles.statusActiveText : styles.statusOffText]}>{statusText}</Text>
                  </View>
                  <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                </Pressable>
                {order.notes ? <Text style={styles.instructions}>{order.notes}</Text> : null}
                {expanded ? (
                  <View style={styles.materialList}>
                    {order.materials.map((material) => (
                      <View key={material.productId} style={styles.materialRow}>
                        <Text style={styles.materialName}>{lang === "ar" ? material.nameAr || material.nameEn : material.nameEn || material.nameAr}</Text>
                        <Text style={styles.materialQty}>{numberText(material.consumedQuantity ?? material.requiredQuantity)}</Text>
                      </View>
                    ))}
                    {order.productionCosts.map((cost) => (
                      <View key={cost.id} style={styles.materialRow}>
                        <Text style={styles.materialName}>{cost.description}</Text>
                        <Text style={styles.materialQty}>{numberText(cost.amount)} {lang === "ar" ? "دج" : "DA"}</Text>
                      </View>
                    ))}
                    <Text style={styles.totalCost}>{t("Coût matière", "تكلفة المواد")}: {numberText(order.totalMaterialCost)} {lang === "ar" ? "دج" : "DA"}</Text>
                  </View>
                ) : null}
                {order.status === "planned" ? (
                  <View style={styles.actionsRow}>
                    {canComplete ? (
                      <Pressable
                        onPress={() => { setCompletionOrder(order); setCharges([{ description: "", amount: "" }]); setCompletionError(""); }}
                        style={styles.primarySmallAction}
                        testID={`button-complete-order-${order.id}`}
                      >
                        <Feather name="check-circle" size={15} color="#fff" />
                        <Text style={styles.primarySmallActionText}>{t("Terminer", "إتمام")}</Text>
                      </Pressable>
                    ) : null}
                    {canEdit ? (
                      <Pressable onPress={() => void cancelOrder(order)} style={styles.textAction} disabled={cancelMutation.isPending}>
                        <Feather name="x-circle" size={15} color={colors.danger} />
                        <Text style={[styles.actionLabel, { color: colors.danger }]}>{t("Annuler", "إلغاء")}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </>
      )}

      <RecipeModal
        visible={recipeForm != null}
        form={recipeForm}
        products={products}
        rawMaterials={rawMaterials}
        finishedProducts={finishedProducts}
        pickerOpen={recipeProductPicker}
        busy={saveRecipeMutation.isPending}
        error={recipeError}
        t={t}
        lang={lang}
        onClose={() => setRecipeForm(null)}
        onSave={saveRecipe}
        onTogglePicker={() => setRecipeProductPicker((open) => !open)}
        onChooseOutput={(id) => {
          setRecipeForm((form) => form ? { ...form, outputProductId: id } : form);
          setRecipeProductPicker(false);
        }}
        onChange={(next) => setRecipeForm(next)}
      />
      <OrderModal
        visible={orderForm != null}
        form={orderForm}
        recipes={activeRecipes}
        pickerOpen={orderRecipePicker}
        busy={createOrderMutation.isPending}
        error={orderError}
        t={t}
        lang={lang}
        onClose={() => setOrderForm(null)}
        onSave={saveOrder}
        onTogglePicker={() => setOrderRecipePicker((open) => !open)}
        onChange={(next) => setOrderForm(next)}
      />
      <CompletionModal
        visible={completionOrder != null}
        order={completionOrder}
        charges={charges}
        busy={completeMutation.isPending}
        error={completionError}
        t={t}
        onClose={() => setCompletionOrder(null)}
        onSave={completeOrder}
        onChange={setCharges}
      />
    </Screen>
  );
}

function ReplenishmentCard({
  item, lang, t, productName, actionLabel, actionIcon, onAction, disabled,
}: {
  item: ManufacturingReplenishmentItem;
  lang: ErpLang;
  t: (fr: string, ar: string) => string;
  productName: string;
  actionLabel: string;
  actionIcon: IconName;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <Card style={styles.replenishmentCard}>
      <View style={styles.cardHeading}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{productName}</Text>
          <Text style={styles.meta}>{t("Stock", "المخزون")}: {numberText(item.stock)}{item.minStock != null ? ` · ${t("Minimum", "الحد الأدنى")}: ${numberText(item.minStock)}` : ""}</Text>
        </View>
        <View style={styles.suggestedPill}>
          <Text style={styles.suggestedNumber}>{numberText(item.suggestedQuantity)}</Text>
          <Text style={styles.suggestedLabel}>{t("à prévoir", "مقترح")}</Text>
        </View>
      </View>
      <Pressable onPress={onAction} disabled={disabled} style={[styles.secondaryAction, disabled && styles.actionDisabled]}>
        <Feather name={actionIcon} size={15} color={FACTORY_GREEN} />
        <Text style={styles.actionLabel}>{actionLabel}</Text>
        <Feather name={lang === "ar" ? "arrow-left" : "arrow-right"} size={14} color={FACTORY_GREEN} />
      </Pressable>
    </Card>
  );
}

function ModalShell({ visible, title, children, onClose }: { visible: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Feather name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function RecipeModal({
  visible, form, products, rawMaterials, finishedProducts, pickerOpen, busy, error, t, lang,
  onClose, onSave, onTogglePicker, onChooseOutput, onChange,
}: {
  visible: boolean;
  form: RecipeForm | null;
  products: ManufacturingProduct[];
  rawMaterials: ManufacturingProduct[];
  finishedProducts: ManufacturingProduct[];
  pickerOpen: boolean;
  busy: boolean;
  error: string;
  t: (fr: string, ar: string) => string;
  lang: ErpLang;
  onClose: () => void;
  onSave: () => void;
  onTogglePicker: () => void;
  onChooseOutput: (id: number) => void;
  onChange: (form: RecipeForm) => void;
}) {
  if (!form) return null;
  const output = products.find((product) => product.id === form.outputProductId);
  return (
    <ModalShell visible={visible} title={form.id ? t("Modifier la recette", "تعديل الوصفة") : t("Nouvelle recette", "وصفة جديدة")} onClose={onClose}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" bottomOffset={70}>
        <Text style={styles.fieldLabel}>{t("Produit fini", "المنتج النهائي")}</Text>
        {form.id ? (
          <View style={styles.selectedProduct}><Text style={styles.inputText}>{lang === "ar" ? output?.nameAr || output?.nameEn : output?.nameEn || output?.nameAr}</Text></View>
        ) : (
          <>
            <Pressable onPress={onTogglePicker} style={styles.selectButton}>
              <Text style={styles.inputText}>{output ? (lang === "ar" ? output.nameAr || output.nameEn : output.nameEn || output.nameAr) : t("Choisir un produit fini", "اختر منتجاً نهائياً")}</Text>
              <Feather name={pickerOpen ? "chevron-up" : "chevron-down"} size={17} color={colors.textMuted} />
            </Pressable>
            {pickerOpen ? finishedProducts.map((product) => (
              <Pressable key={product.id} onPress={() => onChooseOutput(product.id)} style={styles.optionRow}>
                <Text style={styles.inputText}>{lang === "ar" ? product.nameAr || product.nameEn : product.nameEn || product.nameAr}</Text>
                <Text style={styles.optionMeta}>{t("Stock", "المخزون")}: {numberText(product.stock)}</Text>
              </Pressable>
            )) : null}
          </>
        )}
        <Text style={styles.fieldLabel}>{t("Quantité produite par lot", "كمية المنتج لكل دفعة")}</Text>
        <TextInput
          value={form.yieldQuantity}
          onChangeText={(value) => onChange({ ...form, yieldQuantity: value })}
          keyboardType="decimal-pad"
          style={styles.input}
          testID="input-recipe-yield"
        />
        <Text style={styles.fieldLabel}>{t("Matières premières", "المواد الأولية")}</Text>
        {rawMaterials.length === 0 ? <Text style={styles.meta}>{t("Aucune matière première dans le catalogue.", "لا توجد مواد أولية في القائمة.")}</Text> : null}
        {rawMaterials.map((product) => {
          const value = form.materials[product.id];
          return (
            <View key={product.id} style={styles.ingredientRow}>
              <Pressable
                onPress={() => {
                  const materials = { ...form.materials };
                  if (value != null) delete materials[product.id];
                  else materials[product.id] = "1";
                  onChange({ ...form, materials });
                }}
                style={[styles.checkbox, value != null && styles.checkboxActive]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: value != null }}
              >
                {value != null ? <Feather name="check" size={14} color="#fff" /> : null}
              </Pressable>
              <Text style={styles.ingredientName}>{lang === "ar" ? product.nameAr || product.nameEn : product.nameEn || product.nameAr}</Text>
              {value != null ? (
                <TextInput
                  value={value}
                  onChangeText={(quantity) => onChange({ ...form, materials: { ...form.materials, [product.id]: quantity } })}
                  keyboardType="decimal-pad"
                  style={styles.ingredientInput}
                  accessibilityLabel={t("Quantité nécessaire", "الكمية المطلوبة")}
                />
              ) : null}
            </View>
          );
        })}
        <Text style={styles.fieldLabel}>{t("Instructions", "التعليمات")}</Text>
        <TextInput
          value={form.instructions}
          onChangeText={(value) => onChange({ ...form, instructions: value })}
          multiline
          style={[styles.input, styles.multilineInput]}
          testID="input-recipe-instructions"
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button label={t("Enregistrer la recette", "حفظ الوصفة")} onPress={onSave} loading={busy} testID="button-save-recipe" />
      </KeyboardAwareScrollViewCompat>
    </ModalShell>
  );
}

function OrderModal({
  visible, form, recipes, pickerOpen, busy, error, t, lang, onClose, onSave, onTogglePicker, onChange,
}: {
  visible: boolean;
  form: { recipeId: number | null; quantity: string; notes: string } | null;
  recipes: ManufacturingRecipe[];
  pickerOpen: boolean;
  busy: boolean;
  error: string;
  t: (fr: string, ar: string) => string;
  lang: ErpLang;
  onClose: () => void;
  onSave: () => void;
  onTogglePicker: () => void;
  onChange: (form: { recipeId: number | null; quantity: string; notes: string }) => void;
}) {
  if (!form) return null;
  const selectedRecipe = recipes.find((recipe) => recipe.id === form.recipeId);
  return (
    <ModalShell visible={visible} title={t("Nouvel ordre de production", "أمر إنتاج جديد")} onClose={onClose}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" bottomOffset={70}>
        <Text style={styles.fieldLabel}>{t("Recette", "الوصفة")}</Text>
        <Pressable onPress={onTogglePicker} style={styles.selectButton}>
          <Text style={styles.inputText}>
            {selectedRecipe ? (lang === "ar" ? selectedRecipe.outputNameAr || selectedRecipe.outputNameEn : selectedRecipe.outputNameEn || selectedRecipe.outputNameAr) : t("Choisir une recette active", "اختر وصفة مفعلة")}
          </Text>
          <Feather name={pickerOpen ? "chevron-up" : "chevron-down"} size={17} color={colors.textMuted} />
        </Pressable>
        {pickerOpen ? recipes.map((recipe) => (
          <Pressable key={recipe.id} onPress={() => { onChange({ ...form, recipeId: recipe.id }); onTogglePicker(); }} style={styles.optionRow}>
            <Text style={styles.inputText}>{lang === "ar" ? recipe.outputNameAr || recipe.outputNameEn : recipe.outputNameEn || recipe.outputNameAr}</Text>
            <Text style={styles.optionMeta}>{t("Rendement", "المردود")}: {numberText(recipe.yieldQuantity)}</Text>
          </Pressable>
        )) : null}
        <Text style={styles.fieldLabel}>{t("Nombre de lots", "عدد الدفعات")}</Text>
        <TextInput value={form.quantity} onChangeText={(quantity) => onChange({ ...form, quantity })} keyboardType="decimal-pad" style={styles.input} testID="input-production-quantity" />
        <Text style={styles.fieldLabel}>{t("Notes", "ملاحظات")}</Text>
        <TextInput value={form.notes} onChangeText={(notes) => onChange({ ...form, notes })} multiline style={[styles.input, styles.multilineInput]} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button label={t("Planifier", "تخطيط")} onPress={onSave} loading={busy} disabled={recipes.length === 0} testID="button-save-production-order" />
      </KeyboardAwareScrollViewCompat>
    </ModalShell>
  );
}

function CompletionModal({
  visible, order, charges, busy, error, t, onClose, onSave, onChange,
}: {
  visible: boolean;
  order: ManufacturingOrder | null;
  charges: ChargeDraft[];
  busy: boolean;
  error: string;
  t: (fr: string, ar: string) => string;
  onClose: () => void;
  onSave: () => void;
  onChange: (charges: ChargeDraft[]) => void;
}) {
  return (
    <ModalShell visible={visible} title={t("Terminer la production", "إتمام الإنتاج")} onClose={onClose}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" bottomOffset={70}>
        <Text style={styles.meta}>{t("Ordre", "الأمر")} #{order?.id} · {t("Quantité", "الكمية")}: {numberText(order?.quantity)}</Text>
        <SectionTitle>{t("Coûts supplémentaires", "تكاليف إضافية")}</SectionTitle>
        {charges.map((charge, index) => (
          <View key={index} style={styles.chargeRow}>
            <TextInput
              value={charge.description}
              onChangeText={(description) => onChange(charges.map((item, i) => i === index ? { ...item, description } : item))}
              placeholder={t("Description", "الوصف")}
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              value={charge.amount}
              onChangeText={(amount) => onChange(charges.map((item, i) => i === index ? { ...item, amount } : item))}
              placeholder={t("Montant", "المبلغ")}
              keyboardType="decimal-pad"
              style={styles.chargeAmount}
            />
            {charges.length > 1 ? (
              <Pressable onPress={() => onChange(charges.filter((_, i) => i !== index))} hitSlop={8}>
                <Feather name="trash-2" size={16} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Pressable onPress={() => onChange([...charges, { description: "", amount: "" }])} style={styles.textAction}>
          <Feather name="plus-circle" size={16} color={FACTORY_GREEN} />
          <Text style={styles.actionLabel}>{t("Ajouter une charge", "إضافة تكلفة")}</Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button label={t("Confirmer la production", "تأكيد الإنتاج")} onPress={onSave} loading={busy} testID="button-confirm-manufacturing-completion" />
      </KeyboardAwareScrollViewCompat>
    </ModalShell>
  );
}

type IconName = keyof typeof Feather.glyphMap;
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 15, borderRadius: 14, backgroundColor: FACTORY_GREEN, padding: 14 },
  headerIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.13)", borderWidth: 1, borderColor: "rgba(213,180,126,0.48)" },
  eyebrow: { color: FACTORY_BRONZE, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  title: { color: "#fff", fontSize: 21, fontWeight: "800", marginTop: 2 },
  headerAction: { minHeight: 40, paddingHorizontal: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#47695c" },
  headerActionText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  tabs: { flexDirection: "row", gap: 6, marginBottom: 14 },
  tab: { flex: 1, minHeight: 47, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 3 },
  tabActive: { borderColor: FACTORY_BRONZE, backgroundColor: "#f3f0e9" },
  tabLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "700", textAlign: "center" },
  tabLabelActive: { color: FACTORY_GREEN },
  recipeCard: { borderTopWidth: 2, borderTopColor: FACTORY_BRONZE, gap: 10 },
  orderCard: { borderTopWidth: 2, borderTopColor: FACTORY_GREEN, gap: 10 },
  replenishmentCard: { borderLeftWidth: 3, borderLeftColor: FACTORY_BRONZE, gap: 10 },
  cardHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 18 },
  statusActive: { backgroundColor: "#e2f0e7" },
  statusOff: { backgroundColor: "#eef0f2" },
  statusPlanned: { backgroundColor: "#f5ecd9" },
  statusText: { fontSize: 9, fontWeight: "800" },
  statusActiveText: { color: "#316246" },
  statusOffText: { color: colors.textMuted },
  statusPlannedText: { color: "#876521" },
  materialList: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 6 },
  materialRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  materialName: { flex: 1, color: colors.text, fontSize: 12 },
  materialQty: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  instructions: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" },
  textAction: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6 },
  actionLabel: { color: FACTORY_GREEN, fontSize: 11, fontWeight: "700" },
  primarySmallAction: { minHeight: 36, borderRadius: 8, paddingHorizontal: 11, backgroundColor: FACTORY_GREEN, flexDirection: "row", alignItems: "center", gap: 6 },
  primarySmallActionText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  suggestedPill: { minWidth: 64, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: "#f4eedf", alignItems: "center" },
  suggestedNumber: { color: FACTORY_GREEN, fontSize: 14, fontWeight: "800" },
  suggestedLabel: { color: colors.textMuted, fontSize: 8, fontWeight: "600" },
  secondaryAction: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 9, borderWidth: 1, borderColor: "#d5dfd9", backgroundColor: "#f6f8f6", paddingHorizontal: 10 },
  actionDisabled: { opacity: 0.45 },
  totalCost: { color: FACTORY_GREEN, fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 4 },
  modalBackdrop: { flex: 1, justifyContent: "center", backgroundColor: "rgba(10,20,35,0.5)", paddingHorizontal: 14, paddingVertical: 30 },
  modalCard: { maxHeight: "100%", borderRadius: 18, backgroundColor: colors.surface, padding: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 },
  formContent: { gap: 10, paddingTop: 12, paddingBottom: 22 },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "700", marginTop: 3 },
  input: { minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 11, color: colors.text, backgroundColor: colors.surface, fontSize: 13 },
  inputText: { flex: 1, color: colors.text, fontSize: 13 },
  selectedProduct: { minHeight: 43, justifyContent: "center", paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.background },
  selectButton: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.surface },
  optionRow: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.background },
  optionMeta: { color: colors.textMuted, fontSize: 10 },
  ingredientRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4 },
  ingredientName: { flex: 1, color: colors.text, fontSize: 11 },
  ingredientInput: { width: 66, height: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 8, textAlign: "center", color: colors.text },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkboxActive: { borderColor: FACTORY_GREEN, backgroundColor: FACTORY_GREEN },
  multilineInput: { minHeight: 76, textAlignVertical: "top", paddingTop: 10 },
  errorText: { color: colors.danger, fontSize: 11 },
  chargeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chargeAmount: { width: 86, minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 8, color: colors.text, textAlign: "center" },
});
