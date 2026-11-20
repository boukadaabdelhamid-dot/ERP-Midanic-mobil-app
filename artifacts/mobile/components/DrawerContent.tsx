import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator } from "react-native";
import { DrawerContentScrollView } from "expo-router/drawer";
import type { DrawerContentComponentProps } from "expo-router/drawer";
import { useRouter, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useSelectStore } from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/colors";
import { useLang } from "@/contexts/lang-context";
import { useLanguageSwitch } from "@/hooks/use-language-switch";
import { useMe } from "@/hooks/use-me";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { usePermissions } from "@/contexts/permissions-context";
import { useAuth } from "@/contexts/auth-context";
import { useStoreContext } from "@/contexts/store-context";
import { filterMenuGroups, MENU_GROUPS } from "@/lib/menu";
import { getStoreTheme, type StoreThemeSource } from "@/lib/store-theme";

export default function DrawerContent(props: DrawerContentComponentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { lang, t } = useLang();
  const { toggleLanguage } = useLanguageSwitch();
  const { user, isAdmin } = useMe();
  const { can } = usePermissions();
  const { logout, setToken } = useAuth();
  const { stores: contextStores, currentStoreId, setStores } = useStoreContext();
  const queryClient = useQueryClient();
  const selectStore = useSelectStore();
  const feedback = useApiFeedback();
  const [storePickerOpen, setStorePickerOpen] = useState(false);

  const stores = user?.stores?.length ? user.stores : contextStores;
  const selectedStoreId = currentStoreId ?? user?.currentStoreId ?? null;
  const selectedStore = stores.find((store) => store.id === selectedStoreId);
  const selectedStoreKind =
    (selectedStore as { kind?: "store" | "factory" } | undefined)?.kind ??
    (user as { stores?: Array<{ id: number; kind?: "store" | "factory" }> } | null)?.stores?.find((store) => store.id === selectedStoreId)?.kind;
  const selectedStoreTheme = getStoreTheme(selectedStore as StoreThemeSource | undefined);
  const selectedStoreName = selectedStore
    ? (lang === "ar" ? selectedStore.nameAr : selectedStore.nameEn)
    : null;

  function chooseStore(storeId: number) {
    if (storeId === selectedStoreId) {
      setStorePickerOpen(false);
      return;
    }
    selectStore.mutate(
      { data: { storeId } },
      {
        onSuccess: async (response) => {
          await setToken(response.token);
          await setStores(stores, response.currentStoreId);
          queryClient.clear();
          setStorePickerOpen(false);
          props.navigation.closeDrawer();
          feedback.success("Magasin changé", "تم تغيير المتجر");
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  const visibleGroups = filterMenuGroups(MENU_GROUPS, selectedStoreKind, isAdmin, can);

  const activeGroupKey = visibleGroups.find((group) =>
    group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)),
  )?.key ?? null;
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(
    () => activeGroupKey ?? "main",
  );

  useEffect(() => {
    if (activeGroupKey) setOpenGroupKey(activeGroupKey);
  }, [activeGroupKey]);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: selectedStoreTheme.primary, borderBottomColor: selectedStoreTheme.accent }]}>
        <Text style={styles.brand}>Midanic</Text>
        <Text style={styles.brandSub}>{t("Espace personnel", "المساحة الإدارية")}</Text>
        {user ? (
          <Text style={styles.userLine} numberOfLines={1}>
            {(user as { name?: string; email?: string }).name ?? (user as { email?: string }).email}
          </Text>
        ) : null}
        {stores.length > 0 ? (
          <>
            <Pressable
              onPress={() => stores.length > 1 && setStorePickerOpen((open) => !open)}
              disabled={stores.length <= 1 || selectStore.isPending}
              style={({ pressed }) => [styles.storeSelector, pressed && styles.storeSelectorPressed]}
              testID="button-switch-store"
            >
              <Feather name="shopping-bag" size={16} color="#fff" />
              <View style={styles.storeSelectorText}>
                <Text style={styles.storeSelectorLabel}>{selectedStoreKind === "factory" ? t("Unité de production", "وحدة الإنتاج") : t("Magasin actuel", "المتجر الحالي")}</Text>
                <Text style={styles.storeSelectorValue} numberOfLines={1}>
                  {selectedStoreName ?? t("Sélectionner un magasin", "اختر متجرًا")}
                </Text>
              </View>
              {selectStore.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : stores.length > 1 ? (
                <Feather name={storePickerOpen ? "chevron-up" : "chevron-down"} size={18} color="#fff" />
              ) : null}
            </Pressable>
            {storePickerOpen ? (
              <View style={styles.storeOptions}>
                {stores.map((store) => {
                  const isSelected = store.id === selectedStoreId;
                  const storeTheme = getStoreTheme(store as StoreThemeSource);
                  return (
                    <Pressable
                      key={store.id}
                      onPress={() => chooseStore(store.id)}
                      disabled={selectStore.isPending}
                      style={({ pressed }) => [
                        styles.storeOption,
                        isSelected && { backgroundColor: storeTheme.primary },
                        pressed && styles.storeOptionPressed,
                      ]}
                      testID={`button-switch-store-${store.id}`}
                    >
                      <View style={[styles.storeColorSwatch, { backgroundColor: storeTheme.primary }]} />
                      <Text style={[styles.storeOptionText, isSelected && { color: "#fff" }]} numberOfLines={1}>
                        {lang === "ar" ? store.nameAr : store.nameEn}
                      </Text>
                      {isSelected ? <Feather name="check" size={16} color="#fff" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {visibleGroups.map((group) => {
        const isOpen = openGroupKey === group.key;
        return (
          <View key={group.key} style={styles.group}>
            <Pressable
              onPress={() => setOpenGroupKey((current) => current === group.key ? null : group.key)}
              style={({ pressed }) => [styles.groupHeader, pressed && styles.groupHeaderPressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              testID={`button-toggle-menu-group-${group.key}`}
            >
              <Text style={styles.groupTitle}>{t(group.titleFr, group.titleAr)}</Text>
              <Feather
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.textMuted}
              />
            </Pressable>
            {isOpen ? group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => router.push(item.href as never)}
                  style={[
                    styles.item,
                    active && styles.itemActive,
                    active && (lang === "ar" ? styles.itemActiveRTL : styles.itemActiveLTR),
                    active && (lang === "ar"
                      ? { borderRightColor: selectedStoreTheme.accent }
                      : { borderLeftColor: selectedStoreTheme.accent }),
                  ]}
                >
                  <Feather name={item.icon} size={18} color={active ? selectedStoreTheme.primary : colors.textMuted} />
                  <Text style={[styles.itemLabel, active && styles.itemLabelActive, active && { color: selectedStoreTheme.primary }]}>
                    {t(item.labelFr, item.labelAr)}
                  </Text>
                </Pressable>
              );
            }) : null}
          </View>
        );
      })}

      <View style={styles.footer}>
        <Pressable style={styles.langSwitch} onPress={toggleLanguage}>
          <Feather name="globe" size={16} color={colors.textMuted} />
          <Text style={styles.itemLabel}>{lang === "ar" ? "Français" : "العربية"}</Text>
        </Pressable>
        <Pressable style={styles.logout} onPress={() => logout()}>
          <Feather name="log-out" size={16} color={colors.danger} />
          <Text style={[styles.itemLabel, { color: colors.danger }]}>{t("Déconnexion", "تسجيل الخروج")}</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary, paddingBottom: 22, paddingHorizontal: 20, marginBottom: 12, borderBottomWidth: 3, borderBottomColor: colors.accent },
  brand: { color: "#F7F5EF", fontSize: 23, fontWeight: "700", letterSpacing: 0.2 },
  brandSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  userLine: { color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 10 },
  storeSelector: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  storeSelectorPressed: { opacity: 0.8 },
  storeSelectorText: { flex: 1, gap: 1 },
  storeSelectorLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "600" },
  storeSelectorValue: { color: "#fff", fontSize: 13, fontWeight: "700" },
  storeOptions: { marginTop: 4, gap: 4 },
  storeOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 10, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.08)" },
  storeOptionPressed: { opacity: 0.8 },
  storeOptionText: { color: "#fff", fontSize: 12, fontWeight: "600", flex: 1 },
  storeColorSwatch: { width: 9, height: 9, borderRadius: 5, marginEnd: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.72)" },
  group: { paddingHorizontal: 12, marginBottom: 8 },
  groupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 6 },
  groupHeaderPressed: { backgroundColor: "#ECECE6" },
  groupTitle: { fontSize: 11, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 6 },
  itemActive: { backgroundColor: "#E8EBF0" },
  itemActiveLTR: { borderLeftWidth: 3, borderLeftColor: colors.accent },
  itemActiveRTL: { borderRightWidth: 3, borderRightColor: colors.accent },
  itemLabel: { fontSize: 14, color: colors.text },
  itemLabelActive: { color: colors.primary, fontWeight: "600" },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8, paddingHorizontal: 12, gap: 4 },
  langSwitch: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 10, paddingHorizontal: 8 },
  logout: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 10, paddingHorizontal: 8 },
});
