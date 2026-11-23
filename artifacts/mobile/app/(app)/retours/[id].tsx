import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useGetAdminRetour,
  getGetAdminRetourQueryKey,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { localeForLanguage, useLang, type ErpLang } from "@/contexts/lang-context";
import { Screen } from "@/components/Screen";
import { Card, Button, LoadingView, SectionTitle, Badge, Divider, ErrorState } from "@/components/ui";
import { colors } from "@/lib/colors";

export default function RetourDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { ready } = useProtectedRoute({ section: "orders" });
  const { t, lang, isRTL } = useLang();
  const currency = lang === "ar" ? "دج" : "DA";
  const retourId = Number(id);
  const validId = Number.isSafeInteger(retourId) && retourId > 0;

  const { data: retour, isLoading, isError } = useGetAdminRetour(retourId, {
    query: { enabled: ready && validId, queryKey: getGetAdminRetourQueryKey(retourId) },
  });

  if (!ready) return null;
  const backButton = (
    <Button
      label={t("Retour à la liste", "الرجوع إلى القائمة")}
      variant="ghost"
      onPress={() => router.replace("/retours" as never)}
      testID="button-back-retours-list"
    />
  );
  if (isLoading) return <Screen>{backButton}<LoadingView /></Screen>;
  if (!validId || isError || !retour) {
    return <Screen>{backButton}<ErrorState title={t("Retour introuvable", "المرتجع غير موجود")} /></Screen>;
  }

  const items = (retour.items ?? []) as any[];
  const typeLabel = retour.retourType === "remboursement"
    ? t("Avec remboursement", "مع استرداد المبلغ")
    : retour.retourType === "sans_remboursement"
      ? t("Sans remboursement", "بدون استرداد")
      : retour.retourType ?? "—";

  return (
    <Screen>
      {backButton}
      <Card style={styles.returnCard}>
        <View style={[styles.heading, isRTL && styles.itemRowRTL]}>
          <SectionTitle>{t("Retour", "المرتجع")} #{retour.id}</SectionTitle>
          <Badge label={typeLabel} tone={retour.retourType === "remboursement" ? "info" : "muted"} />
        </View>
        <Divider />
        <Row label={t("Date", "التاريخ")} value={formatDate(retour.createdAt, lang)} />
        <Row label={t("Client", "الزبون")} value={retour.clientName ?? retour.originalOrder?.customerName ?? "—"} />
        {retour.originalOrderId ? (
          <Row label={t("Commande d'origine", "الطلب الأصلي")} value={`#${retour.originalOrderId}`} />
        ) : null}
        {retour.reason ? <Row label={t("Motif", "السبب")} value={retour.reason} /> : null}
      </Card>

      <Card>
        <SectionTitle>{t("Articles retournés", "المنتجات المرتجعة")}</SectionTitle>
        {items.length === 0 ? (
          <Text style={styles.muted}>{t("Aucun article", "لا توجد منتجات")}</Text>
        ) : (
          items.map((item, index) => (
            <View key={item.id ?? index}>
              {index > 0 ? <Divider /> : null}
              <View style={[styles.itemRow, isRTL && styles.itemRowRTL]}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {(lang === "ar" ? item.product?.nameAr : item.product?.nameEn) ?? `#${item.productId ?? "?"}`}
                </Text>
                <Text style={styles.itemAmount}>
                  x{item.quantity ?? 0} · {Number(item.unitPrice ?? 0).toLocaleString("fr-FR")} {currency}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.totalCard}>
        <View style={[styles.totalRow, isRTL && styles.itemRowRTL]}>
          <Text style={styles.totalLabel}>{t("Total", "الإجمالي")}</Text>
          <Text style={styles.totalValue}>{Number(retour.totalAmount ?? 0).toLocaleString("fr-FR")} {currency}</Text>
        </View>
      </Card>

      {retour.originalOrderId ? (
        <Button
          label={t("Voir la commande d'origine", "عرض الطلب الأصلي")}
          variant="secondary"
          onPress={() => router.push(`/orders/${retour.originalOrderId}` as never)}
          testID="button-open-original-order"
        />
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function formatDate(value: string | undefined, lang: ErpLang) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(localeForLanguage(lang));
}

const styles = StyleSheet.create({
  returnCard: { borderTopWidth: 2, borderTopColor: colors.accent },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  row: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8 },
  rowLabel: { color: colors.textMuted, fontSize: 13 },
  rowValue: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600", textAlign: "right" },
  itemRow: { minHeight: 52, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 10, borderRadius: 7, backgroundColor: colors.background },
  itemRowRTL: { flexDirection: "row-reverse" },
  itemName: { flex: 1, color: colors.text, fontSize: 14 },
  itemAmount: { color: colors.textMuted, fontSize: 12 },
  totalCard: { borderTopWidth: 2, borderTopColor: colors.accent },
  totalRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.accent },
  totalLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
  totalValue: { color: colors.primary, fontSize: 18, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 13 },
});