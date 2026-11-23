import { DevSettings, Platform } from "react-native";
import { useLang, type ErpLang } from "@/contexts/lang-context";
import { useConfirm } from "@/contexts/confirm-context";

/**
 * Shared language-switch behavior for every language toggle in the app
 * (login screen, drawer footer, settings). Persists the choice and asks for a
 * restart only when switching to or from Arabic changes the native RTL layout.
 */
export function useLanguageSwitch() {
  const { lang, setLang } = useLang();
  const { confirm } = useConfirm();
  const nextLanguage: ErpLang = lang === "fr" ? "ar" : lang === "ar" ? "en" : "fr";

  const selectLanguage = async (next: ErpLang) => {
    if (next === lang) return;
    setLang(next);

    const directionChanges = (lang === "ar") !== (next === "ar");
    if (!directionChanges) return;

    const shouldReload = await confirm({
      title: "Redémarrer l'application ?",
      titleAr: "إعادة تشغيل التطبيق؟",
      message: "Le sens de lecture change. Redémarrer maintenant pour appliquer le changement.",
      messageAr: "يتغير اتجاه الواجهة. أعد التشغيل الآن لتطبيق التغيير.",
      confirmLabel: "Redémarrer",
      confirmLabelAr: "إعادة التشغيل",
      cancelLabel: "Plus tard",
      cancelLabelAr: "لاحقاً",
    });

    if (!shouldReload) return;

    if (__DEV__ && typeof DevSettings?.reload === "function") {
      DevSettings.reload();
    } else if (Platform.OS === "web") {
      (globalThis as unknown as { location?: { reload: () => void } }).location?.reload();
    }
    // In a standalone production build there is no in-JS reload API; the
    // mirrored layout applies the next time the app is launched.
  };

  return { toggleLanguage: () => selectLanguage(nextLanguage), selectLanguage };
}
