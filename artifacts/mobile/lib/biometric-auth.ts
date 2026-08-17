import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_ENABLED_KEY = "midanic_erp_biometric_enabled";

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  return LocalAuthentication.isEnrolledAsync();
}

export async function getBiometricEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === "true";
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS === "web") return;
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
  } else {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  }
}

export async function authenticateWithBiometric(): Promise<boolean> {
  if (!(await isBiometricAvailable())) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Déverrouiller Midanic",
    cancelLabel: "Annuler",
    fallbackLabel: "Utiliser le mot de passe",
    disableDeviceFallback: false,
  });
  return result.success;
}