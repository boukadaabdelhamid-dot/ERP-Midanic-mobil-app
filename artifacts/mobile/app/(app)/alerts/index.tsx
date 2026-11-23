import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCreateErpTransfer, getGetErpTransfersQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { localeForLanguage, useLang, type ErpLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { erpFetch } from "@/hooks/use-smart-purchase";
import {
  ALERTS_QUERY_KEYS,
  useCrossStoreMissing,
  useExpiringProducts,
  useSlowMovers,
  type CrossStoreMissingRow,
  type ExpiringProductRow,
  type SlowMoverRow,
} from "@/hooks/use-alerts";
import { Screen } from "@/components/Screen";
import { Button, Card, EmptyState, ErrorState, LoadingView, SectionTitle } from "@/components/ui";
import { colors } from "@/lib/colors";

type AlertTab = "missing" | "slow" | "expiry";
type IconName = keyof typeof Feather.glyphMap;
const SNOOZE_KEY = "midanic.erp.mobile-alert-snoozes";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const tabs: { key: AlertTab; icon: IconName; fr: string; ar: string }[] = [
  { key: "missing", icon: "repeat", fr: "Manquants ailleurs", ar: "نواقص المتاجر" },
  { key: "slow", icon: "clock", fr: "Rotation lente", ar: "ضعيفة الحركة" },
  { key: "expiry", icon: "alert-triangle", fr: "Expiration", ar: "قرب الانتهاء" },
];

function money(value: number | null | undefined, currency: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${currency}` : "—";
}

export default function AlertsScreen() {
  const { ready, can } = useProtectedRoute({ section: "alerts", storeKind: "store" });
  const { t, lang } = useLang();
  const feedback = useApiFeedback();
  const qc = useQueryClient();
  const [tab, setTab] = useState<AlertTab>("missing");
  const [slowDays, setSlowDays] = useState(30);
  const [expiryDays, setExpiryDays] = useState(30);
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});
  const [storageError, setStorageError] = useState(false);
  const [includeSnoozed, setIncludeSnoozed] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [selectionError, setSelectionError] = useState("");
  const [priceRow, setPriceRow] = useState<SlowMoverRow | null>(null);
  const [priceText, setPriceText] = useState("");
  const [priceError, setPriceError] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);

  const missingQ = useCrossStoreMissing(ready);
  const slowQ = useSlowMovers(slowDays, ready);
  const expiryQ = useExpiringProducts(expiryDays, ready);
  const createTransfer = useCreateErpTransfer();

  useEffect(() => {
    AsyncStorage.getItem(SNOOZE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Record<string, number>;
        const now = Date.now();
        setSnoozes(Object.fromEntries(Object.entries(parsed).filter(([, time]) =>
          Number.isFinite(time) && now - time < THIRTY_DAYS,
        )));
      })
      .catch(() => setStorageError(true));
  }, []);

  const slowRows = useMemo(() => {
    const rows = slowQ.data?.items ?? [];
    if (includeSnoozed) return rows;
    return rows.filter((row) => {
      const time = snoozes[String(row.id)];
      return !time || Date.now() - time >= THIRTY_DAYS;
    });
  }, [slowQ.data?.items, snoozes, includeSnoozed]);
  const currency = lang === "ar" ? "دج" : "DA";
  const canRequestTransfer = can("transfers", "create");
  const selectedRows = (missingQ.data ?? []).filter((row) => selected.includes(row.source_product_id));
  const selectedSourceStoreId = selectedRows[0]?.source_store_id;
  const transferInvalid = selectedRows.length === 0 || selectedRows.some((row) => {
    const qty = Number((quantities[row.source_product_id] ?? "1").replace(",", "."));
    return !Number.isFinite(qty) || qty <= 0 || qty > Number(row.source_stock);
  });

  function toggleProduct(row: CrossStoreMissingRow) {
    setSelectionError("");
    if (selected.includes(row.source_product_id)) {
      const next = selected.filter((id) => id !== row.source_product_id);
      setSelected(next);
      if (next.length === 0) setQuantities({});
      return;
    }
    const first = selected.length
      ? (missingQ.data ?? []).find((item) => item.source_product_id === selected[0])
      : null;
    if (first && first.source_store_id !== row.source_store_id) {
      setSelectionError(t("Choisissez des produits d'un seul magasin source.", "اختر منتجات من متجر مصدر واحد."));
      return;
    }
    setQuantities((values) => ({ ...values, [row.source_product_id]: values[row.source_product_id] ?? "1" }));
    setSelected([...selected, row.source_product_id]);
  }

  function requestTransfer() {
    if (transferInvalid || !selectedSourceStoreId) return;
    createTransfer.mutate(
      {
        data: {
          sourceStoreId: selectedSourceStoreId,
          mode: "request",
          notes: t("Demande créée depuis les alertes", "طلب من شاشة التنبيهات"),
          items: selectedRows.map((row) => ({
            sourceProductId: row.source_product_id,
            quantity: Number((quantities[row.source_product_id] ?? "1").replace(",", ".")),
          })),
        },
      },
      {
        onSuccess: () => {
          feedback.success("Demande de transfert créée", "تم إنشاء طلب التحويل");
          setSelected([]);
          setQuantities({});
          qc.invalidateQueries({ queryKey: getGetErpTransfersQueryKey() });
          qc.invalidateQueries({ queryKey: ALERTS_QUERY_KEYS.crossStoreMissing });
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  async function toggleSnooze(row: SlowMoverRow) {
    const next = { ...snoozes };
    const key = String(row.id);
    if (next[key] && Date.now() - next[key] < THIRTY_DAYS) delete next[key];
    else next[key] = Date.now();
    setSnoozes(next);
    try {
      await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  function openPriceEditor(row: SlowMoverRow) {
    setPriceRow(row);
    setPriceText(String(row.selling_price ?? ""));
    setPriceError("");
  }

  async function savePrice() {
    if (!priceRow) return;
    const value = Number(priceText.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setPriceError(t("Saisissez un prix supérieur à zéro.", "أدخل سعراً أكبر من الصفر."));
      return;
    }
    setPriceSaving(true);
    setPriceError("");
    try {
      await erpFetch(`/api/products/${priceRow.id}`, {
        method: "PUT",
        body: JSON.stringify({ price: value }),
      });
      await qc.invalidateQueries({ queryKey: ["erp-alerts", "slow-movers"] });
      await qc.invalidateQueries({ queryKey: ["getProducts"] });
      setPriceRow(null);
      feedback.success("Prix modifié", "تم تعديل السعر");
    } catch (error) {
      setPriceError(error instanceof Error ? error.message : t("Modification impossible.", "تعذر التعديل."));
    } finally {
      setPriceSaving(false);
    }
  }

  function refresh() {
    void missingQ.refetch();
    void slowQ.refetch();
    void expiryQ.refetch();
  }

  if (!ready) return null;

  const activeQuery = tab === "missing" ? missingQ : tab === "slow" ? slowQ : expiryQ;
  const isError = activeQuery.isError;

  return (
    <Screen onRefresh={refresh} refreshing={missingQ.isRefetching || slowQ.isRefetching || expiryQ.isRefetching}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Feather name="bell" size={18} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("Alertes du magasin", "تنبيهات المتجر")}</Text>
          <Text style={styles.subtitle}>{t("Stocks, rotation et dates limites", "المخزون والحركة وتواريخ الصلاحية")}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setTab(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.key }}
            style={[styles.tab, tab === item.key && styles.tabActive]}
            testID={`alerts-tab-${item.key}`}
          >
            <Feather name={item.icon} size={16} color={tab === item.key ? colors.primary : colors.textMuted} />
            <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelActive]}>{t(item.fr, item.ar)}</Text>
          </Pressable>
        ))}
      </View>

      {isError ? (
        <View>
          <ErrorState title={t("Impossible de charger les alertes", "تعذر تحميل التنبيهات")} />
          <Button label={t("Réessayer", "إعادة المحاولة")} onPress={refresh} variant="secondary" />
        </View>
      ) : activeQuery.isLoading ? (
        <LoadingView />
      ) : tab === "missing" ? (
        <>
          <View style={styles.sectionHeading}>
            <SectionTitle>{t("Disponibles dans d'autres magasins", "متوفرة في متاجر أخرى")}</SectionTitle>
            <Text style={styles.count}>{missingQ.data?.length ?? 0}</Text>
          </View>
          {(missingQ.data ?? []).length === 0 ? (
            <EmptyState title={t("Aucun manque détecté", "لا توجد نواقص حالياً")} />
          ) : (missingQ.data ?? []).map((row) => {
            const checked = selected.includes(row.source_product_id);
            const productName = lang === "ar" ? row.name_ar || row.name_en : row.name_en || row.name_ar;
            const sourceName = lang === "ar" ? row.source_store_name_ar : row.source_store_name_en;
            return (
              <Card key={`${row.source_store_id}-${row.source_product_id}`} style={styles.alertCard}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{productName}</Text>
                    <Text style={styles.meta}>{t("Magasin source", "متجر المصدر")}: {sourceName}</Text>
                    {row.reference ? <Text style={styles.meta}>{row.reference}</Text> : null}
                  </View>
                  {canRequestTransfer ? (
                    <Pressable
                      onPress={() => toggleProduct(row)}
                      style={[styles.checkbox, checked && styles.checkboxSelected]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      testID={`alert-missing-select-${row.source_product_id}`}
                    >
                      {checked ? <Feather name="check" size={15} color="#fff" /> : null}
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.statsRow}>
                  <Text style={styles.stock}>{t("Disponible", "المتوفر")}: {row.source_stock}</Text>
                  <Text style={styles.localStock}>{t("Votre stock", "مخزونك")}: {row.local_stock}</Text>
                </View>
                {checked ? (
                  <View style={styles.qtyRow}>
                    <Text style={styles.meta}>{t("الكمية المطلوبة", "Quantité demandée")}</Text>
                    <TextInput
                      value={quantities[row.source_product_id] ?? "1"}
                      onChangeText={(value) => setQuantities((current) => ({ ...current, [row.source_product_id]: value }))}
                      keyboardType="decimal-pad"
                      style={styles.quantityInput}
                      accessibilityLabel={t("الكمية المطلوبة", "Quantité demandée")}
                      testID={`alert-transfer-quantity-${row.source_product_id}`}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })}
          {selectionError ? <Text style={styles.errorText}>{selectionError}</Text> : null}
          {canRequestTransfer && selected.length ? (
            <Card style={styles.actionCard}>
              <Text style={styles.meta}>
                {selected.length} {t("produit(s) sélectionné(s)", "منتج محدد")}
              </Text>
              <Button
                label={t("Demander un transfert", "طلب تحويل")}
                onPress={requestTransfer}
                loading={createTransfer.isPending}
                disabled={transferInvalid}
                testID="button-alerts-request-transfer"
              />
            </Card>
          ) : null}
        </>
      ) : tab === "slow" ? (
        <>
          <View style={styles.filters}>
            {[30, 60, 90, 180].map((days) => (
              <Pressable key={days} onPress={() => setSlowDays(days)} style={[styles.filterChip, slowDays === days && styles.filterChipActive]}>
                <Text style={[styles.filterText, slowDays === days && styles.filterTextActive]}>{days} {t("jours", "يوماً")}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setIncludeSnoozed((value) => !value)} style={styles.showSnoozed}>
              <Text style={styles.linkText}>{includeSnoozed ? t("Masquer ignorés", "إخفاء المؤجلة") : t("Voir ignorés", "عرض المؤجلة")}</Text>
            </Pressable>
          </View>
          {slowQ.data ? (
            <Card style={styles.summaryCard}>
              <Text style={styles.meta}>{t("Produits concernés", "المنتجات المعنية")}: {slowRows.length}</Text>
              <Text style={styles.stock}>{t("Valeur immobilisée", "قيمة المخزون الراكد")}: {money(slowQ.data.stats.slowValue, currency)}</Text>
            </Card>
          ) : null}
          {slowRows.length === 0 ? <EmptyState title={t("Aucun produit concerné", "لا توجد منتجات راكدة")} /> : null}
          {slowRows.map((row) => (
            <SlowMoverCard
              key={row.id}
              row={row}
              lang={lang}
              t={t}
              currency={currency}
              canEditPrice={can("products", "edit")}
              onEditPrice={() => openPriceEditor(row)}
              onSnooze={() => void toggleSnooze(row)}
              snoozed={!!snoozes[String(row.id)] && Date.now() - snoozes[String(row.id)] < THIRTY_DAYS}
            />
          ))}
          {storageError ? <Text style={styles.errorText}>{t("Impossible d'enregistrer la liste des alertes ignorées.", "تعذر حفظ قائمة التنبيهات المؤجلة.")}</Text> : null}
        </>
      ) : (
        <>
          <View style={styles.filters}>
            {[7, 30, 90, 180, 365].map((days) => (
              <Pressable key={days} onPress={() => setExpiryDays(days)} style={[styles.filterChip, expiryDays === days && styles.filterChipActive]}>
                <Text style={[styles.filterText, expiryDays === days && styles.filterTextActive]}>{days} {t("jours", "يوماً")}</Text>
              </Pressable>
            ))}
          </View>
          {(expiryQ.data ?? []).length === 0 ? <EmptyState title={t("Aucun lot proche de l'expiration", "لا توجد دفعات قاربت على الانتهاء")} /> : null}
          {(expiryQ.data ?? []).map((row) => <ExpiryCard key={row.batch_id} row={row} lang={lang} t={t} />)}
        </>
      )}

      <Modal visible={priceRow != null} transparent animationType="fade" onRequestClose={() => setPriceRow(null)}>
        <KeyboardAvoidingView behavior="padding" style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{t("Modifier le prix", "تعديل السعر")}</Text>
                <Text style={styles.meta} numberOfLines={1}>{priceRow ? (lang === "ar" ? priceRow.name_ar : priceRow.name_en) : ""}</Text>
              </View>
              <Pressable onPress={() => setPriceRow(null)} hitSlop={12} accessibilityLabel={t("Fermer", "إغلاق")}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <TextInput
              value={priceText}
              onChangeText={setPriceText}
              keyboardType="decimal-pad"
              style={styles.priceInput}
              placeholder={t("Nouveau prix", "السعر الجديد")}
              autoFocus
              testID="input-alert-product-price"
            />
            {priceError ? <Text style={styles.errorText}>{priceError}</Text> : null}
            <Button label={t("Enregistrer", "حفظ")} onPress={() => void savePrice()} loading={priceSaving} testID="button-save-alert-price" />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function SlowMoverCard({
  row, lang, t, currency, canEditPrice, onEditPrice, onSnooze, snoozed,
}: {
  row: SlowMoverRow;
  lang: ErpLang;
  t: (fr: string, ar: string) => string;
  currency: string;
  canEditPrice: boolean;
  onEditPrice: () => void;
  onSnooze: () => void;
  snoozed: boolean;
}) {
  return (
    <Card style={styles.alertCard}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{lang === "ar" ? row.name_ar || row.name_en : row.name_en || row.name_ar}</Text>
          <Text style={styles.meta}>{row.category_name_ar && lang === "ar" ? row.category_name_ar : row.category_name_en ?? "—"}</Text>
        </View>
        <View style={styles.daysPill}>
          <Text style={styles.daysText}>{row.days_since_last_sale == null ? t("Jamais vendu", "لم يُبع") : `${row.days_since_last_sale} ${t("jours", "يوم")}`}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.stock}>{t("Stock", "المخزون")}: {row.stock}</Text>
        <Text style={styles.localStock}>{t("Valeur", "القيمة")}: {money(Number(row.stock) * Number(row.cost_price ?? 0), currency)}</Text>
      </View>
      <View style={styles.actionsRow}>
        {canEditPrice ? (
          <Pressable onPress={onEditPrice} style={styles.textAction} testID={`button-alert-edit-price-${row.id}`}>
            <Feather name="edit-2" size={14} color={colors.primary} />
            <Text style={styles.linkText}>{t("Prix", "السعر")}: {money(row.selling_price, currency)}</Text>
          </Pressable>
        ) : <Text style={styles.meta}>{t("Prix", "السعر")}: {money(row.selling_price, currency)}</Text>}
        <Pressable onPress={onSnooze} style={styles.iconAction} accessibilityRole="button" testID={`button-alert-snooze-${row.id}`}>
          <Feather name={snoozed ? "rotate-ccw" : "eye-off"} size={15} color={colors.textMuted} />
          <Text style={styles.meta}>{snoozed ? t("Réafficher", "إعادة العرض") : t("Ignorer 30 j", "تأجيل 30 يوماً")}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function ExpiryCard({ row, lang, t }: { row: ExpiringProductRow; lang: ErpLang; t: (fr: string, ar: string) => string }) {
  const urgent = row.days_left <= 7;
  return (
    <Card style={[styles.alertCard, urgent && styles.urgentCard]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{lang === "ar" ? row.name_ar || row.name_en : row.name_en || row.name_ar}</Text>
          {row.lot_number ? <Text style={styles.meta}>{t("Lot", "الدفعة")}: {row.lot_number}</Text> : null}
        </View>
        <View style={[styles.daysPill, urgent && styles.urgentPill]}>
          <Text style={[styles.daysText, urgent && styles.urgentText]}>{row.days_left <= 0 ? t("Expiré", "منتهي") : `${row.days_left} ${t("jours", "يوم")}`}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.stock}>{t("Quantité", "الكمية")}: {row.quantity}</Text>
        <Text style={styles.localStock}>{new Date(row.expiry_date).toLocaleDateString(localeForLanguage(lang))}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 14 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 21, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tabs: { flexDirection: "row", gap: 7, marginBottom: 14 },
  tab: { flex: 1, minHeight: 46, paddingHorizontal: 7, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: 3, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: "#edf0f5", borderColor: colors.accent },
  tabLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "600", textAlign: "center" },
  tabLabelActive: { color: colors.primary },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  count: { color: colors.primary, fontWeight: "800", fontSize: 17 },
  alertCard: { borderLeftWidth: 3, borderLeftColor: colors.accent, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  stock: { color: colors.warning, fontSize: 12, fontWeight: "700" },
  localStock: { color: colors.textMuted, fontSize: 12 },
  checkbox: { width: 28, height: 28, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  quantityInput: { width: 80, height: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, textAlign: "center", color: colors.text, backgroundColor: colors.surface },
  actionCard: { gap: 10, marginBottom: 30, borderTopWidth: 2, borderTopColor: colors.accent },
  errorText: { color: colors.danger, fontSize: 12, marginBottom: 8 },
  filters: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginBottom: 10 },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  showSnoozed: { marginLeft: "auto", padding: 6 },
  linkText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  summaryCard: { gap: 6, marginBottom: 8, borderTopWidth: 2, borderTopColor: colors.accent },
  daysPill: { borderRadius: 20, backgroundColor: "#f4e9ce", paddingHorizontal: 9, paddingVertical: 5 },
  daysText: { color: "#795b20", fontSize: 10, fontWeight: "800" },
  actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  textAction: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  iconAction: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 36 },
  urgentCard: { borderLeftColor: colors.danger },
  urgentPill: { backgroundColor: "#fde7e7" },
  urgentText: { color: colors.danger },
  modalBackdrop: { flex: 1, justifyContent: "center", backgroundColor: "rgba(10,20,35,0.48)", padding: 22 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 18, gap: 14 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  priceInput: { height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, color: colors.text, fontSize: 16 },
});
