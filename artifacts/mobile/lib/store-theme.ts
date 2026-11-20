import { colors } from "./colors";

export type StoreThemeSource = {
  id?: number;
  kind?: string;
  navigationColor?: string | null;
};

const FACTORY_THEME = { primary: "#29483f", accent: "#d5b47e" };

function hslTokenToHex(value: string | null | undefined): string | null {
  const match = value?.trim().match(/^(\d{1,3}(?:\.\d{1,3})?)\s+(\d{1,2})%\s+(\d{1,2})%$/);
  if (!match) return null;

  const hue = Number(match[1]);
  const saturation = Number(match[2]) / 100;
  const lightness = Number(match[3]) / 100;
  if (hue < 0 || hue > 360 || saturation < 0 || saturation > 1 || lightness < 0 || lightness > 1) {
    return null;
  }

  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12;
    const a = saturation * Math.min(lightness, 1 - lightness);
    const normalized = lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(normalized * 255).toString(16).padStart(2, "0");
  };

  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function getStoreTheme(store?: StoreThemeSource | null) {
  if (store?.kind === "factory") {
    return { ...FACTORY_THEME, isFactory: true };
  }

  // Older deployed APIs may omit navigationColor. Keep branches distinguishable
  // while using the persisted ERP color whenever the server provides it.
  const legacyColor = store?.id != null
    ? `${Number(((216 + store.id * 137.50776405003785) % 360).toFixed(3))} 52% 22%`
    : null;
  const primary = hslTokenToHex(store?.navigationColor)
    ?? hslTokenToHex(legacyColor)
    ?? colors.primary;
  return {
    primary,
    accent: primary,
    isFactory: false,
  };
}
