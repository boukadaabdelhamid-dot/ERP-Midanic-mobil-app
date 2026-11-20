import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import type { Supplier } from "@workspace/api-client-react";
import { useLang } from "@/contexts/lang-context";
import { Card, Button, FormField, SectionTitle } from "@/components/ui";
import { colors } from "@/lib/colors";

export type SupplierFormValues = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  wilaya: string;
  commune: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyMeters: number | null;
  locationCapturedAt: string | null;
  notes: string;
  contactType: "supplier" | "customer_supplier";
};

export function emptySupplierForm(): SupplierFormValues {
  return {
    name: "", contactName: "", email: "", phone: "", address: "",
    wilaya: "", commune: "", latitude: null, longitude: null,
    locationAccuracyMeters: null, locationCapturedAt: null, notes: "", contactType: "supplier",
  };
}

export function supplierToForm(s: Supplier & {
  locationAccuracyMeters?: number | null;
  locationCapturedAt?: string | null;
}): SupplierFormValues {
  return {
    name: s.name ?? "",
    contactName: s.contactName ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    address: s.address ?? "",
    wilaya: s.wilaya ?? "",
    commune: s.commune ?? "",
    latitude: s.latitude ?? null,
    longitude: s.longitude ?? null,
    locationAccuracyMeters: s.locationAccuracyMeters ?? null,
    locationCapturedAt: s.locationCapturedAt ?? null,
    notes: s.notes ?? "",
    contactType: s.contactType === "customer_supplier" ? "customer_supplier" : "supplier",
  };
}

/** Shared create/edit supplier form, mirroring the web ERP's supplier dialog. */
export function SupplierForm({
  values,
  onChange,
  onSubmit,
  submitting,
  submitLabel,
}: {
  values: SupplierFormValues;
  onChange: (next: SupplierFormValues) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const { t, lang } = useLang();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locationPermission, requestLocationPermission, refreshLocationPermission] =
    Location.useForegroundPermissions();
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationMessageTone, setLocationMessageTone] = useState<"success" | "warning" | "error">("success");
  const latestValues = useRef(values);
  latestValues.current = values;
  const locationBlocked = locationPermission?.status === "denied" && !locationPermission.canAskAgain;
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    if (isWeb) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshLocationPermission().catch(() => {});
    });
    return () => subscription.remove();
  }, [isWeb, refreshLocationPermission]);

  function set<K extends keyof SupplierFormValues>(key: K, v: SupplierFormValues[K]) {
    onChange({ ...values, [key]: v });
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = t("Requis", "مطلوب");
    if (!values.wilaya.trim()) next.wilaya = t("Wilaya requise", "الولاية مطلوبة");
    if (!values.commune.trim()) next.commune = t("Commune requise", "البلدية مطلوبة");
    if (values.contactType === "customer_supplier" && !values.email.trim()) {
      next.email = t("Email requis pour un client/fournisseur", "البريد الإلكتروني مطلوب");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function fillFromCurrentLocation() {
    if (isWeb) return;
    setLocationMessage(null);
    setIsLocating(true);
    let positionTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      let permission = locationPermission;
      if (!permission?.granted) permission = await requestLocationPermission();
      if (!permission.granted) {
        setLocationMessageTone("error");
        setLocationMessage(
          t("Autorisez la localisation ou saisissez l’adresse manuellement.", "اسمح بالوصول إلى الموقع أو أدخل العنوان يدوياً."),
        );
        return;
      }

      if (!(await Location.hasServicesEnabledAsync())) {
        if (Platform.OS === "android") {
          await Location.enableNetworkProviderAsync();
        } else {
          setLocationMessageTone("error");
          setLocationMessage(t("Activez le service de localisation dans les réglages du téléphone.", "فعّل خدمة الموقع من إعدادات الهاتف ثم أعد المحاولة."));
          return;
        }
        if (!(await Location.hasServicesEnabledAsync())) {
          setLocationMessageTone("error");
          setLocationMessage(t("Activez le service de localisation dans les réglages du téléphone.", "فعّل خدمة الموقع من إعدادات الهاتف ثم أعد المحاولة."));
          return;
        }
      }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => {
          positionTimeout = setTimeout(() => reject(new Error("LOCATION_READ_TIMEOUT")), 30_000);
        }),
      ]);
      let address: Location.LocationGeocodedAddress | null = null;
      try {
        address = (await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }))[0] ?? null;
      } catch {
        // Coordinates remain useful for navigation even when address lookup fails.
      }
      const wilaya = address?.region?.trim() ?? "";
      const commune = address?.city?.trim() || "";
      const locationAccuracyMeters = Number.isFinite(position.coords.accuracy)
        ? position.coords.accuracy
        : null;
      const capturedAt = new Date(Number.isFinite(position.timestamp) ? position.timestamp : Date.now()).toISOString();

      onChange({
        ...latestValues.current,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        locationAccuracyMeters,
        locationCapturedAt: capturedAt,
        wilaya: wilaya || latestValues.current.wilaya,
        commune: commune || latestValues.current.commune,
      });
      setErrors((current) => {
        const next = { ...current };
        if (wilaya) delete next.wilaya;
        if (commune) delete next.commune;
        return next;
      });
      setLocationMessageTone(wilaya && commune ? "success" : "warning");
      setLocationMessage(
        wilaya && commune
          ? t("GPS enregistré. Vérifiez la précision et les valeurs avant d’enregistrer.", "تم حفظ إحداثيات GPS. راجع الدقة والقيم قبل الحفظ.")
          : t("GPS enregistré, mais l’adresse est incomplète. Complétez les champs.", "تم حفظ إحداثيات GPS، لكن العنوان غير مكتمل. أكمل الحقول يدوياً."),
      );
    } catch (error) {
      setLocationMessageTone("error");
      setLocationMessage(error instanceof Error && error.message === "LOCATION_READ_TIMEOUT"
        ? t("La recherche GPS prend trop de temps. Réessayez à l’extérieur ou saisissez le lieu manuellement.", "استغرق تحديد الموقع وقتًا طويلاً. أعد المحاولة في مكان مفتوح أو أدخل المكان يدوياً.")
        : t("Impossible de déterminer la position. Saisissez le lieu manuellement.", "تعذر تحديد الموقع. أدخل الولاية والبلدية يدوياً."));
    } finally {
      if (positionTimeout) clearTimeout(positionTimeout);
      setIsLocating(false);
    }
  }

  async function openLocationSettings() {
    if (Platform.OS === "web") return;
    try {
      await Linking.openSettings();
    } catch {
      setLocationMessageTone("error");
      setLocationMessage(t("Ouvrez les réglages du téléphone pour autoriser la localisation.", "افتح إعدادات الهاتف للسماح باستخدام الموقع."));
    }
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit();
  }

  return (
    <View>
      <Card>
        <SectionTitle>{t("Type de contact", "نوع الاتصال")}</SectionTitle>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            label={t("Fournisseur", "مورد")}
            variant={values.contactType === "supplier" ? "primary" : "secondary"}
            onPress={() => set("contactType", "supplier")}
            style={{ flex: 1 }}
          />
          <Button
            label={t("Client + fournisseur", "عميل + مورد")}
            variant={values.contactType === "customer_supplier" ? "primary" : "secondary"}
            onPress={() => set("contactType", "customer_supplier")}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <Card>
        <SectionTitle>{t("Coordonnées", "معلومات الاتصال")}</SectionTitle>
        <FormField label={t("Nom", "الاسم")} value={values.name} onChangeText={(v) => set("name", v)} error={errors.name} />
        <FormField label={t("Personne à contacter", "شخص الاتصال")} value={values.contactName} onChangeText={(v) => set("contactName", v)} />
        <FormField label={t("Email", "البريد الإلكتروني")} value={values.email} onChangeText={(v) => set("email", v)} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
        <FormField label={t("Téléphone", "الهاتف")} value={values.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />
        <FormField label={t("Adresse", "العنوان")} value={values.address} onChangeText={(v) => set("address", v)} />
        <Button
          label={
            isWeb
              ? t("Disponible dans l’application mobile", "متاح في تطبيق الهاتف")
              : locationBlocked
                ? t("Ouvrir les réglages", "فتح الإعدادات")
                : t("Utiliser ma position", "استخدم موقعي")
          }
          onPress={locationBlocked ? openLocationSettings : fillFromCurrentLocation}
          variant="secondary"
          icon={<Feather name={locationBlocked ? "settings" : "map-pin"} size={16} color={colors.primary} />}
          loading={isLocating}
          disabled={isWeb}
          testID="button-supplier-use-location"
        />
        {locationMessage ? (
          <Text style={{
            marginTop: 8,
            marginBottom: 10,
            color: locationMessageTone === "error" ? colors.danger
              : locationMessageTone === "warning" ? colors.warning : colors.success,
            fontSize: 12,
          }}>
            {locationMessage}
          </Text>
        ) : isWeb ? (
          <Text style={{ marginTop: 8, marginBottom: 10, color: colors.textMuted, fontSize: 12 }}>
            {t("Utilisez l’application installée sur le téléphone pour détecter la position.", "استخدم التطبيق المثبت على الهاتف لتحديد الموقع.")}
          </Text>
        ) : (
          <Text style={{ marginTop: 8, marginBottom: 10, color: colors.textMuted, fontSize: 12 }}>
            {t("À utiliser lorsque vous êtes chez le fournisseur. Vérifiez les valeurs avant de sauvegarder.", "استخدمه عندما تكون لدى المورد. راجع القيم قبل الحفظ.")}
          </Text>
        )}
        {values.locationCapturedAt ? (
          <Text style={{ marginTop: 4, marginBottom: 10, color: colors.textMuted, fontSize: 12 }}>
            {values.locationAccuracyMeters != null
              ? `± ${Math.round(values.locationAccuracyMeters)} m · `
              : ""}
            {new Date(values.locationCapturedAt).toLocaleString(lang === "ar" ? "ar-DZ" : "fr-FR")}
          </Text>
        ) : null}
        <FormField
          label={t("Wilaya *", "الولاية *")}
          value={values.wilaya}
          onChangeText={(v) => set("wilaya", v)}
          placeholder={t("Saisissez la wilaya", "اكتب الولاية")}
          error={errors.wilaya}
        />
        <FormField
          label={t("Commune *", "البلدية *")}
          value={values.commune}
          onChangeText={(v) => set("commune", v)}
          placeholder={t("Saisissez la commune", "اكتب البلدية")}
          error={errors.commune}
        />
        <FormField label={t("Notes", "ملاحظات")} value={values.notes} onChangeText={(v) => set("notes", v)} multiline />
      </Card>

      <Button label={submitLabel} onPress={handleSubmit} loading={submitting} disabled={isLocating} testID="button-submit-supplier" />
    </View>
  );
}
