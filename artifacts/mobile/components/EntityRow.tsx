import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "@/lib/colors";
import { useLang } from "@/contexts/lang-context";

export function EntityRow({
  title,
  subtitle,
  right,
  action,
  onPress,
  testID,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  action?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const { isRTL } = useLang();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        testID={testID}
        style={({ pressed }) => [styles.main, pressed && onPress ? styles.rowPressed : null]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right}
        {onPress ? <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={18} color={colors.textMuted} /> : null}
      </Pressable>
      {action ? (
        <View style={styles.actionSlot}>
          {action}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  actionSlot: { paddingHorizontal: 10 },
  rowPressed: { opacity: 0.75 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 4 },
});
