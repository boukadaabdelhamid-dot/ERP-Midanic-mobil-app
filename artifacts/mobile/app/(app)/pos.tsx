import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminOrdersQueryKey,
  getGetErpCustomersQueryKey,
  getGetProductsQueryKey,
  type CustomerSummary,
  type Product,
  useCreateOrder,
  useGetErpCustomers,
  useGetProducts,
} from "@workspace/api-client-react";
import { Card, Button, Divider, EmptyState, ErrorState, FormField, LoadingView, SectionTitle } from "@/components/ui";
import { PickerField } from "@/components/Picker";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useApiFeedback } from "@/hooks/use-api-feedback";
import { useLang } from "@/contexts/lang-context";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { colors } from "@/lib/colors";
import { getActiveBaseUrl } from "@/lib/api";
import { getToken } from "@/lib/auth-storage";
import { useStoreContext } from "@/contexts/store-context";

type CartLine = { product: Product; quantity: number };
type ExtraBarcode = { barcode: string; productId: number };
type ScanStatus = {
  code: string;
  kind: "searching" | "found" | "notFound" | "outOfStock" | "error";
};

export default function PosScreen() {
  const { ready, isAdmin, can } = useProtectedRoute({ section: "orders" });
  const { t, lang, isRTL } = useLang();
  const { currentStoreId } = useStoreContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const feedback = useApiFeedback();
  const [cameraPermission, requestCameraPermission, refreshCameraPermission] = useCameraPermissions();
  const currency = lang === "ar" ? "دج" : "DA";

  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanLookupCode, setScanLookupCode] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [requestingCameraPermission, setRequestingCameraPermission] = useState(false);
  const scanHandled = useRef(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [paymentMode, setPaymentMode] = useState<"comptant" | "terme">("comptant");
  const [versement, setVersement] = useState("");

  useEffect(() => {
    if (!scannerOpen || Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshCameraPermission()
          .then((permission) => {
            if (permission.granted) setCameraError(null);
          })
          .catch(() => {
            setCameraError(t("Could not check camera access. Try again.", "تعذر التحقق من إذن الكاميرا. حاول مرة أخرى."));
          });
      }
    });
    return () => subscription.remove();
  }, [refreshCameraPermission, scannerOpen, t]);

  const productsParams = { limit: 9999 };
  const { data: productsData, isLoading: productsLoading } = useGetProducts(productsParams, {
    query: { enabled: ready, queryKey: getGetProductsQueryKey(productsParams) },
  });
  const products = ((productsData as { products?: Product[] } | undefined)?.products ?? []).filter((p) => p.stock > 0);

  const extraBarcodesQuery = useQuery<ExtraBarcode[]>({
    queryKey: ["pos-extra-barcodes", currentStoreId],
    queryFn: async () => {
      const response = await fetch(`${getActiveBaseUrl()}/api/erp/products/extra-barcodes`, {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (!response.ok) throw new Error(`Barcode lookup failed (${response.status})`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error("Invalid extra barcode response");
      return rows as ExtraBarcode[];
    },
    enabled: ready,
    staleTime: 60_000,
  });
  const extraBarcodeByProduct = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const item of extraBarcodesQuery.data ?? []) {
      const codes = map.get(item.productId) ?? [];
      codes.push(item.barcode);
      map.set(item.productId, codes);
    }
    return map;
  }, [extraBarcodesQuery.data]);
  const extraBarcodeProductIds = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of extraBarcodesQuery.data ?? []) {
      map.set(item.barcode.trim().toLowerCase(), item.productId);
    }
    return map;
  }, [extraBarcodesQuery.data]);

  const scanLookupParams = { search: scanLookupCode ?? "", limit: 9999 };
  const scanLookupQuery = useGetProducts(scanLookupParams, {
    query: {
      enabled: ready && Boolean(scanLookupCode),
      queryKey: getGetProductsQueryKey(scanLookupParams),
    },
  });
  const scanLookupProducts = ((scanLookupQuery.data as { products?: Product[] } | undefined)?.products ?? []);
  const scannedProduct = useMemo(() => {
    if (!scanLookupCode) return undefined;
    const normalizedCode = scanLookupCode.trim().toLowerCase();
    const aliasProductId = extraBarcodeProductIds.get(normalizedCode);
    return scanLookupProducts.find((product) =>
      (product.barcode ?? "").trim().toLowerCase() === normalizedCode ||
      (product.reference ?? "").trim().toLowerCase() === normalizedCode ||
      product.id === aliasProductId,
    );
  }, [extraBarcodeProductIds, scanLookupCode, scanLookupProducts]);
  const visibleProducts = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    if (scannedProduct && scannedProduct.stock > 0) byId.set(scannedProduct.id, scannedProduct);
    return [...byId.values()];
  }, [products, scannedProduct]);

  const customersParams = {};
  const { data: customersData } = useGetErpCustomers(customersParams, {
    query: { enabled: ready, queryKey: getGetErpCustomersQueryKey(customersParams) },
  });
  const customers = ((customersData as unknown as { data?: CustomerSummary[] })?.data ?? []) as CustomerSummary[];

  const createOrder = useCreateOrder();
  const canCreate = isAdmin || can("orders", "create");
  const total = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0),
    [cart],
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return visibleProducts;
    return visibleProducts.filter((product) =>
      [product.nameAr, product.nameEn, product.reference, product.barcode, ...(extraBarcodeByProduct.get(product.id) ?? [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [extraBarcodeByProduct, search, visibleProducts]);

  useEffect(() => {
    if (!scanLookupCode || scanLookupQuery.isFetching) return;
    if (scanLookupQuery.isError) {
      setScanStatus({ code: scanLookupCode, kind: "error" });
      return;
    }
    if (!scanLookupQuery.isSuccess) return;
    if (!scannedProduct && extraBarcodesQuery.isLoading) return;
    if (!scannedProduct && extraBarcodesQuery.isError) {
      setScanStatus({ code: scanLookupCode, kind: "error" });
      return;
    }
    if (!scannedProduct) {
      setScanStatus({ code: scanLookupCode, kind: "notFound" });
    } else if (scannedProduct.stock <= 0) {
      setScanStatus({ code: scanLookupCode, kind: "outOfStock" });
    } else {
      setScanStatus({ code: scanLookupCode, kind: "found" });
    }
  }, [
    extraBarcodesQuery.isError,
    extraBarcodesQuery.isLoading,
    scanLookupCode,
    scanLookupQuery.isError,
    scanLookupQuery.isFetching,
    scanLookupQuery.isSuccess,
    scannedProduct,
  ]);

  if (!ready) return null;
  if (!canCreate) {
    return <ErrorState title={t("Action non autorisée", "غير مسموح بهذا الإجراء")} />;
  }

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (!existing) return [...current, { product, quantity: 1 }];
      if (existing.quantity >= product.stock) return current;
      return current.map((line) =>
        line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
      );
    });
  }

  function updateQuantity(productId: number, quantity: number) {
    setCart((current) =>
      current.map((line) => (line.product.id === productId ? { ...line, quantity } : line)),
    );
  }

  function removeProduct(productId: number) {
    setCart((current) => current.filter((line) => line.product.id !== productId));
  }

  function selectCustomer(selected: CustomerSummary) {
    setCustomer(selected);
  }

  function submitSale() {
    if (cart.length === 0) {
      feedback.error(null, "Ajoutez au moins un produit", "أضف منتجًا واحدًا على الأقل");
      return;
    }
    if (paymentMode === "terme" && !customer) {
      feedback.error(
        null,
        "Une vente à terme requiert un client sélectionné",
        "البيع الآجل يتطلب اختيار عميل",
      );
      return;
    }

    const downPayment = paymentMode === "terme" ? Math.max(0, Number(versement) || 0) : undefined;
    if (downPayment != null && downPayment > total) {
      feedback.error(null, "L'acompte ne peut pas dépasser le total", "لا يمكن أن تتجاوز الدفعة الأولى الإجمالي");
      return;
    }

    createOrder.mutate(
      {
        data: {
          customerName: customer?.name ?? t("Vente comptoir", "بيع في المتجر"),
          customerPhone: customer?.phone ?? "0000000000",
          customerAddress: customer?.address ?? t("Vente comptoir", "بيع في المتجر"),
          items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
          linkedCustomerId: customer?.id ?? null,
          paymentMode,
          versement: downPayment,
        },
      },
      {
        onSuccess: (order) => {
          feedback.success("Vente enregistrée", "تم تسجيل البيع");
          queryClient.invalidateQueries({ queryKey: getGetAdminOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey(productsParams) });
          router.replace(`/orders/${order.id}` as never);
        },
        onError: (error) => feedback.error(error),
      },
    );
  }

  function openScanner() {
    scanHandled.current = false;
    setCameraError(null);
    setScannerOpen(true);
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    const code = result.data.trim();
    if (!code || scanHandled.current) return;
    scanHandled.current = true;
    setSearch(code);
    setScanLookupCode(code);
    setScanStatus({ code, kind: "searching" });
    setScannerOpen(false);
  }

  async function askForCameraPermission() {
    setRequestingCameraPermission(true);
    setCameraError(null);
    try {
      await requestCameraPermission();
    } catch {
      setCameraError(t("Could not request camera access. Try again.", "تعذر طلب إذن الكاميرا. حاول مرة أخرى."));
    } finally {
      setRequestingCameraPermission(false);
    }
  }

  async function openDeviceSettings() {
    try {
      await Linking.openSettings();
    } catch {
      setCameraError(t("Open your device settings to enable the camera.", "افتح إعدادات الجهاز للسماح باستخدام الكاميرا."));
    }
  }

  if (scannerOpen) {
    const settingsUnavailable = Platform.OS === "web";
    const permissionBlocked = cameraPermission?.status === "denied" && !cameraPermission.canAskAgain;
    return (
      <View style={styles.scannerScreen}>
        <View style={[styles.scannerHeader, isRTL && styles.rowRTL]}>
          <Pressable
            onPress={() => setScannerOpen(false)}
            style={styles.scannerClose}
            accessibilityRole="button"
            accessibilityLabel={t("Close scanner", "إغلاق الماسح")}
            testID="pos-close-scanner"
          >
            <Feather name="x" size={23} color={colors.text} />
          </Pressable>
          <Text style={styles.scannerTitle}>{t("Scan a barcode", "مسح باركود")}</Text>
          <View style={styles.scannerHeaderSpacer} />
        </View>

        {!cameraPermission ? (
          <View style={styles.scannerMessage}>
            <LoadingView />
          </View>
        ) : cameraPermission.granted ? (
          <View style={styles.cameraPreview}>
            {cameraError ? (
              <View style={styles.scannerMessage}>
                <Feather name="alert-circle" size={32} color={colors.danger} />
                <Text style={styles.permissionMessage}>{cameraError}</Text>
              </View>
            ) : (
              <>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  autofocus={Platform.OS === "web" ? "on" : "off"}
                  active={scannerOpen}
                  barcodeScannerSettings={{
                    barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "itf14"],
                  }}
                  onBarcodeScanned={handleBarcodeScanned}
                  onMountError={({ message }) => setCameraError(message)}
                />
                <View pointerEvents="none" style={styles.scanOverlay}>
                  <View style={styles.scanFrame} />
                  <Text style={styles.scanHint} numberOfLines={2}>
                    {t(
                      "Place the barcode inside the frame; adjust distance until clear.",
                      "ضع الباركود داخل الإطار وغيّر المسافة حتى تتضح الصورة.",
                    )}
                  </Text>
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.scannerMessage}>
            <View style={styles.permissionIcon}>
              <Feather name="camera" size={28} color={colors.primary} />
            </View>
            <Text style={styles.permissionTitle}>
              {permissionBlocked
                ? t("Camera access is blocked", "تم منع الوصول إلى الكاميرا")
                : t("Camera access is needed", "يلزم السماح باستخدام الكاميرا")}
            </Text>
            <Text style={styles.permissionMessage}>
              {permissionBlocked
                ? settingsUnavailable
                  ? t("Allow camera access in your browser settings, then try again.", "اسمح بالكاميرا من إعدادات المتصفح ثم حاول مرة أخرى.")
                  : t("Enable camera access in device settings to scan barcodes.", "فعّل إذن الكاميرا من إعدادات الجهاز لمسح الباركود.")
                : t("Allow camera access to scan product barcodes.", "اسمح باستخدام الكاميرا لمسح باركود المنتجات.")}
            </Text>
            {cameraError ? <Text style={styles.cameraError}>{cameraError}</Text> : null}
            {permissionBlocked && !settingsUnavailable ? (
              <Button
                label={t("Open settings", "فتح الإعدادات")}
                onPress={openDeviceSettings}
                icon={<Feather name="settings" size={17} color="#fff" />}
                testID="pos-camera-settings"
              />
            ) : !permissionBlocked ? (
              <Button
                label={requestingCameraPermission
                  ? t("Requesting access...", "جارٍ طلب الإذن...")
                  : t("Allow camera", "السماح بالكاميرا")}
                onPress={askForCameraPermission}
                loading={requestingCameraPermission}
                icon={<Feather name="camera" size={17} color="#fff" />}
                testID="pos-camera-request-permission"
              />
            ) : null}
          </View>
        )}
      </View>
    );
  }

  function renderCart() {
    return (
      <Card style={styles.cartCard}>
        <View style={[styles.sectionHeader, isRTL && styles.rowRTL]}>
          <SectionTitle>{t("Panier", "السلة")}</SectionTitle>
          <Text style={styles.cartCount}>
            {cart.length} {t("article(s)", "منتج")}
          </Text>
        </View>
        {cart.length === 0 ? (
          <Text style={styles.muted}>{t("Touchez un produit pour l'ajouter", "اضغط على منتج لإضافته")}</Text>
        ) : (
          cart.map((line, index) => (
            <View key={line.product.id}>
              {index > 0 ? <Divider /> : null}
              <View style={[styles.cartLine, isRTL && styles.rowRTL]}>
                <View style={styles.cartInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {lang === "ar" ? line.product.nameAr : line.product.nameEn}
                  </Text>
                  <Text style={styles.productMeta}>
                    {(Number(line.product.price) * line.quantity).toLocaleString("fr-FR")} {currency}
                  </Text>
                </View>
                <QuantityStepper
                  value={line.quantity}
                  onChange={(quantity) => updateQuantity(line.product.id, quantity)}
                  max={line.product.stock}
                />
                <Pressable
                  onPress={() => removeProduct(line.product.id)}
                  hitSlop={8}
                  testID={`pos-remove-${line.product.id}`}
                >
                  <Feather name="trash-2" size={18} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          ))
        )}
        <Divider />
        <View style={[styles.totalRow, isRTL && styles.rowRTL]}>
          <Text style={styles.totalLabel}>{t("Total", "الإجمالي")}</Text>
          <Text style={styles.totalValue}>{total.toLocaleString("fr-FR")} {currency}</Text>
        </View>
      </Card>
    );
  }

  function renderCheckout() {
    return (
      <Card style={styles.checkoutCard}>
        <SectionTitle>{t("Paiement", "الدفع")}</SectionTitle>
        <View style={[styles.paymentRow, isRTL && styles.rowRTL]}>
          <Button
            label={t("Comptant", "نقدًا")}
            variant={paymentMode === "comptant" ? "primary" : "secondary"}
            onPress={() => setPaymentMode("comptant")}
            style={styles.paymentButton}
            testID="pos-payment-comptant"
          />
          <Button
            label={t("À terme", "آجل")}
            variant={paymentMode === "terme" ? "primary" : "secondary"}
            onPress={() => setPaymentMode("terme")}
            style={styles.paymentButton}
            testID="pos-payment-terme"
          />
        </View>
        {paymentMode === "terme" ? (
          <>
            <PickerField<CustomerSummary>
              label={t("Client obligatoire", "العميل مطلوب")}
              value={customer}
              items={customers}
              keyExtractor={(item) => String(item.id)}
              labelExtractor={(item) => item.name}
              subtitleExtractor={(item) => item.phone ?? undefined}
              onChange={selectCustomer}
              placeholder={t("Sélectionner un client", "اختر عميلًا")}
              searchPlaceholder={t("Rechercher un client...", "بحث عن عميل...")}
            />
            <FormField
              label={t("Acompte", "الدفعة الأولى")}
              value={versement}
              onChangeText={setVersement}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </>
        ) : null}
        <Button
          label={t("Enregistrer la vente", "تسجيل البيع")}
          onPress={submitSale}
          loading={createOrder.isPending}
          disabled={cart.length === 0}
          icon={<Feather name="check-circle" size={18} color="#fff" />}
          testID="pos-submit-sale"
        />
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.searchWrap, isRTL && styles.rowRTL]}>
        <View style={[styles.searchBar, isRTL && styles.rowRTL]}>
          <Feather name="search" size={17} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setScanLookupCode(null);
              setScanStatus(null);
            }}
            placeholder={t("Rechercher par nom, référence ou code-barres", "ابحث بالاسم أو المرجع أو الرمز الشريطي")}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            testID="pos-product-search"
          />
        </View>
        <Pressable
          onPress={openScanner}
          style={({ pressed }) => [styles.scanButton, pressed && styles.scanButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={t("Scan barcode", "مسح باركود")}
          testID="pos-open-scanner"
        >
          <Feather name="camera" size={18} color={colors.primary} />
          <Text style={styles.scanButtonText}>{t("Scan", "مسح")}</Text>
        </Pressable>
      </View>
      {scanStatus ? (
        <View
          style={[
            styles.scanStatus,
            scanStatus.kind === "found" && styles.scanStatusSuccess,
            ["notFound", "outOfStock", "error"].includes(scanStatus.kind) && styles.scanStatusError,
            isRTL && styles.rowRTL,
          ]}
          accessibilityLiveRegion="polite"
          testID="pos-scan-status"
        >
          <Feather
            name={scanStatus.kind === "found" ? "check-circle" : scanStatus.kind === "searching" ? "loader" : "alert-circle"}
            size={17}
            color={scanStatus.kind === "found" ? colors.success : ["notFound", "outOfStock", "error"].includes(scanStatus.kind) ? colors.danger : colors.textMuted}
          />
          <Text style={styles.scanStatusText}>
            {scanStatus.kind === "searching"
              ? t("Looking for the scanned barcode...", "جارٍ البحث عن الباركود...")
              : scanStatus.kind === "found"
                ? t(`Found: ${lang === "ar" ? scannedProduct?.nameAr : scannedProduct?.nameEn}. Select it below to add it.`, `تم العثور على: ${lang === "ar" ? scannedProduct?.nameAr : scannedProduct?.nameEn}. اختره أدناه لإضافته.`, `Found: ${scannedProduct?.nameEn}. Select it below to add it.`)
                : scanStatus.kind === "notFound"
                  ? t(`No product found for barcode ${scanStatus.code}.`, `لم يُعثر على منتج بالباركود ${scanStatus.code}.`, `No product found for barcode ${scanStatus.code}.`)
                  : scanStatus.kind === "outOfStock"
                    ? t("This product is out of stock.", "هذا المنتج غير متوفر في المخزون.")
                    : t("Could not check this barcode. Use product search or try again.", "تعذر التحقق من الباركود. استخدم البحث أو حاول مرة أخرى.")}
          </Text>
        </View>
      ) : null}
      <FlatList
        data={filteredProducts}
        keyExtractor={(product) => String(product.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {renderCart()}
            {renderCheckout()}
            <Text style={styles.productsHeading}>{t("Produits disponibles", "المنتجات المتاحة")}</Text>
          </View>
        }
        ListEmptyComponent={
          productsLoading ? <LoadingView /> : <EmptyState title={t("Aucun produit trouvé", "لم يتم العثور على منتجات")} />
        }
        renderItem={({ item: product }) => (
          <Pressable
            onPress={() => addProduct(product)}
            style={({ pressed }) => [styles.productRow, pressed && styles.productRowPressed]}
            testID={`pos-product-${product.id}`}
          >
            <View style={styles.productIcon}>
              <Feather name="package" size={19} color={colors.primary} />
            </View>
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={1}>
                {lang === "ar" ? product.nameAr : product.nameEn}
              </Text>
              <Text style={styles.productMeta} numberOfLines={1}>
                {product.reference ?? product.barcode ?? t("Sans référence", "بدون مرجع")}
              </Text>
            </View>
            <View style={styles.productPrice}>
              <Text style={styles.priceText}>{Number(product.price).toLocaleString("fr-FR")} {currency}</Text>
              <Text style={styles.stockText}>{t("Stock", "المخزون")}: {product.stock}</Text>
            </View>
            <Feather name="plus-circle" size={22} color={colors.primary} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    paddingTop: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    marginVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  scanButton: {
    minHeight: 48,
    minWidth: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  scanButtonPressed: { backgroundColor: "#F1E9D6", borderColor: colors.accent },
  scanButtonText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  scanStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  scanStatusSuccess: { borderColor: colors.success, backgroundColor: "#EFF6F1" },
  scanStatusError: { borderColor: colors.danger, backgroundColor: "#FBF0EF" },
  scanStatusText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18 },
  scannerScreen: { flex: 1, backgroundColor: colors.background },
  scannerHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scannerClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scannerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "700" },
  scannerHeaderSpacer: { width: 40 },
  cameraPreview: { flex: 1, position: "relative", backgroundColor: colors.primary },
  scanOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18, 31, 58, 0.16)",
  },
  scanFrame: {
    width: "78%",
    height: 190,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 14,
    backgroundColor: "transparent",
  },
  scanHint: {
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: "hidden",
    borderRadius: 18,
    color: "#FFFFFF",
    backgroundColor: "rgba(18, 31, 58, 0.72)",
    fontSize: 14,
    fontWeight: "600",
  },
  scannerMessage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  permissionIcon: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    backgroundColor: "#F1E9D6",
  },
  permissionTitle: { color: colors.text, fontSize: 19, fontWeight: "700", textAlign: "center" },
  permissionMessage: { maxWidth: 340, color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  cameraError: { color: colors.danger, fontSize: 13, textAlign: "center" },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 12 },
  listContent: { paddingHorizontal: 16, paddingBottom: 36 },
  cartCard: { marginBottom: 12, borderTopWidth: 2, borderTopColor: colors.accent },
  checkoutCard: { marginBottom: 16, borderTopWidth: 2, borderTopColor: colors.accent },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowRTL: { flexDirection: "row-reverse" },
  cartCount: { color: colors.textMuted, fontSize: 12 },
  muted: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
  cartLine: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 54, paddingVertical: 8 },
  cartInfo: { flex: 1 },
  productName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  productMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 7, backgroundColor: "#F1E9D6" },
  totalLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  totalValue: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  paymentRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  paymentButton: { flex: 1 },
  productsHeading: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 4, marginBottom: 10 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 72,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 11,
    marginBottom: 9,
  },
  productRowPressed: { backgroundColor: "#F1E9D6", borderColor: colors.accent },
  productIcon: {
    width: 42,
    height: 42,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1E9D6",
  },
  productDetails: { flex: 1, minWidth: 0 },
  productPrice: { alignItems: "flex-end", minWidth: 74 },
  priceText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  stockText: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});