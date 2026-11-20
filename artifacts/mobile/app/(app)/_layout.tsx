import React from "react";
import { Drawer } from "expo-router/drawer";
import { Feather } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { DrawerActions } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import DrawerContent from "@/components/DrawerContent";
import { useLang } from "@/contexts/lang-context";
import { useStoreContext } from "@/contexts/store-context";
import type { MobileStore } from "@/contexts/store-context";
import { useMe } from "@/hooks/use-me";
import { getStoreTheme } from "@/lib/store-theme";

function MenuButton() {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
      style={{ paddingHorizontal: 14, minWidth: 52, minHeight: 48, justifyContent: "center" }}
      hitSlop={12}
    >
      <Feather name="menu" size={22} color="#fff" />
    </Pressable>
  );
}

function BrandHeader() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 42, height: 38, backgroundColor: "#F5F5F0", borderRadius: 6, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <Image source={require("../../assets/images/icon.png")} style={{ width: 36, height: 32 }} resizeMode="contain" />
      </View>
      <Text style={{ color: "#F7F5EF", fontSize: 17, fontWeight: "700" }}>Midanic ERP</Text>
    </View>
  );
}

export default function AppLayout() {
  const { t } = useLang();
  const { user } = useMe();
  const { currentStoreId, stores, setStores } = useStoreContext();
  const availableStores = (user as { stores?: MobileStore[] } | null)?.stores;
  const serverStoreId = user?.currentStoreId;
  React.useEffect(() => {
    if (availableStores?.length) {
      setStores(availableStores, currentStoreId ?? serverStoreId ?? null);
    }
  }, [availableStores, currentStoreId, setStores, serverStoreId]);
  const currentStore = stores.find((store) => store.id === currentStoreId);
  const storeTheme = getStoreTheme(currentStore);

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: storeTheme.primary, height: 58 },
        headerTintColor: "#F7F5EF",
        headerTitleStyle: { fontWeight: "700", fontSize: 17 },
        drawerType: "front",
        headerLeft: () => <MenuButton />,
      }}
    >
      <Drawer.Screen name="home" options={{ title: "Midanic" }} />
      <Drawer.Screen name="dashboard" options={{ title: t("Tableau de bord", "لوحة التحكم") }} />
      <Drawer.Screen name="mon-compte" options={{ title: t("Mon compte", "حسابي"), headerTitle: () => <BrandHeader /> }} />
      <Drawer.Screen name="orders/index" options={{ title: t("Commandes", "الطلبات") }} />
      <Drawer.Screen name="pos" options={{ title: t("Point de vente", "نقطة البيع") }} />
      <Drawer.Screen name="orders/new" options={{ title: t("Nouvelle commande", "طلب جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="orders/[id]" options={{ title: t("Commande", "الطلب") }} />
      <Drawer.Screen name="sale-orders/index" options={{ title: t("Bons de vente", "سندات البيع") }} />
      <Drawer.Screen name="online-orders/index" options={{ title: t("Commandes en ligne", "الطلبات عبر الإنترنت") }} />
      <Drawer.Screen name="retours/index" options={{ title: t("Retours", "المرتجعات") }} />
      <Drawer.Screen name="retours/new" options={{ title: t("Nouveau retour", "إنشاء مرتجع"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="retours/[id]" options={{ title: t("Détail du retour", "تفاصيل المرتجع"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="customers/index" options={{ title: t("Clients", "العملاء") }} />
      <Drawer.Screen name="customers/new" options={{ title: t("Nouveau client", "عميل جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="customers/[id]" options={{ title: t("Client", "العميل") }} />
      <Drawer.Screen name="caisse/index" options={{ title: t("Caisse", "الصندوق") }} />
      <Drawer.Screen name="caisse/[id]" options={{ title: t("Caisse", "الصندوق"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="caisse/transfers" options={{ title: t("Transferts caisse", "تحويلات الصندوق"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="caisse/transfer-new" options={{ title: t("Nouveau virement", "تحويل جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="caisse/reports" options={{ title: t("Rapports caisse", "تقارير الصندوق") }} />
      <Drawer.Screen name="products/index" options={{ title: t("Produits", "المنتجات") }} />
      <Drawer.Screen name="products/new" options={{ title: t("Nouveau produit", "منتج جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="products/[id]" options={{ title: t("Produit", "المنتج") }} />
      <Drawer.Screen name="products/[id]/edit" options={{ title: t("Modifier le produit", "تعديل المنتج"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="inventory/index" options={{ title: t("Inventaire", "الجرد") }} />
      <Drawer.Screen name="transfers/index" options={{ title: t("Transferts", "التحويلات") }} />
      <Drawer.Screen name="transfers/new" options={{ title: t("Nouveau transfert", "تحويل جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="transfers/[id]" options={{ title: t("Transfert", "التحويل") }} />
      <Drawer.Screen name="manufacturing/index" options={{ title: t("Production", "الإنتاج") }} />
      <Drawer.Screen name="alerts/index" options={{ title: t("Alertes", "التنبيهات") }} />
      <Drawer.Screen name="suppliers/index" options={{ title: t("Fournisseurs", "الموردون") }} />
      <Drawer.Screen name="suppliers/new" options={{ title: t("Nouveau fournisseur", "مورد جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="suppliers/[id]" options={{ title: t("Fournisseur", "المورد") }} />
      <Drawer.Screen name="suppliers/[id]/edit" options={{ title: t("Modifier le fournisseur", "تعديل المورد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="purchase-orders/index" options={{ title: t("Bons d'achat", "أوامر الشراء") }} />
      <Drawer.Screen name="purchase-orders/new" options={{ title: t("Nouveau bon d'achat", "أمر شراء جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="purchase-orders/[id]" options={{ title: t("Bon d'achat", "أمر الشراء") }} />
      <Drawer.Screen name="purchase-orders/[id]/edit" options={{ title: t("Modifier le bon d'achat", "تعديل أمر الشراء"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="smart-purchase/index" options={{ title: t("Achat intelligent", "الشراء الذكي") }} />
      <Drawer.Screen name="smart-purchase/suggestion-form" options={{ title: t("Nouvelle idée", "اقتراح جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="employees/index" options={{ title: t("Employés", "الموظفون") }} />
      <Drawer.Screen name="employees/new" options={{ title: t("Nouvel employé", "موظف جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="employees/[id]/edit" options={{ title: t("Modifier l'employé", "تعديل الموظف"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="attendance/index" options={{ title: t("Présence", "الحضور") }} />
      <Drawer.Screen name="attendance/new" options={{ title: t("Pointage", "تسجيل الحضور"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="leaves/index" options={{ title: t("Congés", "الإجازات") }} />
      <Drawer.Screen name="leaves/new" options={{ title: t("Nouvelle demande de congé", "طلب إجازة جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="accounting/index" options={{ title: t("Comptabilité", "المحاسبة") }} />
      <Drawer.Screen name="accounting/transaction-new" options={{ title: t("Nouvelle transaction", "معاملة جديدة"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="reports/index" options={{ title: t("Rapports", "التقارير") }} />
      <Drawer.Screen name="realtime/index" options={{ title: t("Temps réel", "الوقت الفعلي") }} />
      <Drawer.Screen name="stores/index" options={{ title: t("Magasins", "المتاجر") }} />
      <Drawer.Screen name="stores/new" options={{ title: t("Nouveau magasin", "متجر جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="stores/[id]/edit" options={{ title: t("Modifier le magasin", "تعديل المتجر"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="staff/index" options={{ title: t("Personnel", "فريق العمل") }} />
      <Drawer.Screen name="staff/new" options={{ title: t("Nouveau membre", "عضو جديد"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="staff/[id]" options={{ title: t("Membre du personnel", "عضو فريق العمل"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="permissions/index" options={{ title: t("Permissions", "الصلاحيات") }} />
      <Drawer.Screen name="permissions/[id]" options={{ title: t("Modifier les permissions", "تعديل الصلاحيات"), drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="settings/index" options={{ title: t("Paramètres", "الإعدادات") }} />
      <Drawer.Screen name="settings/products" options={{ title: t("Paramètres produits", "إعدادات المنتجات") }} />
      <Drawer.Screen name="settings/profile" options={{ title: t("Profil", "الملف الشخصي") }} />
      <Drawer.Screen name="settings/notifications" options={{ title: t("Notifications", "الإشعارات") }} />
      <Drawer.Screen name="settings/languages" options={{ title: t("Langues", "اللغات") }} />
      <Drawer.Screen name="settings/backup" options={{ title: t("Sauvegarde", "النسخ الاحتياطي") }} />
      <Drawer.Screen name="settings/customers" options={{ title: t("Paramètres clients", "إعدادات العملاء") }} />
      <Drawer.Screen name="settings/web-store" options={{ title: t("Boutique en ligne", "المتجر الإلكتروني") }} />
    </Drawer>
  );
}
