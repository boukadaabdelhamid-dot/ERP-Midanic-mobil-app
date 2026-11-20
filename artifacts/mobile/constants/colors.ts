/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#121F3A',
    tint: '#1B3057',

    // Core surfaces
    background: '#F5F5F0',
    foreground: '#121F3A',

    // Cards / elevated surfaces
    card: '#FFFEFC',
    cardForeground: '#121F3A',

    // Primary action color (buttons, links, active states)
    primary: '#1B3057',
    primaryForeground: '#F5F5F0',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E9E9E1',
    secondaryForeground: '#121F3A',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EDEDE7',
    mutedForeground: '#5D687A',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#F1E9D6',
    accentForeground: '#76591F',

    // Destructive actions (delete, error states)
    destructive: '#C94B45',
    destructiveForeground: '#FFFEFC',

    // Borders and input outlines
    border: '#DCDCD2',
    input: '#DCDCD2',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 6,
};

export default colors;
