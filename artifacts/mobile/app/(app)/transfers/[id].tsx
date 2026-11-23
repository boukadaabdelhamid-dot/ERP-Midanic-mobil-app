import React from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetErpTransfer,
  getGetErpTransferQueryKey,
  getGetErpTransfersQueryKey,
  useApproveErpTransfer,
  useRejectErpTransfer,
  usePrepareErpTransfer,
  useShipErpTransfer,
  useReceiveErpTransfer,
  useCancelErpTransfer,
} from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useStoreContext } from "@/contexts/store-context";
import { localeForLanguage, useLang } from "@/contexts/lang-context";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { useConfirm } from "@/contexts/confirm-context";
import { Screen } from "@/components/Screen";
import { Card, Button, LoadingView, SectionTitle, Divider, ErrorState } from "@/components/ui";
import { getTransferActions, getTransferQuantities, type TransferAction } from "@/hooks/use-transfer-status-actions";
import { TransferStatusBadge } from "@/components/TransferStatusBadge";
import { colors } from "@/lib/colors";

export default function TransferDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, isAdmin, can } = useProtectedRoute({ section: "transfers" });
  const { currentStoreId } = useStoreContext();
  const { t, lang, isRTL } = useLang();
  const feedback = useApiFeedback();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const transferId = Number(id);
  const [receivedQuantities, setReceivedQuantities] = React.useState<Record<number, string>>({});

  const { data: transfer, isLoading, isError } = useGetErpTransfer(transferId, {
    query: { enabled: ready && !!transferId, queryKey: getGetErpTransferQueryKey(transferId) },
  });

  const approve = useApproveErpTransfer();
  const reject = useRejectErpTransfer();
  const prepare = usePrepareErpTransfer();
  const ship = useShipErpTransfer();
  const receive = useReceiveErpTransfer();
  const cancel = useCancelErpTransfer();

  if (!ready) return null;
  if (isLoading) return <LoadingView />;
  if (isError || !transfer) return <ErrorState title={t("Transfert introuvable", "التحويل غير موجود")} />;

  const tr = transfer as any;
  const items = tr.items ?? [];

  const isSource = tr.sourceStoreId === currentStoreId;
  const isDestination = tr.destinationStoreId === currentStoreId;
  const actions = can("transfers", "edit")
    ? getTransferActions(tr.status, { isSource, isDestination, isAdmin })
    : [];
  const canReceive = actions.some((action) => action.action === "receive");
  const invalidReceiptQuantity = items.some((item: any) => {
    const quantity = Number((receivedQuantities[item.id] ?? String(item.quantity)).replace(",", "."));
    return !Number.isFinite(quantity) || quantity < 0 || quantity > Number(item.quantity);
  });

  const mutations: Record<TransferAction, { mutate: (vars: any, opts?: any) => void; isPending: boolean }> = {
    approve, reject, prepare, ship, receive, cancel,
  };

  async function handleAction(action: TransferAction, destructive?: boolean, label?: string) {
    if (action === "receive" && invalidReceiptQuantity) return;
    if (destructive) {
      const ok = await confirm({
        title: label ?? t("Confirmer", "تأكيد"),
        message: t("Cette action est irréversible.", "هذا الإجراء لا يمكن التراجع عنه."),
        destructive: true,
      });
      if (!ok) return;
    }
    mutations[action].mutate(
      {
        id: transferId,
        data: action === "receive"
          ? { items: items.map((item: any) => ({
              transferItemId: item.id,
              receivedQuantity: Number((receivedQuantities[item.id] ?? String(item.quantity)).replace(",", ".")),
            })) }
          : {},
      },
      {
        onSuccess: () => {
          feedback.success("Transfert mis à jour", "تم تحديث التحويل");
          queryClient.invalidateQueries({ queryKey: getGetErpTransferQueryKey(transferId) });
          queryClient.invalidateQueries({ queryKey: getGetErpTransfersQueryKey() });
        },
        onError: (e: unknown) => feedback.error(e),
      },
    );
  }

  return (
    <Screen>
      <Card style={styles.summaryCard}>
        <View style={styles.heading}>
          <SectionTitle>{t("Transfert", "التحويل")} #{tr.id}</SectionTitle>
          <TransferStatusBadge status={tr.status} />
        </View>
        <Divider />
        <View style={styles.storeRoute}>
          <View style={styles.storeBlock}>
            <Text style={styles.label}>{t("De", "من")}</Text>
            <Text style={styles.value}>{(lang === "ar" ? tr.sourceStore?.nameAr : tr.sourceStore?.nameEn) ?? "—"}</Text>
          </View>
          <View style={styles.routeIcon}>
            <Feather name={isRTL ? "arrow-left" : "arrow-right"} size={16} color={colors.accent} />
          </View>
          <View style={styles.storeBlock}>
            <Text style={styles.label}>{t("Vers", "إلى")}</Text>
            <Text style={styles.value}>{(lang === "ar" ? tr.destinationStore?.nameAr : tr.destinationStore?.nameEn) ?? "—"}</Text>
          </View>
        </View>
        {tr.notes ? (
          <View style={styles.notesBlock}>
            <Text style={styles.label}>{t("Notes", "ملاحظات")}</Text>
            <Text style={styles.value}>{tr.notes}</Text>
          </View>
        ) : null}
      </Card>

      <Card style={styles.itemsCard}>
        <SectionTitle>{t("Articles", "المنتجات")}</SectionTitle>
        {items.length === 0 ? (
          <Text style={styles.muted}>{t("Aucun article", "لا توجد منتجات")}</Text>
        ) : (
          items.map((it: any, i: number) => {
            const quantities = getTransferQuantities(it);
            const formatQuantity = (value: number) => value.toLocaleString(localeForLanguage(lang), { maximumFractionDigits: 12 });
            const sentLabel = tr.status === "in_transit" || tr.status === "received"
              ? t("Envoyé", "الكمية المرسلة")
              : t("À transférer", "الكمية المطلوب تحويلها");
            return (
            <View key={it.id ?? i}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.value}>
                    {(lang === "ar"
                      ? it.sourceProductNameAr ?? it.sourceProductNameEn
                      : it.sourceProductNameEn ?? it.sourceProductNameAr) ?? `#${it.sourceProductId ?? it.productId}`}
                  </Text>
                  {tr.status === "received" && quantities.missing != null ? (
                    <Text style={styles.label}>
                      {t("Manquant", "النقص")}: {formatQuantity(quantities.missing)}
                    </Text>
                  ) : null}
                </View>
                {canReceive ? (
                  <View style={styles.receiveCell}>
                    <Text style={styles.label} testID={`transfer-sent-quantity-${it.id}`}>
                      {sentLabel}: {formatQuantity(quantities.sent)}
                    </Text>
                    <Text style={styles.label}>{t("Quantité reçue", "الكمية المستلمة")}</Text>
                    <TextInput
                      value={receivedQuantities[it.id] ?? String(it.quantity)}
                      onChangeText={(value) => setReceivedQuantities((current) => ({ ...current, [it.id]: value }))}
                      keyboardType="decimal-pad"
                      style={styles.receivedInput}
                      accessibilityLabel={t("Quantité reçue", "الكمية المستلمة")}
                      testID={`input-received-quantity-${it.id}`}
                    />
                  </View>
                ) : (
                  <View style={styles.receiveCell}>
                    <Text style={styles.label} testID={`transfer-sent-quantity-${it.id}`}>
                      {sentLabel}: {formatQuantity(quantities.sent)}
                    </Text>
                    <Text style={styles.value} testID={`transfer-received-quantity-${it.id}`}>
                      {t("Reçu", "الكمية المستلمة")}: {quantities.received != null
                        ? formatQuantity(quantities.received)
                        : tr.status === "received" ? t("Non renseignée", "غير مسجلة") : "—"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            );
          })
        )}
      </Card>

      {actions.length > 0 ? (
        <Card style={styles.actionsCard}>
          <SectionTitle>{t("Actions", "الإجراءات")}</SectionTitle>
          <View style={{ gap: 10 }}>
            {actions.map((a) => (
              <Button
                key={a.action}
                label={t(a.label, a.labelAr)}
                variant={a.destructive ? "danger" : "primary"}
                loading={mutations[a.action].isPending}
                disabled={a.action === "receive" && invalidReceiptQuantity}
                onPress={() => handleAction(a.action, a.destructive, t(a.label, a.labelAr))}
                testID={`button-transfer-${a.action}`}
              />
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryCard: { borderTopWidth: 2, borderTopColor: colors.accent },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  storeRoute: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 8, backgroundColor: colors.background },
  storeBlock: { flex: 1, minWidth: 0 },
  routeIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  notesBlock: { marginTop: 10, padding: 11, borderRadius: 8, backgroundColor: colors.background },
  itemsCard: { borderTopWidth: 2, borderTopColor: colors.accent },
  actionsCard: { borderTopWidth: 2, borderTopColor: colors.accent },
  label: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
  value: { fontSize: 14, color: colors.text, fontWeight: "600" },
  muted: { fontSize: 13, color: colors.textMuted },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 7, backgroundColor: colors.background },
  receiveCell: { alignItems: "flex-end", gap: 4 },
  receivedInput: { width: 76, height: 38, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, color: colors.text, textAlign: "center", paddingHorizontal: 6 },
});
