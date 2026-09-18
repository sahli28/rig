/**
 * Voile dégradé posé sur une image, **sans module natif**.
 *
 * `expo-linear-gradient` demanderait un nouveau binaire ; le pilote tourne sur
 * un build TestFlight et cette passe doit pouvoir partir en OTA. Un dégradé sur
 * une photo n'a pas besoin d'être continu : des bandes d'alpha croissant sont
 * indiscernables d'un vrai dégradé dès qu'il y en a assez. Le calcul est ici,
 * pur et testé ; le composant `Scrim` ne fait que les empiler.
 */

import { withAlpha } from './color';

export interface ScrimBand {
  /** Couleur `#rrggbbaa`. */
  color: string;
}

/**
 * `from` → `to` : alpha au début et à la fin du voile. Courbe en S (smoothstep) : le
 * haut de l'image respire, le bas — là où le texte se pose — est franchement
 * couvert.
 */
export function scrimBands(scrim: string, from: number, to: number, count = 64): ScrimBand[] {
  const n = Math.max(2, Math.round(count));
  return Array.from({ length: n }, (_, index) => {
    const t = index / (n - 1);
    return { color: withAlpha(scrim, from + (to - from) * t * t * (3 - 2 * t)) };
  });
}
