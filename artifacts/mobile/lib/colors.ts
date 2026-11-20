export const colors = {
  primary: "#1B3057",
  primaryLight: "#2C4A7C",
  accent: "#C9A24B",
  background: "#F5F5F0",
  surface: "#FFFEFC",
  border: "#DCDCD2",
  text: "#121F3A",
  textMuted: "#5D687A",
  danger: "#C94B45",
  success: "#36765C",
  warning: "#A87524",
  info: "#496B91",
} as const;

export function useColors() {
  return colors;
}
