import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useServer } from "@/contexts/server-context";
import { useLang } from "@/contexts/lang-context";
import { colors } from "@/lib/colors";
import { Button, FormField } from "@/components/ui";

/** Convert a company domain into its HTTPS origin, without an API path. */
function normaliseCompanyDomain(raw: string): string | null {
  const value = raw.trim().replace(/\/+$/, "");
  if (!value) return null;

  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    const isLocalDevelopmentHost = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (
      !url.hostname ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" && !(isLocalDevelopmentHost && url.protocol === "http:"))
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/** Verify that this company ERP API is reachable. */
async function pingServer(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${url}/api/healthz`, {
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export default function ServerSetup() {
  const router = useRouter();
  const { setServerUrl } = useServer();
  const { t } = useLang();

  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const onConnect = async () => {
    setError(null);
    const url = normaliseCompanyDomain(urlInput);
    if (!url) {
      setError(
        t(
          "Saisissez un domaine valide, par exemple platino.midanic.com.",
          "أدخل نطاقاً صحيحاً، مثال: platino.midanic.com.",
        ),
      );
      return;
    }

    setChecking(true);
    const reachable = await pingServer(url);
    setChecking(false);

    if (!reachable) {
      setError(
        t(
          "Impossible de joindre l'ERP de cette entreprise. Vérifiez le domaine et votre connexion.",
          "تعذّر الوصول إلى ERP الشركة. تحقق من النطاق واتصالك بالإنترنت.",
        ),
      );
      return;
    }

    await setServerUrl(url);
    router.replace("/login");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.logo}
          resizeMode="cover"
        />
        <Text style={styles.title}>Midanic</Text>
        <Text style={styles.subtitle}>
          {t("Configurer le serveur ERP", "إعداد خادم ERP")}
        </Text>

        <Text style={styles.hint}>
          {t(
            "Saisissez le domaine de votre entreprise pour accéder à son ERP, par exemple platino.midanic.com.",
            "أدخل نطاق شركتك للاتصال بنظام ERP الخاص بها، مثال: platino.midanic.com.",
          )}
        </Text>

        <View style={{ marginTop: 16, width: "100%" }}>
          <FormField
            label={t("Domaine de l'entreprise", "نطاق الشركة")}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="platino.midanic.com"
            keyboardType="default"
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {checking ? (
            <View style={styles.checkingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.checkingText}>
                {t("Vérification en cours…", "جارٍ التحقق…")}
              </Text>
            </View>
          ) : (
            <Button
              label={t("Se connecter", "اتصال")}
              onPress={onConnect}
              loading={checking}
            />
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 26,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: colors.accent,
  },
  logo: { width: 72, height: 72, borderRadius: 16, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "700", color: colors.primary },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 16,
    textAlign: "center",
    lineHeight: 19,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 10,
    textAlign: "center",
  },
  checkingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  checkingText: { fontSize: 13, color: colors.textMuted },
});
