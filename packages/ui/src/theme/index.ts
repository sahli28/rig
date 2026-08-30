/**
 * Point d'entrée `@rig/ui/theme` — sans dépendance plateforme.
 * Importable depuis Next comme depuis Expo.
 */

export {
  parseHex,
  toHex,
  rgbToHsl,
  hslToRgb,
  relativeLuminance,
  withLightness,
  type Rgb,
  type Hsl,
} from './color';

export {
  AA_TEXT,
  AA_LARGE,
  contrastRatio,
  meetsContrast,
  pickOnColor,
  ensureContrast,
  type ContrastFix,
} from './contrast';

export { buildTheme } from './build-theme';
export { ThemeProvider, useTheme, type ThemeProviderProps } from './theme-provider';
export { themeToCssVars, themeToCssRule } from './css-vars';

export {
  DEFAULT_BRAND,
  type ColorScheme,
  type TenantBrand,
  type Theme,
  type ThemeColors,
  type ThemeRadius,
  type ThemeTypography,
  type ThemeContrastReport,
} from './tokens';
