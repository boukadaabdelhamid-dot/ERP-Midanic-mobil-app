import React, { useState } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLang } from "@/contexts/lang-context";
import { Button } from "@/components/ui";
import { colors } from "@/lib/colors";
import { hasValidSupplierCoordinates } from "@/lib/supplier-distance";

export function SupplierDirectionsButton({
  latitude,
  longitude,
  compact = false,
  testID = "button-supplier-directions",
}: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  compact?: boolean;
  testID?: string;
}) {
  const { t } = useLang();
  const [opening, setOpening] = useState(false);
  const hasCoordinates = hasValidSupplierCoordinates({
    latitude: latitude ?? null,
    longitude: longitude ?? null,
  });

  async function openDirections() {
    if (!hasCoordinates || opening) return;
    setOpening(true);
    const destination = `${latitude},${longitude}`;
    const url = Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${encodeURIComponent(destination)}`
      : Platform.OS === "android"
        ? `geo:${destination}?q=${encodeURIComponent(destination)}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    try {
      await Linking.openURL(url);
    } catch {
      try {
        await Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
        );
      } catch {
        Alert.alert(t("Cartes indisponibles", "تعذر فتح الخرائط"), t("Vérifiez qu’une application de cartes est installée.", "تحقق من تثبيت تطبيق للخرائط."));
      }
    } finally {
      setOpening(false);
    }
  }

  if (!hasCoordinates) return null;
  if (!compact) {
    return (
      <Button
        label={t("Itinéraire vers le fournisseur", "الاتجاهات إلى المورد")}
        variant="secondary"
        icon={<Feather name="navigation" size={16} color={colors.primary} />}
        onPress={openDirections}
        loading={opening}
        testID={testID}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("Ouvrir l’itinéraire vers le fournisseur", "افتح الاتجاهات إلى المورد")}
      disabled={opening}
      onPress={openDirections}
      style={[styles.compactButton, opening && styles.disabled]}
      testID={testID}
    >
      <Feather name="navigation" size={12} color={colors.primary} />
      <Text style={styles.compactLabel}>{t("Itinéraire", "الاتجاهات")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compactButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#EEF2F8",
  },
  compactLabel: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  disabled: { opacity: 0.55 },
});
