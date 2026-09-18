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
  surface3: string;
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
 * Socle neutre par schéma — **chaud** depuis P2-021 (direction « Craie & acier ») :
 * noir brun et papier ivoire. La chaleur vient d'ici, jamais de la primaire, qui
 * appartient à la box.
 * Ce sont les seules couleurs littérales du produit :
 * elles vivent ici et nulle part ailleurs (règle 7 de CLAUDE.md).
 */
const SCHEME_BASE: Record<ColorScheme, SchemeBase> = {
  light: {
    surface: '#f8f5f0',
    surface2: '#ffffff',
    surface3: '#efeae2',
    text: '#16140f',
    textMuted: '#625c52',
    border: '#e2dbd0',
    success: '#1b7f4b',
    warning: '#8a5a00',
    danger: '#b93226',
    overlay: '#16140f99',
  },
  dark: {
    surface: '#11100f',
    surface2: '#1b1a18',
    surface3: '#262421',
    text: '#f6f3ef',
    textMuted: '#aaa49b',
    border: '#33302c',
    success: '#56d68b',
    warning: '#f5c04a',
    danger: '#f98080',
    overlay: '#000000b3',
  },
};

/**
 * Ce qui se pose sur une image. **Hors schéma** : le voile est sombre en clair
 * comme en sombre, donc le texte qu'il porte est clair dans les deux.
 */
const ON_IMAGE = { scrim: '#0c0b0a', onImage: '#ffffff', onImageMuted: '#d9d5cf' };

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
    surface3: base.surface3,
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
    ...ON_IMAGE,
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
    motion: { fast: 120, base: 220 },
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
