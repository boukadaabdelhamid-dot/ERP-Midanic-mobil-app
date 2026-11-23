import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useGetErpCustomers, getGetErpCustomersQueryKey } from "@workspace/api-client-react";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useLang } from "@/contexts/lang-context";
import { ListScreen, SearchBar } from "@/components/ListScreen";
import { EntityRow } from "@/components/EntityRow";
import { Badge, Button, ErrorState } from "@/components/ui";
import { Fab } from "@/components/Fab";
import { getContactBalance } from "@/lib/contact-balance";

export default function CustomersList() {
  const { ready, isAdmin, can } = useProtectedRoute({ section: "customers" });
  const { t, lang } = useLang();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const currency = lang === "ar" ? "دج" : "DA";

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const customersParams = { search: debouncedSearch || undefined, limit: 50 };
  const { data, isLoading, isError, refetch, isRefetching } = useGetErpCustomers(customersParams, {
    query: {
      enabled: ready,
      queryKey: getGetErpCustomersQueryKey(customersParams),
      staleTime: 90_000,
      placeholderData: (previousData) => previousData,
    },
  });
  const customers = (data as any)?.data ?? [];

  if (!ready) return null;

  const canCreate = isAdmin || can("customers", "create");
  if (isError && !data) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
        <ErrorState
          title={t("Impossible de charger les clients", "تعذر تحميل الزبائن")}
          subtitle={t("Vérifiez la connexion puis réessayez.", "تحقق من الاتصال ثم أعد المحاولة.")}
        />
        <Button
          label={t("Réessayer", "إعادة المحاولة")}
          onPress={() => { void refetch(); }}
          loading={isRefetching}
          testID="button-retry-customers"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        data={customers}
        isLoading={isLoading}
        onRefresh={refetch}
        refreshing={isRefetching}
        keyExtractor={(c: any) => String(c.id)}
        emptyTitle={t("Aucun client", "لا يوجد عملاء")}
        header={<SearchBar value={search} onChangeText={setSearch} placeholder={t("Rechercher un client...", "بحث عن عميل...")} />}
        renderItem={(c: any) => (
          <EntityRow
            onPress={() => router.push(`/customers/${c.id}` as never)}
            title={c.name}
            subtitle={c.phone ?? c.email ?? ""}
            right={(() => {
              const balance = getContactBalance(c);
              return (
                <Badge
                  label={`${t("Solde", "الرصيد")}: ${balance.toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} ${currency}`}
                  tone={balance < 0 ? "danger" : balance > 0 ? "success" : "muted"}
                />
              );
            })()}
          />
        )}
      />
      {canCreate ? (
        <Fab
          onPress={() => router.push("/customers/new" as never)}
          testID="button-new-customer"
        />
      ) : null}
    </View>
  );
}
