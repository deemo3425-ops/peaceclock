/**
 * Design tokens mirrored from apps/web/app/globals.css (:root CSS variables).
 * Keep in sync when the web palette changes (M6·T0.3 design-system parity).
 */
export const colors = {
  /** --bg */
  bg: '#0b0d10',
  /** --panel */
  panel: '#14181d',
  /** --fg */
  fg: '#e7ecf1',
  /** --muted */
  muted: '#9aa7b4',
  /** --line */
  line: '#283139',
  /** --accent */
  accent: '#6db1ff',
  /** --civilian */
  civilian: '#ffd27d',
  /** --warn */
  warn: '#ff9d6b',
} as const;

/** Pin tier fills from .pin--* classes in globals.css */
export const pinTier = {
  official: '#5ad17f',
  confirmed: colors.accent,
  osint: colors.civilian,
  aiCorroborated: colors.warn,
} as const;

/** Backdrop gradient stops from .backdrop__frame */
export const backdrop = {
  gradientStart: '#18222c',
  gradientEnd: '#0e1318',
} as const;

export const typography = {
  /** html, body font stack (system UI on native) */
  fontFamily: 'System',
  fontSizeBase: 16,
  lineHeight: 1.5,
} as const;

export const radii = {
  control: 6,
  panel: 10,
} as const;

export type ThemeColors = typeof colors;