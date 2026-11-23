import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  getGetAnalyticsQueryKey,
  getGetCustomerProfitReportQueryKey,
  getGetMonthlyReportQueryKey,
  getGetProductProfitReportQueryKey,
  getGetSupplierReportQueryKey,
  useGetAnalytics,
  useGetCustomerProfitReport,
  useGetMonthlyReport,
  useGetProductProfitReport,
  useGetSupplierReport,
  useGetExpenseReportDetails,
  type ExpenseReportItem,
  type CustomerProfitRow,
  type MonthlyReportRow,
  type ProductProfitRow,
  type SupplierReportRow,
} from "@workspace/api-client-react";
import { localeForLanguage, localizedText, useLang, type ErpLang } from "@/contexts/lang-context";
import { useStoreContext } from "@/contexts/store-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { Screen } from "@/components/Screen";
import { Card, ErrorState, LoadingView, SectionTitle } from "@/components/ui";
import { DateField } from "@/components/DateField";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { colors } from "@/lib/colors";

type ReportTab = "monthly" | "product" | "customer" | "supplier";
type RangeDays = 7 | 30 | 90 | 365;
type IconName = keyof typeof Feather.glyphMap;

const TABS: { key: ReportTab; icon: IconName; fr: string; ar: string }[] = [
  { key: "monthly", icon: "calendar", fr: "Par mois", ar: "حسب الشهر" },
  { key: "product", icon: "box", fr: "Par produit", ar: "حسب المنتج" },
  { key: "customer", icon: "users", fr: "Par client", ar: "حسب العميل" },
  { key: "supplier", icon: "truck", fr: "Par fournisseur", ar: "حسب المورد" },
];

function dateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtractDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function formatAmount(value: number | null | undefined, currency: string) {
  return `${Number(value ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${currency}`;
}

function formatPercent(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

function formatDate(value: string, lang: ErpLang) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(localeForLanguage(lang));
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function TabButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
      testID={`report-tab-${icon}`}
    >
      <Feather name={icon} size={17} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function SimpleBarList({
  title,
  rows,
  currency,
  emptyLabel,
}: {
  title: string;
  rows: { label: string; value: number }[];
  currency: string;
  emptyLabel: string;
}) {
  const max = Math.max(...rows.map((row) => Math.max(row.value, 0)), 0);
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <Text style={styles.muted}>{emptyLabel}</Text>
      ) : (
        <View style={styles.barList}>
          {rows.map((row) => (
            <View key={row.label} style={styles.barRow}>
              <Text style={styles.barLabel} numberOfLines={2}>{row.label}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: max > 0 ? `${Math.max(4, (Math.max(row.value, 0) / max) * 100)}%` : "4%" },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{formatAmount(row.value, currency)}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function MonthlyView({
  rows,
  currency,
  lang,
  emptyLabel,
  onOpenExpenses,
}: {
  rows: MonthlyReportRow[];
  currency: string;
  lang: ErpLang;
  emptyLabel: string;
  onOpenExpenses: (month: string) => void;
}) {
  const max = Math.max(
    ...rows.flatMap((row) => [row.totalRevenue, row.grossProfit, row.totalExpenses, row.netProfit].map((value) => Math.max(value, 0))),
    0,
  );
  return (
    <>
      <Card>
        <SectionTitle>{localizedText(lang, "Évolution mensuelle — CA vs bénéfice", "تطور رقم الأعمال والأرباح")}</SectionTitle>
        {rows.length === 0 ? (
          <Text style={styles.muted}>{emptyLabel}</Text>
        ) : (
          <>
            <View style={styles.monthChart}>
              {rows.map((row) => (
                <View key={row.month} style={styles.monthGroup}>
                  <Text style={styles.monthLabel}>{row.month}</Text>
                  <View style={styles.monthBars}>
                    {[
                      { value: row.totalRevenue, color: colors.primary },
                      { value: row.grossProfit, color: colors.info },
                      { value: row.totalExpenses, color: colors.danger },
                      { value: row.netProfit, color: colors.success },
                    ].map((bar, index) => (
                      <View key={`${row.month}-${index}`} style={styles.monthBarTrack}>
                        <View
                          style={[
                            styles.monthBar,
                            { height: max > 0 ? Math.max(4, (Math.max(bar.value, 0) / max) * 110) : 4, backgroundColor: bar.color },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              <Legend color={colors.primary} label={localizedText(lang, "CA", "رقم الأعمال")} />
              <Legend color={colors.info} label={localizedText(lang, "Bénéf. brut", "الربح الإجمالي")} />
              <Legend color={colors.danger} label={localizedText(lang, "Charges", "المصاريف")} />
              <Legend color={colors.success} label={localizedText(lang, "Bénéf. net", "الربح الصافي")} />
            </View>
          </>
        )}
      </Card>
      <Card>
        <SectionTitle>{localizedText(lang, "Détail mensuel", "التفصيل الشهري")}</SectionTitle>
        {rows.map((row) => (
          <View key={row.month} style={styles.detailCard}>
            <Text style={styles.detailTitle}>{row.month}</Text>
            <View style={styles.metricsGrid}>
              <Metric label={localizedText(lang, "Chiffre d'affaires", "رقم الأعمال")} value={formatAmount(row.totalRevenue, currency)} />
              <Metric label="COGS" value={formatAmount(row.totalCogs, currency)} />
              <Metric label={localizedText(lang, "Retours", "المرتجعات")} value={formatAmount(row.totalRetours, currency)} color={colors.warning} />
              <Metric label={localizedText(lang, "Charges", "المصاريف")} value={formatAmount(row.totalExpenses, currency)} color={colors.danger} />
              <Metric label={localizedText(lang, "Bénéfice brut", "الربح الإجمالي")} value={formatAmount(row.grossProfit, currency)} color={colors.success} />
              <Metric label={localizedText(lang, "Marge", "الهامش")} value={formatPercent(row.grossMargin)} color={colors.success} />
              <Metric label={localizedText(lang, "Bénéfice net", "الربح الصافي")} value={formatAmount(row.netProfit, currency)} color={colors.primary} />
            </View>
            <Pressable
              onPress={() => onOpenExpenses(row.month)}
              style={styles.expenseLink}
              accessibilityRole="button"
              testID={`button-expense-details-${row.month}`}
            >
              <Feather name="file-text" size={14} color={colors.primary} />
              <Text style={styles.expenseLinkText}>{localizedText(lang, "Voir le détail des charges", "عرض تفاصيل المصاريف")}</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </>
  );
}

function ProductView({ rows, currency, lang, emptyLabel }: { rows: ProductProfitRow[]; currency: string; lang: ErpLang; emptyLabel: string }) {
  return (
    <>
      <SimpleBarList
        title={localizedText(lang, "Top 10 — Bénéfice brut", "أفضل 10 — الربح الإجمالي")}
        rows={rows.slice(0, 10).map((row) => ({ label: lang === "ar" ? row.nameAr || row.nameEn : row.nameEn || row.nameAr, value: row.grossProfit }))}
        currency={currency}
        emptyLabel={emptyLabel}
      />
      <Card>
        <SectionTitle>{localizedText(lang, "Détail par produit", "تفصيل المنتجات")}</SectionTitle>
        {rows.length === 0 ? <Text style={styles.muted}>{emptyLabel}</Text> : null}
        {rows.slice(0, 50).map((row) => (
          <View key={row.id} style={styles.detailCard}>
            <Text style={styles.detailTitle}>{lang === "ar" ? row.nameAr || row.nameEn : row.nameEn || row.nameAr}</Text>
            {row.reference ? <Text style={styles.detailSubtitle}>{row.reference}</Text> : null}
            <View style={styles.metricsGrid}>
              <Metric label={localizedText(lang, "Vendu", "المباع")} value={String(row.totalSold)} />
              <Metric label={localizedText(lang, "CA", "رقم الأعمال")} value={formatAmount(row.totalRevenue, currency)} />
              <Metric label="COGS" value={formatAmount(row.totalCogs, currency)} />
              <Metric label={localizedText(lang, "Bénéfice brut", "الربح الإجمالي")} value={formatAmount(row.grossProfit, currency)} color={colors.success} />
              <Metric label={localizedText(lang, "Marge", "الهامش")} value={formatPercent(row.grossMargin)} color={colors.success} />
              <Metric label={localizedText(lang, "Stock", "المخزون")} value={String(row.stock)} />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function CustomerView({ rows, currency, lang, emptyLabel }: { rows: CustomerProfitRow[]; currency: string; lang: ErpLang; emptyLabel: string }) {
  return (
    <>
      <SimpleBarList
        title={localizedText(lang, "Top 10 — Bénéfice client", "أفضل 10 — ربح العملاء")}
        rows={rows.slice(0, 10).map((row) => ({ label: row.name, value: row.grossProfit }))}
        currency={currency}
        emptyLabel={emptyLabel}
      />
      <Card>
        <SectionTitle>{localizedText(lang, "Détail par client", "تفصيل العملاء")}</SectionTitle>
        {rows.length === 0 ? <Text style={styles.muted}>{emptyLabel}</Text> : null}
        {rows.slice(0, 50).map((row) => (
          <View key={row.id} style={styles.detailCard}>
            <Text style={styles.detailTitle}>{row.name}</Text>
            {row.wilaya ? <Text style={styles.detailSubtitle}>{row.wilaya}</Text> : null}
            <View style={styles.metricsGrid}>
              <Metric label={localizedText(lang, "Commandes", "الطلبات")} value={String(row.totalOrders)} />
              <Metric label={localizedText(lang, "CA", "رقم الأعمال")} value={formatAmount(row.totalRevenue, currency)} />
              <Metric label="COGS" value={formatAmount(row.totalCogs, currency)} />
              <Metric label={localizedText(lang, "Bénéfice brut", "الربح الإجمالي")} value={formatAmount(row.grossProfit, currency)} color={colors.success} />
              <Metric label={localizedText(lang, "Marge", "الهامش")} value={formatPercent(row.grossMargin)} color={colors.success} />
              <Metric label={localizedText(lang, "Solde", "الرصيد")} value={formatAmount(row.currentBalance, currency)} color={row.currentBalance > 0 ? colors.danger : colors.success} />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function SupplierView({ rows, currency, lang, emptyLabel }: { rows: SupplierReportRow[]; currency: string; lang: ErpLang; emptyLabel: string }) {
  return (
    <>
      <SimpleBarList
        title={localizedText(lang, "Top 10 — Achats par fournisseur", "أفضل 10 — المشتريات حسب المورد")}
        rows={rows.slice(0, 10).map((row) => ({ label: row.name, value: row.totalPurchased }))}
        currency={currency}
        emptyLabel={emptyLabel}
      />
      <Card>
        <SectionTitle>{localizedText(lang, "Détail par fournisseur", "تفصيل الموردين")}</SectionTitle>
        {rows.length === 0 ? <Text style={styles.muted}>{emptyLabel}</Text> : null}
        {rows.slice(0, 50).map((row) => (
          <View key={row.id} style={styles.detailCard}>
            <Text style={styles.detailTitle}>{row.name}</Text>
            {row.contactName ? <Text style={styles.detailSubtitle}>{row.contactName}</Text> : null}
            <View style={styles.metricsGrid}>
              <Metric label={localizedText(lang, "Bons", "أوامر الشراء")} value={String(row.totalPos)} />
              <Metric label={localizedText(lang, "Acheté", "المشتريات")} value={formatAmount(row.totalPurchased, currency)} />
              <Metric label={localizedText(lang, "Reçu", "المستلم")} value={formatAmount(row.totalReceived, currency)} />
              <Metric label={localizedText(lang, "Produits", "المنتجات")} value={String(row.distinctProducts)} />
              <Metric label={localizedText(lang, "Coût moyen", "متوسط التكلفة")} value={formatAmount(row.avgUnitCost, currency)} />
              <Metric label={localizedText(lang, "À payer", "المستحق")} value={formatAmount(row.currentBalance, currency)} color={row.currentBalance > 0 ? colors.danger : colors.success} />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

export default function ProfitabilityReports({ ready }: { ready: boolean }) {
  const { t, lang } = useLang();
  const { currentStoreId, stores } = useStoreContext();
  const feedback = useApiFeedback();
  const currency = lang === "ar" ? "دج" : "DA";
  const today = new Date();
  const [fromDate, setFromDate] = useState<Date>(subtractDays(today, 29));
  const [toDate, setToDate] = useState<Date>(today);
  const [range, setRange] = useState<RangeDays | null>(30);
  const [tab, setTab] = useState<ReportTab>("monthly");
  const [chargePeriod, setChargePeriod] = useState<{ month: string; from: string; to: string; storeName: string } | null>(null);
  const [chargeSearch, setChargeSearch] = useState("");
  const [chargeCategory, setChargeCategory] = useState("all");

  const params = useMemo(() => ({ from: dateOnly(fromDate), to: dateOnly(toDate) }), [fromDate, toDate]);
  const invalidPeriod = toDate < fromDate;
  const queryEnabled = ready && !invalidPeriod;

  const analyticsQuery = useGetAnalytics({
    query: { enabled: ready, queryKey: getGetAnalyticsQueryKey() },
  });
  const monthlyQuery = useGetMonthlyReport(params, {
    query: { enabled: queryEnabled, queryKey: getGetMonthlyReportQueryKey(params) },
  });
  const productQuery = useGetProductProfitReport(params, {
    query: { enabled: queryEnabled && tab === "product", queryKey: getGetProductProfitReportQueryKey(params) },
  });
  const customerQuery = useGetCustomerProfitReport(params, {
    query: { enabled: queryEnabled && tab === "customer", queryKey: getGetCustomerProfitReportQueryKey(params) },
  });
  const supplierQuery = useGetSupplierReport(params, {
    query: { enabled: queryEnabled && tab === "supplier", queryKey: getGetSupplierReportQueryKey(params) },
  });
  const expenseQuery = useGetExpenseReportDetails(
    chargePeriod ? { from: chargePeriod.from, to: chargePeriod.to } : null,
    ready && chargePeriod != null,
  );

  const setQuickRange = (days: RangeDays) => {
    const end = new Date();
    setRange(days);
    setToDate(end);
    setFromDate(subtractDays(end, days - 1));
  };

  const openExpenseDetails = (month: string) => {
    const [year, monthNumber] = month.split("-").map(Number);
    if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) return;
    const monthStart = `${month}-01`;
    const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const fromBound = dateOnly(fromDate);
    const toBound = dateOnly(toDate);
    const store = stores.find((item) => item.id === currentStoreId);
    setChargeSearch("");
    setChargeCategory("all");
    setChargePeriod({
      month,
      from: fromBound > monthStart ? fromBound : monthStart,
      to: toBound < monthEnd ? toBound : monthEnd,
      storeName: (lang === "ar" ? store?.nameAr || store?.nameEn : store?.nameEn) || String(currentStoreId ?? "—"),
    });
  };

  const refresh = () => {
    analyticsQuery.refetch();
    monthlyQuery.refetch();
    if (tab === "product") productQuery.refetch();
    if (tab === "customer") customerQuery.refetch();
    if (tab === "supplier") supplierQuery.refetch();
  };

  const analytics = analyticsQuery.data;
  const stats = analytics
    ? [
        { label: t("Commandes", "الطلبات"), value: String(analytics.totalOrders) },
        { label: t("Chiffre d'affaires", "رقم الأعمال"), value: formatAmount(analytics.totalRevenue, currency) },
        { label: t("Coût des ventes", "تكلفة المبيعات"), value: formatAmount(analytics.totalCogs, currency) },
        { label: t("Retours", "المرتجعات"), value: formatAmount(analytics.totalRetours, currency), color: colors.warning },
        { label: t("Charges", "المصاريف"), value: formatAmount(analytics.totalExpenses, currency), color: colors.danger },
        { label: t("Bénéfice brut", "الربح الإجمالي"), value: formatAmount(analytics.grossProfit, currency), color: colors.success },
        { label: t("Marge brute", "الهامش الإجمالي"), value: formatPercent(analytics.grossMargin) },
        { label: t("Bénéfice net", "صافي الربح"), value: formatAmount(analytics.netProfit, currency), color: colors.primary },
        { label: t("Valeur du stock", "قيمة المخزون"), value: formatAmount(analytics.inventoryValue, currency) },
        { label: t("Dette clients", "ديون العملاء"), value: formatAmount(analytics.customerDebt, currency), color: colors.danger },
        { label: t("Dettes fournisseurs", "ديون الموردين"), value: formatAmount(analytics.supplierPayables, currency), color: colors.danger },
        { label: t("Commandes en attente", "الطلبات المعلقة"), value: String(analytics.pendingOrders) },
      ]
    : [];

  const activeQuery =
    tab === "monthly" ? monthlyQuery :
    tab === "product" ? productQuery :
    tab === "customer" ? customerQuery : supplierQuery;

  return (
    <Screen onRefresh={refresh} refreshing={analyticsQuery.isRefetching || activeQuery.isRefetching || expenseQuery.isRefetching}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("Rapports de rentabilité", "تقارير الربحية")}</Text>
        <Text style={styles.subtitle}>{t("Analyse des marges et des flux par période", "تحليل الهوامش والتدفقات حسب الفترة")}</Text>
      </View>

      <Card>
        <View style={styles.rangeButtons}>
          {([7, 30, 90, 365] as RangeDays[]).map((days) => (
            <Pressable
              key={days}
              onPress={() => setQuickRange(days)}
              style={[styles.rangeButton, range === days && styles.rangeButtonActive]}
              testID={`button-report-range-${days}`}
            >
              <Text style={[styles.rangeButtonText, range === days && styles.rangeButtonTextActive]}>
                {days}{"\n"}{t("jours", "يومًا")}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.dateRow}>
          <View style={styles.dateColumn}>
            <DateField label={t("Du", "من")} value={fromDate} onChange={(date) => { setRange(null); setFromDate(date); }} maximumDate={toDate} />
          </View>
          <View style={styles.dateColumn}>
            <DateField label={t("Au", "إلى")} value={toDate} onChange={(date) => { setRange(null); setToDate(date); }} minimumDate={fromDate} />
          </View>
        </View>
        {invalidPeriod ? <Text style={styles.errorText}>{t("La période est invalide", "الفترة غير صحيحة")}</Text> : null}
      </Card>

      <Card>
        <SectionTitle>{t("Analyse (30 derniers jours)", "التحليلات (آخر 30 يومًا)")}</SectionTitle>
        {analyticsQuery.isLoading ? (
          <LoadingView />
        ) : (
          <View style={styles.summaryList}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{stat.label}</Text>
                <Text style={[styles.summaryValue, stat.color ? { color: stat.color } : null]}>{stat.value}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((item) => (
          <TabButton key={item.key} active={tab === item.key} icon={item.icon} label={t(item.fr, item.ar)} onPress={() => setTab(item.key)} />
        ))}
      </ScrollView>

      {!queryEnabled ? (
        <ErrorState title={t("Période invalide", "الفترة غير صحيحة")} />
      ) : activeQuery.isLoading ? (
        <LoadingView />
      ) : tab === "monthly" ? (
        <MonthlyView rows={monthlyQuery.data ?? []} currency={currency} lang={lang} emptyLabel={t("Aucune donnée pour cette période", "لا توجد بيانات لهذه الفترة")} onOpenExpenses={openExpenseDetails} />
      ) : tab === "product" ? (
        <ProductView rows={productQuery.data ?? []} currency={currency} lang={lang} emptyLabel={t("Aucun produit pour cette période", "لا توجد منتجات لهذه الفترة")} />
      ) : tab === "customer" ? (
        <CustomerView rows={customerQuery.data ?? []} currency={currency} lang={lang} emptyLabel={t("Aucun client pour cette période", "لا يوجد عملاء لهذه الفترة")} />
      ) : (
        <SupplierView rows={supplierQuery.data ?? []} currency={currency} lang={lang} emptyLabel={t("Aucun fournisseur pour cette période", "لا يوجد موردون لهذه الفترة")} />
      )}
      <ExpenseDetailsModal
        visible={chargePeriod != null}
        period={chargePeriod}
        data={expenseQuery.data ?? []}
        loading={expenseQuery.isLoading}
        error={expenseQuery.isError}
        search={chargeSearch}
        category={chargeCategory}
        currency={currency}
        lang={lang}
        t={t}
        onSearch={setChargeSearch}
        onCategory={setChargeCategory}
        onClose={() => setChargePeriod(null)}
        onError={(error) => feedback.error(error)}
      />
    </Screen>
  );
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

function ExpenseDetailsModal({
  visible, period, data, loading, error, search, category, currency, lang, t,
  onSearch, onCategory, onClose, onError,
}: {
  visible: boolean;
  period: { month: string; from: string; to: string; storeName: string } | null;
  data: ExpenseReportItem[];
  loading: boolean;
  error: boolean;
  search: string;
  category: string;
  currency: string;
  lang: ErpLang;
  t: (fr: string, ar: string) => string;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onClose: () => void;
  onError: (error: unknown) => void;
}) {
  const normalized = search.trim().toLocaleLowerCase();
  const categories = [...new Set(data.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filtered = data.filter((item) => {
    const matchesCategory = category === "all" || item.category === category;
    const searchText = `${item.description} ${item.reference ?? ""}`.toLocaleLowerCase();
    return matchesCategory && (!normalized || searchText.includes(normalized));
  });
  const total = filtered.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  async function exportCsv() {
    if (!period) return;
    const rows = [
      [t("Date", "التاريخ"), t("Catégorie", "الفئة"), t("Détail", "التفصيل"), t("Référence", "المرجع"), t("Montant", "المبلغ")],
      ...filtered.map((item) => [item.createdAt.slice(0, 10), item.category, item.description, item.reference ?? "", Number(item.amount).toFixed(2)]),
    ];
    const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    try {
      if (Platform.OS === "web") {
        const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `expenses-${period.from}-${period.to}-${lang}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      await Share.share({ title: `expenses-${period.from}-${period.to}.csv`, message: content });
    } catch (exportError) {
      onError(exportError);
    }
  }

  async function printPdf() {
    if (!period) return;
    const direction = lang === "ar" ? "rtl" : "ltr";
    const rows = filtered.map((item) => `
      <tr>
        <td>${escapeHtml(item.createdAt.slice(0, 10))}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.description || "—")}</td>
        <td>${escapeHtml(item.reference || "—")}</td>
        <td class="amount">${escapeHtml(Number(item.amount).toFixed(2))} ${escapeHtml(currency)}</td>
      </tr>`).join("");
    const html = `<!doctype html><html dir="${direction}" lang="${lang}"><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;color:#202a36;padding:24px}h1{font-size:20px;margin:0 0 6px}p{color:#637080;margin:0 0 18px}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:9px 7px;border-bottom:1px solid #dbe0e5;text-align:start}
      th{background:#f1f3f5}.amount{font-weight:bold;white-space:nowrap}.total{margin-top:16px;text-align:end;font-weight:bold;color:#b33}
      </style></head><body><h1>${escapeHtml(t("Détail des charges", "تفاصيل المصاريف"))} — ${escapeHtml(period.month)}</h1>
      <p>${escapeHtml(period.storeName)} · ${escapeHtml(period.from)} – ${escapeHtml(period.to)}</p>
      <table><thead><tr><th>${escapeHtml(t("Date", "التاريخ"))}</th><th>${escapeHtml(t("Catégorie", "الفئة"))}</th><th>${escapeHtml(t("Détail", "التفصيل"))}</th><th>${escapeHtml(t("Référence", "المرجع"))}</th><th>${escapeHtml(t("Montant", "المبلغ"))}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5">${escapeHtml(t("Aucune charge", "لا توجد مصاريف"))}</td></tr>`}</tbody></table>
      <div class="total">${escapeHtml(t("Total", "الإجمالي"))}: ${escapeHtml(total.toFixed(2))} ${escapeHtml(currency)}</div></body></html>`;
    try {
      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (!printWindow) throw new Error(t("Autorisez les fenêtres contextuelles pour imprimer.", "يرجى السماح بالنوافذ المنبثقة للطباعة."));
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        return;
      }
      const file = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: t("Partager le rapport PDF", "مشاركة تقرير PDF") });
    } catch (printError) {
      onError(printError);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.expenseBackdrop}>
        <View style={styles.expenseModal}>
          <View style={styles.expenseHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.expenseTitle}>{t("Détail des charges", "تفاصيل المصاريف")}{period ? ` — ${period.month}` : ""}</Text>
              <Text style={styles.expenseSubtitle}>{period ? `${period.from} – ${period.to}` : ""}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t("Fermer", "إغلاق")}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.exportButtons}>
            <Pressable onPress={() => void exportCsv()} disabled={loading || error} style={[styles.exportButton, (loading || error) && styles.exportDisabled]} testID="button-expense-export-csv">
              <Feather name="share" size={15} color={colors.primary} />
              <Text style={styles.exportButtonText}>{t("Partager CSV", "مشاركة CSV")}</Text>
            </Pressable>
            <Pressable onPress={() => void printPdf()} disabled={loading || error} style={[styles.exportButton, (loading || error) && styles.exportDisabled]} testID="button-expense-print-pdf">
              <Feather name="printer" size={15} color={colors.primary} />
              <Text style={styles.exportButtonText}>{t("Imprimer / PDF", "طباعة / PDF")}</Text>
            </Pressable>
          </View>
          <TextInput
            value={search}
            onChangeText={onSearch}
            placeholder={t("Rechercher le détail ou la référence", "ابحث في التفاصيل أو المرجع")}
            style={styles.expenseSearch}
            testID="input-expense-search"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.expenseCategories}>
            {[{ key: "all", label: t("Toutes", "الكل") }, ...categories.map((value) => ({ key: value, label: value }))].map((item) => (
              <Pressable key={item.key} onPress={() => onCategory(item.key)} style={[styles.expenseCategory, category === item.key && styles.expenseCategoryActive]}>
                <Text style={[styles.expenseCategoryText, category === item.key && styles.expenseCategoryTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {loading ? <LoadingView /> : error ? <ErrorState title={t("Impossible de charger les charges", "تعذر تحميل المصاريف")} /> : (
            <>
              <View style={styles.expenseTotalRow}>
                <Text style={styles.expenseSubtitle}>{filtered.length} / {data.length} {t("résultats", "نتيجة")}</Text>
                <Text style={styles.expenseTotal}>{t("Total", "الإجمالي")}: {formatAmount(total, currency)}</Text>
              </View>
              <KeyboardAwareScrollViewCompat contentContainerStyle={styles.expenseRows} keyboardShouldPersistTaps="handled">
                {filtered.map((item) => (
                  <View key={item.id} style={styles.expenseRow}>
                    <View style={styles.expenseRowTop}>
                      <Text style={styles.expenseDate}>{item.createdAt.slice(0, 10)}</Text>
                      <Text style={styles.expenseAmount}>{formatAmount(Number(item.amount), currency)}</Text>
                    </View>
                    <Text style={styles.expenseCategoryName}>{item.category}</Text>
                    <Text style={styles.expenseDescription}>{item.description || "—"}</Text>
                    {item.reference ? <Text style={styles.expenseReference}>{t("Réf.", "المرجع")}: {item.reference}</Text> : null}
                  </View>
                ))}
                {filtered.length === 0 ? <Text style={styles.muted}>{data.length ? t("Aucun résultat pour ces filtres.", "لا توجد نتائج لهذه الفلاتر.") : t("Aucune charge pour cette période.", "لا توجد مصاريف في هذه الفترة.")}</Text> : null}
              </KeyboardAwareScrollViewCompat>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 15 },
  rangeButtons: { flexDirection: "row", gap: 8, marginBottom: 12 },
  rangeButton: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 58, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  rangeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeButtonText: { color: colors.primary, fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 19 },
  rangeButtonTextActive: { color: colors.surface },
  dateRow: { flexDirection: "row", gap: 10 },
  dateColumn: { flex: 1, minWidth: 0 },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 4 },
  summaryList: { gap: 0 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  summaryLabel: { flex: 1, color: colors.textMuted, fontSize: 14 },
  summaryValue: { color: colors.text, fontSize: 15, fontWeight: "800", textAlign: "right" },
  tabs: { gap: 8, paddingVertical: 2 },
  tabButton: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  tabButtonActive: { backgroundColor: colors.surface, borderColor: colors.primary, shadowColor: colors.text, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: colors.primary },
  metric: { width: "48%", marginBottom: 12 },
  metricLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 3 },
  metricValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 14, paddingVertical: 6 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 11, height: 11, borderRadius: 2 },
  legendText: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  monthChart: { flexDirection: "row", alignItems: "flex-end", minHeight: 150, gap: 12, paddingTop: 12 },
  monthGroup: { flex: 1, alignItems: "center", gap: 7 },
  monthBars: { height: 120, flexDirection: "row", alignItems: "flex-end", gap: 3 },
  monthBarTrack: { width: 9, height: 115, justifyContent: "flex-end" },
  monthBar: { width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  monthLabel: { color: colors.textMuted, fontSize: 11 },
  detailCard: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 13 },
  detailTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  detailSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 10 },
  barList: { gap: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { width: 92, color: colors.text, fontSize: 11, fontWeight: "600" },
  barTrack: { flex: 1, height: 14, borderRadius: 5, backgroundColor: colors.border, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 5, backgroundColor: colors.primary },
  barValue: { width: 78, color: colors.textMuted, fontSize: 10, fontWeight: "700", textAlign: "right" },
  expenseLink: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7, marginTop: 5 },
  expenseLinkText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  expenseBackdrop: { flex: 1, justifyContent: "center", backgroundColor: "rgba(10,20,35,0.48)", padding: 12 },
  expenseModal: { maxHeight: "94%", borderRadius: 18, backgroundColor: colors.surface, padding: 15 },
  expenseHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  expenseTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  expenseSubtitle: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  exportButtons: { flexDirection: "row", gap: 8, marginVertical: 10 },
  exportButton: { flex: 1, minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.background },
  exportDisabled: { opacity: 0.45 },
  exportButtonText: { color: colors.primary, fontSize: 10, fontWeight: "700" },
  expenseSearch: { minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, color: colors.text, backgroundColor: colors.background },
  expenseCategories: { gap: 7, paddingVertical: 9 },
  expenseCategory: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  expenseCategoryActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  expenseCategoryText: { color: colors.textMuted, fontSize: 10, fontWeight: "600" },
  expenseCategoryTextActive: { color: colors.surface },
  expenseTotalRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  expenseTotal: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  expenseRows: { gap: 8, paddingTop: 8, paddingBottom: 18 },
  expenseRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 10, gap: 3 },
  expenseRowTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  expenseDate: { color: colors.textMuted, fontSize: 10 },
  expenseAmount: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  expenseCategoryName: { color: colors.primary, fontSize: 10, fontWeight: "700" },
  expenseDescription: { color: colors.text, fontSize: 12 },
  expenseReference: { color: colors.textMuted, fontSize: 10 },
});