import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useGetSuppliers, getGetSuppliersQueryKey } from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { ListScreen, SearchBar } from "@/components/ListScreen";
import { EntityRow } from "@/components/EntityRow";
import { Badge } from "@/components/ui";
import { Fab } from "@/components/Fab";
import { getContactBalance } from "@/lib/contact-balance";
import { colors } from "@/lib/colors";

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
  const [locationFilter, setLocationFilter] = useState<"all" | "missing">("all");
  const currency = lang === "ar" ? "دج" : "DA";

  const { data, isLoading, refetch, isRefetching } = useGetSuppliers({
    query: { enabled: ready, queryKey: getGetSuppliersQueryKey() },
  });
  const suppliers = ((data as unknown as { data?: SupplierListItem[] })?.data ?? []);
  const missingLocationCount = suppliers.filter((supplier) => !hasGps(supplier)).length;
  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase(lang === "ar" ? "ar-DZ" : "fr-FR");
    return suppliers.filter((supplier) => {
      if (locationFilter === "missing" && hasGps(supplier)) return false;
      if (!normalizedSearch) return true;
      return [
        supplier.name,
        supplier.phone,
        supplier.email,
        supplier.address,
        supplier.wilaya,
        supplier.commune,
      ].some((value) => value?.toLocaleLowerCase(lang === "ar" ? "ar-DZ" : "fr-FR").includes(normalizedSearch));
    });
  }, [lang, locationFilter, search, suppliers]);

  if (!ready) return null;
  const canCreate = isAdmin || can("suppliers", "create");
  const canEdit = isAdmin || can("suppliers", "edit");

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={filteredSuppliers}
        isLoading={isLoading}
        onRefresh={refetch}
        refreshing={isRefetching}
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
                label={`${t("Tous", "الكل")} (${suppliers.length})`}
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
  listHeader: { paddingBottom: 8 },
  filters: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginBottom: 8 },
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
