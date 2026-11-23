import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  useGetErpCustomer,
  useGetCustomerOperations,
  useGetAdminRetours,
  getGetErpCustomerQueryKey,
  getGetCustomerOperationsQueryKey,
  getGetAdminRetoursQueryKey,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { localeForLanguage, useLang, type ErpLang } from "@/contexts/lang-context";
import { Screen } from "@/components/Screen";
import { Button, Card, LoadingView, SectionTitle, Divider, ErrorState } from "@/components/ui";
import { colors } from "@/lib/colors";
import { getContactBalance } from "@/lib/contact-balance";
import { ContactHistoryRow } from "@/components/ContactHistoryRow";

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { ready, isAdmin, can } = useProtectedRoute({ section: "customers" });
  const { t, lang } = useLang();
  const currency = lang === "ar" ? "دج" : "DA";
  const customerId = Number(id);
  const canViewOrders = isAdmin || can("orders", "view");
  const canRefund = isAdmin || can("customers", "edit");
  const [ordersLimit, setOrdersLimit] = useState(20);
  const [operationsLimit, setOperationsLimit] = useState(50);
  const [retoursLimit, setRetoursLimit] = useState(20);
  const customerParams = { ordersLimit, includeNotes: false };
  const operationsParams = { order: "desc" as const, limit: operationsLimit };
  const retourParams = { clientUserId: customerId, limit: retoursLimit };

  const { data: customer, isLoading, isError, isFetching, refetch: refetchCustomer } = useGetErpCustomer(customerId, {
    params: customerParams,
    query: {
      enabled: ready && !!customerId,
      queryKey: getGetErpCustomerQueryKey(customerId, customerParams),
      staleTime: 90_000,
      placeholderData: (previousData) => previousData,
    },
  });
  const {
    data: ops,
    isLoading: operationsLoading,
    isError: operationsError,
    isFetching: operationsFetching,
    refetch: refetchOperations,
  } = useGetCustomerOperations(customerId, operationsParams, {
    query: {
      enabled: ready && !!customerId,
      queryKey: getGetCustomerOperationsQueryKey(customerId, operationsParams),
      staleTime: 90_000,
      placeholderData: (previousData) => previousData,
    },
  });
  const {
    data: retours,
    isLoading: retoursLoading,
    isError: retoursError,
    isFetching: retoursFetching,
    refetch: refetchRetours,
  } = useGetAdminRetours(retourParams, {
    query: {
      enabled: ready && !!customerId && canViewOrders,
      queryKey: getGetAdminRetoursQueryKey(retourParams),
      staleTime: 90_000,
      placeholderData: (previousData) => previousData,
    },
  });

  if (!ready) return null;
  if (isLoading) return <LoadingView />;
  if (isError || !customer) {
    return (
      <View>
        <ErrorState title={t("Impossible de charger le client", "تعذر تحميل الزبون")} />
        <Button
          label={t("Réessayer", "إعادة المحاولة")}
          onPress={() => { void refetchCustomer(); }}
          loading={isFetching}
          testID="button-retry-customer-detail"
        />
      </View>
    );
  }

  const c = customer as any;
  const balance = getContactBalance(c);
  const orders = Array.isArray(c.orders) ? c.orders : [];
  const operations = Array.isArray(ops) ? (ops as any[]) : [];

  return (
    <Screen>
      <Card>
        <SectionTitle>{c.name}</SectionTitle>
        <Text style={styles.label}>{t("Téléphone", "الهاتف")}</Text>
        <Text style={styles.value}>{c.phone ?? "—"}</Text>
        <Text style={styles.label}>{t("Email", "البريد الإلكتروني")}</Text>
        <Text style={styles.value}>{c.email ?? "—"}</Text>
        <Text style={styles.label}>{t("Adresse", "العنوان")}</Text>
        <Text style={styles.value}>{c.address ?? "—"}</Text>
      </Card>

      <Card>
        <SectionTitle>{t("Solde", "الرصيد")}</SectionTitle>
        <Text style={[styles.balance, { color: balance < 0 ? colors.danger : colors.primary }]}>
          {balance.toLocaleString("fr-FR")} {currency}
        </Text>
      </Card>

      {canRefund ? (
        <Button
          label={t("Rembourser le client", "دفع استرداد للزبون")}
          icon={<Feather name="corner-up-left" size={17} color={colors.surface} />}
          onPress={() => router.push(`/customers/${customerId}/refund` as never)}
          testID="button-customer-refund"
        />
      ) : null}

      <Card>
        <SectionTitle>{t("Historique des ventes", "سجل المبيعات")}</SectionTitle>
        {orders.length === 0 ? (
          <Text style={styles.muted}>{t("Aucune vente", "لا توجد مبيعات")}</Text>
        ) : (
          orders.map((order: any, index: number) => (
            <View key={order.id ?? index}>
              {index > 0 ? <Divider /> : null}
              <ContactHistoryRow
                title={`${t("Vente", "بيع")} #${order.id} · ${order.status ?? "—"}`}
                subtitle={formatDate(order.createdAt, lang)}
                amount={`${Number(order.totalAmount ?? 0).toLocaleString("fr-FR")} ${currency}`}
                onPress={canViewOrders ? () => router.push(`/orders/${order.id}` as never) : undefined}
              />
            </View>
          ))
        )}
        {ordersLimit > 0 && orders.length >= ordersLimit && ordersLimit < 100 ? (
          <Button
            label={t("Charger plus de ventes", "تحميل مبيعات إضافية")}
            variant="secondary"
            onPress={() => setOrdersLimit((limit) => Math.min(limit + 20, 100))}
            loading={isFetching}
            disabled={isFetching}
            testID="button-load-more-customer-orders"
          />
        ) : null}
        {ordersLimit === 100 && orders.length >= 100 ? (
          <Button
            label={t("Charger tout l’historique", "تحميل سجل المبيعات كاملًا")}
            variant="secondary"
            onPress={() => setOrdersLimit(0)}
            loading={isFetching}
            disabled={isFetching}
            testID="button-load-all-customer-orders"
          />
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{t("Retours", "المرتجعات")}</SectionTitle>
        {!canViewOrders ? (
          <Text style={styles.muted}>{t("Permission ventes requise", "تحتاج إلى صلاحية عرض المبيعات")}</Text>
        ) : retoursLoading ? (
          <Text style={styles.muted}>{t("Chargement...", "جار التحميل...")}</Text>
        ) : retoursError ? (
          <View>
            <Text style={styles.muted}>{t("Impossible de charger les retours.", "تعذر تحميل المرتجعات.")}</Text>
            <Button
              label={t("Réessayer", "إعادة المحاولة")}
              variant="secondary"
              onPress={() => { void refetchRetours(); }}
              testID="button-retry-customer-returns"
            />
          </View>
        ) : !Array.isArray(retours) || retours.length === 0 ? (
          <Text style={styles.muted}>{t("Aucun retour", "لا توجد مرتجعات")}</Text>
        ) : (
          retours.map((retour: any, index: number) => (
            <View key={retour.id ?? index}>
              {index > 0 ? <Divider /> : null}
              <ContactHistoryRow
                title={`${t("Retour", "مرتجع")} #${retour.id} · ${returnTypeLabel(retour.retourType, t)}`}
                subtitle={`${formatDate(retour.createdAt, lang)}${retour.reason ? ` · ${retour.reason}` : ""}`}
                amount={`${Number(retour.totalAmount ?? 0).toLocaleString("fr-FR")} ${currency}`}
                onPress={() => router.push(`/retours/${retour.id}` as never)}
              />
            </View>
          ))
        )}
        {Array.isArray(retours) && retoursLimit > 0 && retours.length >= retoursLimit && retoursLimit < 100 ? (
          <Button
            label={t("Charger plus de retours", "تحميل مرتجعات إضافية")}
            variant="secondary"
            onPress={() => setRetoursLimit((limit) => Math.min(limit + 20, 100))}
            loading={retoursFetching}
            disabled={retoursFetching}
            testID="button-load-more-customer-returns"
          />
        ) : null}
        {Array.isArray(retours) && retoursLimit === 100 && retours.length >= 100 ? (
          <Button
            label={t("Charger tout l’historique", "تحميل سجل المرتجعات كاملًا")}
            variant="secondary"
            onPress={() => setRetoursLimit(0)}
            loading={retoursFetching}
            disabled={retoursFetching}
            testID="button-load-all-customer-returns"
          />
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{t("Paiements et opérations", "الدفعات والعمليات")}</SectionTitle>
        {operationsLoading ? (
          <Text style={styles.muted}>{t("Chargement...", "جار التحميل...")}</Text>
        ) : operationsError ? (
          <View>
            <Text style={styles.muted}>{t("Impossible de charger les opérations.", "تعذر تحميل العمليات.")}</Text>
            <Button
              label={t("Réessayer", "إعادة المحاولة")}
              variant="secondary"
              onPress={() => { void refetchOperations(); }}
              testID="button-retry-customer-operations"
            />
          </View>
        ) : operations.length === 0 ? (
          <Text style={styles.muted}>{t("Aucune opération", "لا توجد عمليات")}</Text>
        ) : (
          operations.map((op: any, index: number) => (
            <View key={op.id ?? index}>
              {index > 0 ? <Divider /> : null}
              <ContactHistoryRow
                title={customerOperationLabel(op.type, t)}
                subtitle={[
                  formatDate(op.date ?? op.createdAt, lang),
                  op.reference ? `${t("Réf.", "المرجع")} ${op.reference}` : null,
                  op.note,
                  op.balanceAfter != null
                    ? `${t("Solde après", "الرصيد بعد العملية")}: ${Number(op.balanceAfter).toLocaleString("fr-FR")} ${currency}`
                    : null,
                ].filter(Boolean).join(" · ")}
                amount={`${operationSign(op.type)}${Number(op.amount ?? 0).toLocaleString("fr-FR")} ${currency}`}
              />
            </View>
          ))
        )}
        {operationsLimit > 0 && operations.length >= operationsLimit && operationsLimit < 200 ? (
          <Button
            label={t("Charger plus d’opérations", "تحميل عمليات إضافية")}
            variant="secondary"
            onPress={() => setOperationsLimit((limit) => Math.min(limit + 50, 200))}
            loading={operationsFetching}
            disabled={operationsFetching}
            testID="button-load-more-customer-operations"
          />
        ) : null}
        {operationsLimit === 200 && operations.length >= 200 ? (
          <Button
            label={t("Charger toutes les opérations", "تحميل كل العمليات")}
            variant="secondary"
            onPress={() => setOperationsLimit(0)}
            loading={operationsFetching}
            disabled={operationsFetching}
            testID="button-load-all-customer-operations"
          />
        ) : null}
      </Card>
    </Screen>
  );
}

function formatDate(value: string | undefined, lang: ErpLang) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(localeForLanguage(lang));
}

function returnTypeLabel(type: string | null | undefined, t: (fr: string, ar: string) => string) {
  if (type === "remboursement") return t("avec remboursement", "مع استرداد");
  if (type === "sans_remboursement") return t("sans remboursement", "بدون استرداد");
  return type ?? "—";
}

function customerOperationLabel(type: string | undefined, t: (fr: string, ar: string) => string) {
  switch (type) {
    case "versement": return t("Versement client", "دفع الزبون");
    case "remboursement": return t("Remboursement", "استرداد مبلغ");
    case "vente_a_terme": return t("Vente à terme", "بيع آجل");
    case "avoir_retour": return t("Avoir retour", "رصيد مرتجع");
    case "ajustement": return t("Ajustement", "تسوية");
    default: return type ?? "—";
  }
}

function operationSign(type: string | undefined) {
  return type === "versement" || type === "avoir_retour" ? "−" : "+";
}

const styles = StyleSheet.create({
  label: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
  value: { fontSize: 14, color: colors.text, fontWeight: "500" },
  muted: { fontSize: 13, color: colors.textMuted },
  balance: { fontSize: 22, fontWeight: "700" },
  opRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
});
