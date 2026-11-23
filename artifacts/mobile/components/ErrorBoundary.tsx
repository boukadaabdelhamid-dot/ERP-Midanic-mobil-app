import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { reloadAppAsync } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@/lib/colors";
import { Button } from "@/components/ui";

function ErrorFallback({ onReload }: { onReload: () => void }) {
  const [lang, setLang] = React.useState<"fr" | "ar" | "en">("fr");
  React.useEffect(() => {
    AsyncStorage.getItem("midanic_erp_lang").then((saved) => {
      if (saved === "ar" || saved === "en" || saved === "fr") setLang(saved);
    }).catch(() => {});
  }, []);
  const copy = {
    fr: { title: "Une erreur inattendue est survenue", message: "Veuillez redémarrer l'application.", button: "Redémarrer" },
    ar: { title: "حدث خطأ غير متوقع", message: "يرجى إعادة تشغيل التطبيق.", button: "إعادة التشغيل" },
    en: { title: "An unexpected error occurred", message: "Please restart the app.", button: "Restart app" },
  }[lang];
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.subtitle}>{copy.message}</Text>
      <Button label={copy.button} onPress={onReload} style={{ marginTop: 16, minWidth: 200 }} />
    </View>
  );
}

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReload={() => reloadAppAsync()} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.background },
  title: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 8, textAlign: "center" },
});
