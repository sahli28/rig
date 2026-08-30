/**
 * Contrôle de contraste WCAG 2.2.
 *
 * Enjeu produit : une box choisit sa couleur primaire librement. Rien ne
 * l'empêche de choisir un jaune vif sur lequel du texte blanc est illisible.
 * On ne peut ni refuser sa couleur, ni livrer une app illisible : on corrige,
 * et on le lui dit.
 */

import { parseHex, relativeLuminance, rgbToHsl, hslToRgb, toHex } from './color';

/** Seuil AA pour du texte normal. */
export const AA_TEXT = 4.5;
/** Seuil AA pour du texte large (≥ 18,66 px gras ou ≥ 24 px) et les composants. */
export const AA_LARGE = 3;

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(parseHex(a));
  const lb = relativeLuminance(parseHex(b));
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrast(a: string, b: string, target: number = AA_TEXT): boolean {
  return contrastRatio(a, b) >= target;
}

/**
 * Choisit, entre plusieurs couleurs de premier plan, celle qui contraste le
 * mieux avec le fond. Sert à décider si un bouton primaire porte du texte
 * clair ou du texte sombre.
 */
export function pickOnColor(background: string, candidates: readonly string[]): string {
  let best = candidates[0];
  if (best === undefined) {
    throw new Error('pickOnColor exige au moins une couleur candidate.');
  }
  let bestRatio = contrastRatio(background, best);

  for (const candidate of candidates.slice(1)) {
    const ratio = contrastRatio(background, candidate);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best;
}

export interface ContrastFix {
  /** La couleur retenue — identique à l'entrée si elle passait déjà. */
  color: string;
  /** Vrai si la couleur d'origine a dû être modifiée. */
  adjusted: boolean;
  /** Ratio obtenu au final. */
  ratio: number;
  /** Ratio de la couleur d'origine, pour pouvoir l'expliquer à la box. */
  originalRatio: number;
}

/**
 * Ramène `color` au-dessus du seuil de contraste face à `against`, en ne
 * touchant qu'à sa clarté : la teinte de la marque est préservée, ce qui
 * rend la correction acceptable pour la box.
 */
export function ensureContrast(
  color: string,
  against: string,
  target: number = AA_TEXT,
): ContrastFix {
  const originalRatio = contrastRatio(color, against);
  if (originalRatio >= target) {
    return { color, adjusted: false, ratio: originalRatio, originalRatio };
  }

  const hsl = rgbToHsl(parseHex(color));

  // On cherche dans les deux sens à la fois, par écart croissant : la première
  // clarté qui passe est celle qui s'éloigne le moins de la couleur de la box.
  // Chercher dans un seul sens déduit du fond échoue sur les fonds moyens, où
  // c'est l'assombrissement qui gagne alors que le fond n'est pas « clair ».
  for (let stepCount = 1; stepCount <= 100; stepCount += 1) {
    const delta = stepCount * 0.01;

    for (const lightness of [hsl.l - delta, hsl.l + delta]) {
      if (lightness < 0 || lightness > 1) continue;

      const candidate = toHex(hslToRgb({ ...hsl, l: lightness }));
      const ratio = contrastRatio(candidate, against);
      if (ratio >= target) {
        return { color: candidate, adjusted: true, ratio, originalRatio };
      }
    }
  }

  // Teinte insauvable en jouant sur la clarté : on prend l'extrême qui contraste
  // le mieux, quitte à perdre la couleur. Une app illisible n'est pas une option.
  const fallback = pickOnColor(against, ['#000000', '#ffffff']);
  return {
    color: fallback,
    adjusted: true,
    ratio: contrastRatio(fallback, against),
    originalRatio,
  };
}
