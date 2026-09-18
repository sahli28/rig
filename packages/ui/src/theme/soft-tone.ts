/**
 * Aplat doux d'une couleur d'état : la pastille « Réservé », la tuile d'icône.
 *
 * Le fond est un **mélange opaque** (pas un alpha) : une pastille posée sur une
 * image ou sur `surface` donne ainsi le même résultat que sur `surface2`, et le
 * contraste se calcule au lieu de s'espérer. Le premier plan est repassé par
 * `ensureContrast` contre ce fond-là — une couleur lisible sur `surface` ne
 * l'est pas forcément sur sa propre teinte.
 */

import { mixHex } from './color';
import { AA_TEXT, ensureContrast } from './contrast';
import type { Theme } from './tokens';

/** Part de la couleur dans le fond. Au-delà, le fond concurrence le texte. */
const SOFT_AMOUNT = 0.14;

export interface SoftTone {
  background: string;
  foreground: string;
}

export function softTone(theme: Pick<Theme, 'colors'>, color: string): SoftTone {
  const background = mixHex(color, theme.colors.surface2, SOFT_AMOUNT);
  return { background, foreground: ensureContrast(color, background, AA_TEXT).color };
}
