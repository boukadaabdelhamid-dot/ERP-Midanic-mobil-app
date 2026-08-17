import { useEffect } from "react";
import { useRootNavigationState, useRouter } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/contexts/auth-context";
import { useServer } from "@/contexts/server-context";
import { LoadingView } from "@/components/ui";
import { getBiometricEnabled } from "@/lib/biometric-auth";

export default function Index() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { token, isReady: authReady } = useAuth();
  const { serverUrl, isServerReady } = useServer();

  useEffect(() => {
    if (!rootNavigationState?.key || !isServerReady || !authReady) return;

    // If no server is configured (and no env override), ask the user to set one.
    if (!serverUrl) {
      router.replace("/server-setup");
      return;
    }

    let cancelled = false;
    (async () => {
      const biometricEnabled = token ? await getBiometricEnabled() : false;
      if (cancelled) return;
      router.replace(token && biometricEnabled ? "/login" : token ? "/home" : "/login");
    })();
    return () => {
      cancelled = true;
    };
  }, [rootNavigationState?.key, isServerReady, authReady, serverUrl, token, router]);

  return (
    <View style={{ flex: 1 }}>
      <LoadingView />
    </View>
  );
}
