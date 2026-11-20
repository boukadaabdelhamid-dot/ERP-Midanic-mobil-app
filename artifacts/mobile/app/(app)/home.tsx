import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useLang } from "@/contexts/lang-context";
import { useMe } from "@/hooks/use-me";
import { usePermissions } from "@/contexts/permissions-context";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { LoadingView } from "@/components/ui";
import { colors } from "@/lib/colors";
import type { PermSection } from "@/contexts/permissions-context";
import { useCurrentStore } from "@/hooks/use-current-store";

type HomeModule = {
  labelFr: string;
  labelAr: string;
  href: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  section: PermSection;
  /** Backend route is `requireAdmin`-gated regardless of section permissions (e.g. /admin/low-stock). */
  adminOnly?: boolean;
  storeKind?: "store" | "factory";
};

const MODULES: HomeModule[] = [
  { labelFr: "Production", labelAr: "الإنتاج", href: "/manufacturing", icon: "tool", color: colors.primary, section: "manufacturing", storeKind: "factory" },
  { labelFr: "Articles", labelAr: "المنتجات", href: "/products", icon: "package", color: colors.primary, section: "products" },
  { labelFr: "Ventes", labelAr: "المبيعات", href: "/orders", icon: "shopping-cart", color: colors.primary, section: "orders" },
  { labelFr: "Point de vente", labelAr: "نقطة البيع", href: "/pos", icon: "credit-card", color: colors.primary, section: "orders" },
  { labelFr: "Achats", labelAr: "المشتريات", href: "/purchase-orders", icon: "file-text", color: colors.primary, section: "purchases" },
  { labelFr: "Besoin d'achats", labelAr: "ما ينقص", href: "/smart-purchase", icon: "shopping-bag", color: colors.primary, section: "purchases", adminOnly: true },
  { labelFr: "Caisse", labelAr: "الصندوق", href: "/caisse", icon: "credit-card", color: colors.primary, section: "caisse" },
  { labelFr: "Clients", labelAr: "العملاء", href: "/customers", icon: "user-check", color: colors.primary, section: "customers" },
  { labelFr: "Fournisseurs", labelAr: "الموردون", href: "/suppliers", icon: "truck", color: colors.primary, section: "suppliers" },
  { labelFr: "Employés", labelAr: "الموظفون", href: "/employees", icon: "users", color: colors.primary, section: "employees" },
  { labelFr: "Tableau de bord", labelAr: "لوحة التحكم", href: "/dashboard", icon: "bar-chart-2", color: colors.primary, section: "dashboard" },
  { labelFr: "Temps Réel", labelAr: "الوقت الفعلي", href: "/realtime", icon: "activity", color: colors.primary, section: "realtime" },
  { labelFr: "Stock", labelAr: "المخزون", href: "/inventory", icon: "archive", color: colors.primary, section: "inventory" },
  { labelFr: "Présences", labelAr: "الحضور", href: "/attendance", icon: "clock", color: colors.primary, section: "attendance" },
  { labelFr: "Congés", labelAr: "الإجازات", href: "/leaves", icon: "calendar", color: colors.primary, section: "leaves" },
  { labelFr: "Comptabilité", labelAr: "المحاسبة", href: "/accounting", icon: "trending-up", color: colors.primary, section: "accounting" },
];

export default function Home() {
  const router = useRouter();
  const { t, isRTL } = useLang();
  const { isAdmin } = useMe();
  const { can, isLoaded } = usePermissions();
  const { ready } = useProtectedRoute();
  const { isFactory } = useCurrentStore();

  if (!ready || (!isAdmin && !isLoaded)) return <LoadingView />;

  const visible = MODULES.filter((m) =>
    (!m.storeKind || (m.storeKind === "factory" ? isFactory : !isFactory))
    && (isAdmin || (!m.adminOnly && can(m.section, "view"))));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.grid}>
        {visible.map((m) => (
          <Pressable
            key={m.href}
            onPress={() => router.push(m.href as never)}
            style={({ pressed }) => [
              styles.tile,
              pressed && styles.tilePressed,
            ]}
            testID={`home-tile-${m.href.replace("/", "")}`}
          >
            <View style={styles.iconBadge}>
              <Feather name={m.icon} size={21} color={colors.primary} />
            </View>
            <View style={styles.tileFooter}>
              <Text style={styles.tileLabel} numberOfLines={2}>{t(m.labelFr, m.labelAr)}</Text>
              <Feather name={isRTL ? "arrow-up-left" : "arrow-up-right"} size={15} color={colors.accent} />
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  tile: {
    width: "48.2%",
    minHeight: 112,
    borderRadius: 9,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    padding: 14,
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.045,
    shadowRadius: 4,
    elevation: 1,
  },
  tilePressed: {
    transform: [{ translateY: 3 }],
    borderBottomWidth: 2,
    shadowOpacity: 0.08,
    elevation: 1,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1E9D6",
    borderWidth: 1,
    borderColor: "#E6D7B6",
  },
  tileFooter: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  tileLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
});
