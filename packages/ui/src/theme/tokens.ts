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

/**
 * Marque de la plateforme : ce qu'on affiche quand **aucune box n'est
 * résolue** — ouverture à froid, lien non reconnu, page publique sans
 * invitation.
 *
 * **Le graphite n'est pas un choix esthétique, c'est un instrument de mesure.**
 * Cette couleur valait `#E4572E` jusqu'au 3 septembre 2026, c'est-à-dire
 * exactement la couleur de CrossFit Rueil dans `supabase/seed.sql`. Les deux
 * étaient indiscernables à l'œil, et la conséquence n'était pas cosmétique :
 * **aucun contrôle visuel du white-label ne prouvait quoi que ce soit.** « C'est
 * orange » était vrai que le thème du tenant ait été résolu ou non, donc un
 * défaut de résolution passait inaperçu. C'est précisément ce qui est arrivé à
 * l'écran de bienvenue, resté à la marque par défaut pendant tout le parcours
 * d'invitation sans que personne le voie.
 *
 * Trois états doivent rester distinguables d'un coup d'œil :
 *
 * | État | Couleur | Ce qu'il dit |
 * | --- | --- | --- |
 * | plateforme, aucune box résolue | `#1F2933` graphite | « je ne sais pas de quelle box il s'agit » |
 * | box neuve, non configurée | `#4A5568` ardoise (défaut de `themes.primary_color`) | « cette box, qui n'a pas encore choisi » |
 * | box configurée | la sienne | « cette box-là » |
 *
 * `default-brand.test.ts` relit le seed et les migrations et échoue si l'un de
 * ces trois-là en rejoint un autre.
 */
export const DEFAULT_BRAND: TenantBrand = {
  appName: 'Rack',
  logoUrl: null,
  primary: '#1F2933',
  radius: 16,
  font: 'Inter',
};
