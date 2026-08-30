/**
 * Dérive un thème complet à partir de la marque d'une box.
 *
 * Toute couleur destinée à porter du texte est passée par `ensureContrast`
 * avant d'entrer dans le thème : aucune box ne peut livrer une app illisible,
 * même en choisissant un jaune fluo comme couleur de marque.
 */

import {
  AA_LARGE,
  AA_TEXT,
  contrastRatio,
  ensureContrast,
  meetsContrast,
  pickOnColor,
} from './contrast';
import type { ColorScheme, Theme, TenantBrand, ThemeColors } from './tokens';

interface SchemeBase {
  surface: string;
  surface2: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  /** Voile modal, avec alpha : jamais soumis au contrôle de contraste. */
  overlay: string;
}

/**
 * Socle neutre par schéma. Ce sont les seules couleurs littérales du produit :
 * elles vivent ici et nulle part ailleurs (règle 7 de CLAUDE.md).
 */
const SCHEME_BASE: Record<ColorScheme, SchemeBase> = {
  light: {
    surface: '#ffffff',
    surface2: '#f4f5f7',
    text: '#0f1115',
    textMuted: '#5b6472',
    border: '#dfe3e8',
    success: '#1b7f4b',
    warning: '#8a5a00',
    danger: '#c0392b',
    overlay: '#0f111599',
  },
  dark: {
    surface: '#0f1115',
    surface2: '#181c23',
    text: '#f4f5f7',
    textMuted: '#a2abb8',
    border: '#2a2f38',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#f87171',
    overlay: '#000000b3',
  },
};

/** Choisit un premier plan lisible sur `background`, en dernier recours noir ou blanc. */
function readableOn(background: string, preferred: readonly string[]): string {
  const candidate = pickOnColor(background, preferred);
  if (meetsContrast(candidate, background, AA_TEXT)) return candidate;
  return pickOnColor(background, ['#ffffff', '#000000']);
}

function buildColors(brand: TenantBrand, base: SchemeBase): ThemeColors {
  // La primaire doit rester lisible en texte sur le fond principal : c'est elle
  // qui porte les liens et les libellés d'action.
  const primaryFix = ensureContrast(brand.primary, base.surface, AA_TEXT);
  const primary = primaryFix.color;

  return {
    primary,
    onPrimary: readableOn(primary, ['#ffffff', base.text]),
    surface: base.surface,
    surface2: base.surface2,
    text: base.text,
    textMuted: ensureContrast(base.textMuted, base.surface, AA_TEXT).color,
    // Un trait de séparation est décoratif : seuil composant, pas seuil texte.
    border: ensureContrast(base.border, base.surface, AA_LARGE).color,
    success: ensureContrast(base.success, base.surface, AA_TEXT).color,
    warning: ensureContrast(base.warning, base.surface, AA_TEXT).color,
    danger: ensureContrast(base.danger, base.surface, AA_TEXT).color,
    onDanger: readableOn(ensureContrast(base.danger, base.surface, AA_TEXT).color, [
      '#ffffff',
      base.text,
    ]),
    overlay: base.overlay,
  };
}

export function buildTheme(brand: TenantBrand, scheme: ColorScheme): Theme {
  const base = SCHEME_BASE[scheme];
  const colors = buildColors(brand, base);

  return {
    scheme,
    appName: brand.appName,
    logoUrl: brand.logoUrl,
    colors,
    radius: {
      sm: Math.round(brand.radius / 2),
      md: brand.radius,
      lg: Math.round(brand.radius * 1.5),
      full: 999,
    },
    typography: { caption: 12, small: 14, body: 16, title: 20, display: 32 },
    fontFamily: brand.font,
    space: (steps: number) => steps * 4,
    // 44 pt sur iOS, 48 dp sur Android : on retient le plus exigeant des deux.
    minTouchTarget: 48,
    contrast: {
      requestedPrimary: brand.primary,
      appliedPrimary: colors.primary,
      adjusted: colors.primary !== brand.primary,
      requestedRatio: contrastRatio(brand.primary, base.surface),
      appliedRatio: contrastRatio(colors.primary, base.surface),
    },
  };
}
