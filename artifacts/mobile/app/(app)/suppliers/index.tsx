import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { ListScreen, SearchBar } from "@/components/ListScreen";
import { EntityRow } from "@/components/EntityRow";
import { Badge, Button, ErrorState } from "@/components/ui";
import { Fab } from "@/components/Fab";
import { getContactBalance } from "@/lib/contact-balance";
import { colors } from "@/lib/colors";
import { useSupplierDirectory } from "@/hooks/use-smart-purchase";

type SupplierListItem = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  wilaya?: string | null;
  commune?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export default function SuppliersList() {
  const { ready, isAdmin, can } = useProtectedRoute({ section: "suppliers" });
  const { t, lang } = useLang();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<"all" | "missing">("all");
  const currency = lang === "ar" ? "دج" : "DA";

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const suppliersQuery = useSupplierDirectory({
    enabled: ready,
    search: debouncedSearch,
    missingLocation: locationFilter === "missing",
  });
  const pages = suppliersQuery.data?.pages;
  const suppliers = useMemo(
    () => pages?.flatMap((page) => page.data) ?? [],
    [pages],
  );
  const total = pages?.[0]?.total ?? 0;
  const missingLocationCount = pages?.[0]?.missingLocationTotal ?? 0;

  if (!ready) return null;
  const canCreate = isAdmin || can("suppliers", "create");
  const canEdit = isAdmin || can("suppliers", "edit");
  if (suppliersQuery.isError && !suppliersQuery.data) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState
          title={t("Impossible de charger les fournisseurs", "تعذر تحميل الموردين")}
          subtitle={t("Vérifiez la connexion puis réessayez.", "تحقق من الاتصال ثم أعد المحاولة.")}
        />
        <Button
          label={t("Réessayer", "إعادة المحاولة")}
          onPress={() => { void suppliersQuery.refetch(); }}
          loading={suppliersQuery.isRefetching}
          testID="button-retry-suppliers"
        />
      </View>
    );
  }

  const footer = suppliersQuery.isFetchingNextPage ? (
    <View style={styles.paginationFooter}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.footerText}>{t("Chargement...", "جارٍ تحميل المزيد...")}</Text>
    </View>
  ) : suppliersQuery.hasNextPage ? (
    <View style={styles.paginationFooter}>
      <Text style={styles.footerText}>
        {t(`${suppliers.length} sur ${total} fournisseurs`, `${suppliers.length} من ${total} مورد`, `${suppliers.length} of ${total} suppliers`)}
      </Text>
      <Button
        label={t("Afficher plus", "عرض المزيد")}
        variant="secondary"
        onPress={() => { void suppliersQuery.fetchNextPage(); }}
        testID="button-load-more-suppliers"
      />
    </View>
  ) : total > 0 ? (
    <Text style={styles.footerText}>
      {t(`Tous les fournisseurs affichés (${total})`, `تم عرض جميع الموردين (${total})`, `All ${total} suppliers are displayed`)}
    </Text>
  ) : undefined;

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={suppliers}
        isLoading={suppliersQuery.isLoading}
        onRefresh={() => { void suppliersQuery.refetch(); }}
        refreshing={suppliersQuery.isRefetching && !suppliersQuery.isFetchingNextPage}
        onEndReached={() => {
          if (suppliersQuery.hasNextPage && !suppliersQuery.isFetchingNextPage) {
            void suppliersQuery.fetchNextPage();
          }
        }}
        footer={footer}
        keyExtractor={(supplier) => String(supplier.id)}
        emptyTitle={search.trim()
          ? t("Aucun résultat", "لا توجد نتائج")
          : locationFilter === "missing"
            ? t("Aucun fournisseur sans GPS", "كل الموردين لديهم موقع GPS")
            : t("Aucun fournisseur", "لا يوجد موردون")}
        emptySubtitle={search.trim() ? t("Essayez une autre recherche.", "جرّب عبارة بحث أخرى.") : undefined}
        header={
          <View style={styles.listHeader}>
            <SearchBar value={search} onChangeText={setSearch} placeholder={t("Rechercher...", "بحث...")} />
            <View style={styles.filters}>
              <LocationFilterButton
                label={locationFilter === "all" ? `${t("Tous", "الكل")} (${total})` : t("Tous", "الكل")}
                selected={locationFilter === "all"}
                onPress={() => setLocationFilter("all")}
                testID="filter-suppliers-all"
              />
              <LocationFilterButton
                label={`${t("Sans GPS", "بلا موقع")} (${missingLocationCount})`}
                selected={locationFilter === "missing"}
                onPress={() => setLocationFilter("missing")}
                testID="filter-suppliers-missing-gps"
              />
            </View>
          </View>
        }
        renderItem={(supplier) => (
          <EntityRow
            onPress={() => router.push(`/suppliers/${supplier.id}` as never)}
            title={supplier.name}
            subtitle={supplier.phone ?? supplier.email ?? ""}
            right={
              <View style={styles.badges}>
                {!hasGps(supplier) ? (
                  <Badge label={t("Sans GPS", "دون موقع")} tone="warning" />
                ) : null}
                <Badge
                  label={`${getContactBalance(supplier).toLocaleString("fr-FR")} ${currency}`}
                  tone={getContactBalance(supplier) > 0 ? "danger" : "success"}
                />
              </View>
            }
            action={!hasGps(supplier) && canEdit ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Enregistrer la position GPS", "تسجيل موقع GPS")}
                onPress={() => router.push(`/suppliers/${supplier.id}/edit` as never)}
                testID={`button-edit-supplier-location-${supplier.id}`}
                hitSlop={8}
                style={({ pressed }) => [styles.editLocationButton, pressed && styles.editLocationPressed]}
              >
                <Feather name="edit-3" size={17} color={colors.primary} />
              </Pressable>
            ) : null}
          />
        )}
      />
      {canCreate ? <Fab onPress={() => router.push("/suppliers/new" as never)} testID="button-new-supplier" /> : null}
    </View>
  );
}

function hasGps(supplier: SupplierListItem) {
  return typeof supplier.latitude === "number"
    && Number.isFinite(supplier.latitude)
    && typeof supplier.longitude === "number"
    && Number.isFinite(supplier.longitude);
}

function LocationFilterButton({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.filterButton,
        selected && styles.filterButtonSelected,
        pressed && styles.filterButtonPressed,
      ]}
    >
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  listHeader: { paddingBottom: 8 },
  filters: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginBottom: 8 },
  paginationFooter: { paddingHorizontal: 18, paddingVertical: 16, gap: 10, alignItems: "center" },
  footerText: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 10 },
  filterButton: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterButtonSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterButtonPressed: { opacity: 0.78 },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  filterTextSelected: { color: colors.surface },
  badges: { alignItems: "flex-end", gap: 4 },
  editLocationButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: colors.background,
  },
  editLocationPressed: { opacity: 0.7 },
});
