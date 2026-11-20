import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useSelectStore } from "@workspace/api-client-react";
import { useMe } from "@/hooks/use-me";
import { useAuth } from "@/contexts/auth-context";
import { useStoreContext } from "@/contexts/store-context";
import { useLang } from "@/contexts/lang-context";
import { colors } from "@/lib/colors";
import { getStoreTheme, type StoreThemeSource } from "@/lib/store-theme";
import { LoadingView } from "@/components/ui";

export default function SelectStore() {
  const router = useRouter();
  const { token, setToken } = useAuth();
  const { setStores, setCurrentStoreId } = useStoreContext();
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const { user: me, isLoading } = useMe();
  const selectStore = useSelectStore();

  const stores = me?.stores ?? [];

  const choose = (storeId: number) => {
    selectStore.mutate(
      { data: { storeId } },
      {
        onSuccess: async (res) => {
          await setToken(res.token);
          setCurrentStoreId(res.currentStoreId);
          setStores(stores, res.currentStoreId);
          qc.clear();
          router.replace("/home");
        },
      },
    );
  };

  if (!token) {
    router.replace("/login");
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image source={require("../assets/images/icon.png")} style={styles.logo} />
        <Text style={styles.title}>{t("Choisir un magasin", "اختر المتجر")}</Text>
        {me ? (
          <Text style={styles.userLine}>{me.name ? `${me.name} · ` : ""}{me.email}</Text>
        ) : null}

        {isLoading ? (
          <LoadingView />
        ) : stores.length === 0 ? (
          <Text style={styles.mutedText}>{t("Aucun magasin assigné", "لا توجد متاجر معينة")}</Text>
        ) : (
          <View style={{ width: "100%", gap: 8, marginTop: 16 }}>
            {stores.map((s) => {
              const storeTheme = getStoreTheme(s as StoreThemeSource);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => choose(s.id)}
                  disabled={selectStore.isPending}
                  style={({ pressed }) => [styles.storeItem, { borderStartColor: storeTheme.primary }, pressed && { opacity: 0.8 }]}
                  testID={`btn-select-store-${s.id}`}
                >
                  <View style={[styles.storeColorSwatch, { backgroundColor: storeTheme.primary }]} />
                  <Feather name="shopping-cart" size={18} color={storeTheme.primary} />
                  <Text style={styles.storeName} numberOfLines={1}>
                    {lang === "ar" ? s.nameAr : s.nameEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 420, backgroundColor: colors.surface, borderRadius: 12, padding: 26, alignItems: "center", borderBottomWidth: 3, borderBottomColor: colors.accent },
  logo: { width: 56, height: 56, borderRadius: 12, marginBottom: 10 },
  title: { fontSize: 19, fontWeight: "700", color: colors.primary },
  userLine: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  mutedText: { fontSize: 13, color: colors.textMuted, marginTop: 16 },
  storeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderStartWidth: 4,
    borderColor: colors.border,
    borderRadius: 8,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  storeColorSwatch: { width: 10, height: 10, borderRadius: 5 },
  storeName: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1 },
});
