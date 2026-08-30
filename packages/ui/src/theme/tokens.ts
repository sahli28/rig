/**
 * Types du système de design.
 *
 * Principe : une box ne choisit pas douze couleurs, elle choisit **une marque**
 * (`TenantBrand`). Tout le reste — surfaces, textes, états, rayons, espacements —
 * en est dérivé par `buildTheme`, en clair comme en sombre. C'est ce qui rend
 * vraie la promesse « changer la primaire dans un seul objet change toute l'app ».
 */

export type ColorScheme = 'light' | 'dark';

/** Ce que la box renseigne dans ses réglages. Persisté côté tenant. */
export interface TenantBrand {
  appName: string;
  logoUrl: string | null;
  /** Couleur de marque, hexadécimal `#rgb` ou `#rrggbb`. */
  primary: string;
  /** Rayon de base, en points. Les autres rayons en sont déduits. */
  radius: number;
  /** Famille typographique. */
  font: string;
}

export interface ThemeColors {
  /** Couleur de marque, corrigée si son contraste était insuffisant. */
  primary: string;
  /** Ce qui se pose sur la primaire (texte d'un bouton plein). */
  onPrimary: string;
  /** Fond principal. */
  surface: string;
  /** Fond secondaire : cartes, champs, lignes alternées. */
  surface2: string;
  /** Texte principal. */
  text: string;
  /** Texte secondaire, toujours ≥ 4,5:1 sur `surface`. */
  textMuted: string;
  /** Traits de séparation. Décoratif : non soumis au seuil de texte. */
  border: string;
  success: string;
  warning: string;
  danger: string;
  /** Ce qui se pose sur `danger` (texte d'un bouton destructeur). */
  onDanger: string;
  /** Voile derrière une feuille modale. Hexadécimal 8 chiffres, alpha compris. */
  overlay: string;
}

export interface ThemeRadius {
  sm: number;
  md: number;
  lg: number;
  /** Pastilles et avatars. */
  full: number;
}

export interface ThemeTypography {
  /** Légendes, mentions légales. */
  caption: number;
  /** Texte secondaire. */
  small: number;
  /** Corps de texte. Plancher de lisibilité en salle. */
  body: number;
  /** Titres de section. */
  title: number;
  /** Chiffres de score, chronomètres. */
  display: number;
}

/** Diagnostic renvoyé à la box quand sa couleur a dû être corrigée. */
export interface ThemeContrastReport {
  /** Couleur telle que saisie par la box. */
  requestedPrimary: string;
  /** Couleur réellement appliquée. */
  appliedPrimary: string;
  adjusted: boolean;
  /** Ratio de la couleur saisie face au fond. */
  requestedRatio: number;
  /** Ratio après correction. */
  appliedRatio: number;
}

export interface Theme {
  scheme: ColorScheme;
  appName: string;
  logoUrl: string | null;
  colors: ThemeColors;
  radius: ThemeRadius;
  typography: ThemeTypography;
  fontFamily: string;
  /** Échelle de 4 pt : `space(3)` vaut 12. */
  space: (steps: number) => number;
  /** Plancher de cible tactile, en points. iOS 44, Android 48 : on prend 48. */
  minTouchTarget: number;
  contrast: ThemeContrastReport;
}

/** Marque par défaut de la plateforme, avant qu'une box n'ait configuré la sienne. */
export const DEFAULT_BRAND: TenantBrand = {
  appName: 'RIG',
  logoUrl: null,
  primary: '#E4572E',
  radius: 16,
  font: 'Inter',
};
