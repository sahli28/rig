/**
 * La géométrie d'un anneau de progression, **pure et sans plateforme**.
 *
 * Prévu au kit (§12.2) mais jamais construit ; il naît ici, du côté partagé —
 * même patron que `scrimBands`/`softTone` : le calcul vit dans `packages/ui`,
 * testé sous Node, et chaque surface (le SVG web du dashboard aujourd'hui, un
 * `react-native-svg` mobile le jour où un écran en aura besoin) le rend avec ses
 * propres balises. On ne partage pas un composant web↔RN (ADR 0003), on partage
 * le calcul.
 *
 * Le dessin est un cercle dont on ne peint qu'une fraction, via `stroke-dasharray`
 * = circonférence et `stroke-dashoffset` = la part **non** peinte.
 */

export interface ProgressRingGeometry {
  /** Côté du carré SVG (viewBox `0 0 size size`). */
  size: number;
  /** Centre = `size / 2`, pour `cx`/`cy`. */
  center: number;
  radius: number;
  strokeWidth: number;
  /** `stroke-dasharray` de l'arc et de la piste. */
  circumference: number;
  /** `stroke-dashoffset` de l'arc : ce qui reste vide. */
  dashOffset: number;
}

export interface ProgressRingOptions {
  /** Défaut 120. */
  size?: number;
  /** Défaut 12. */
  strokeWidth?: number;
}

/**
 * `pct` est en pour-cent (0–100) et **borné** : un taux hors bornes ne fait pas
 * déborder l'arc, il sature. `dashOffset` vaut la circonférence à 0 % (rien de
 * peint) et 0 à 100 % (tout l'anneau).
 */
export function progressRing(pct: number, options: ProgressRingOptions = {}): ProgressRingGeometry {
  const size = options.size ?? 120;
  const strokeWidth = options.strokeWidth ?? 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const dashOffset = circumference * (1 - clamped / 100);
  return { size, center: size / 2, radius, strokeWidth, circumference, dashOffset };
}
