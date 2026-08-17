import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
  Image,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from "react-native";
import { colors } from "@/lib/colors";

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = "primary", disabled, loading, testID, icon, style }: ButtonProps) {
  const bg =
    variant === "primary" ? colors.primary
    : variant === "danger" ? colors.danger
    : variant === "secondary" ? colors.surface
    : "transparent";
  const textColor = variant === "secondary" || variant === "ghost" ? colors.primary : "#fff";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "secondary" && styles.buttonOutline,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Row style={{ gap: 6, justifyContent: "center" }}>
          {icon}
          <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
        </Row>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Form field
// ---------------------------------------------------------------------------

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  editable = true,
  error,
  autoCapitalize = "sentences",
  autoCorrect = true,
  autoComplete,
  rightAccessory,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad" | "decimal-pad";
  multiline?: boolean;
  editable?: boolean;
  error?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  autoComplete?: "email" | "password" | "username" | "off";
  rightAccessory?: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          rightAccessory ? styles.inputWrapper : null,
          rightAccessory && error ? { borderColor: colors.danger } : null,
          rightAccessory && !editable ? { backgroundColor: colors.background } : null,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          editable={editable}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          style={[
            styles.input,
            rightAccessory ? styles.inputWithAccessory : null,
            multiline && { height: 90, textAlignVertical: "top" },
            !rightAccessory && error ? { borderColor: colors.danger } : null,
            !rightAccessory && !editable ? { backgroundColor: colors.background } : null,
            !editable && { color: colors.textMuted },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null,
          ]}
        />
        {rightAccessory}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

const BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  default: { bg: "#EEF2F7", fg: colors.primary },
  success: { bg: "#DCFCE7", fg: "#15803D" },
  warning: { bg: "#FEF3C7", fg: "#B45309" },
  danger: { bg: "#FEE2E2", fg: "#B91C1C" },
  info: { bg: "#DBEAFE", fg: "#1D4ED8" },
  muted: { bg: "#F1F5F9", fg: colors.textMuted },
};

export function Badge({ label, tone = "default" }: { label: string; tone?: keyof typeof BADGE_COLORS }) {
  const c = BADGE_COLORS[tone] ?? BADGE_COLORS.default;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Loading / empty states
// ---------------------------------------------------------------------------

export function LoadingView({ label }: { label?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.centered}>
      <Animated.View
        style={{
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        }}
      >
        <Image source={require("../assets/images/icon.png")} style={styles.loadingLogo} resizeMode="contain" />
      </Animated.View>
      {label ? <Text style={styles.mutedText}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.mutedText}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.centered}>
      <Text style={[styles.emptyTitle, { color: colors.danger }]}>{title}</Text>
      {subtitle ? <Text style={styles.mutedText}>{subtitle}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function ScreenTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.screenTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", alignItems: "center" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonOutline: { borderWidth: 1, borderColor: colors.primary },
  buttonText: { fontWeight: "600", fontSize: 15 },
  fieldLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  inputWithAccessory: { borderWidth: 0, flex: 1 },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 6 },
  loadingLogo: { width: 58, height: 58, borderRadius: 14 },
  mutedText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.text, textAlign: "center" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  screenTitle: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 4 },
});
