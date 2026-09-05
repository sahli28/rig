import { mondayOf, shiftWeeks } from '@rack/core/supabase';

/**
 * L'état du bandeau de semaine, **hors de React et hors de React Native**.
 *
 * Il vit dans un `.ts` sans le moindre import de plateforme, et ce n'est pas un
 * réflexe d'architecture : c'est ce qui rend ce défaut testable sans appareil.
 * Le bandeau a eu un vrai bug de comportement — le balayage s'annulait lui-même
 * au rendu suivant — et rien ne pouvait l'attraper : `apps/mobile` n'avait pas
 * de suite de tests, et le harnais web n'a pas de gestes. Le SDK web de React
 * Native **n'émet jamais** `onMomentumScrollEnd` (vérifié dans
 * `react-native-web/dist/exports/ScrollView`, où seul `onScroll` est câblé au
 * défilement du DOM), donc même un test qui monte le composant dans un
 * navigateur ne déclencherait pas le geste.
 *
 * Ce qui reste testable, et qui contient tout le défaut : **les deux
 * transitions**, et leur composition.
 *
 * ---
 *
 * **La distinction que le composant avait perdue** : « la semaine que je
 * regarde » n'est pas « la semaine du jour choisi ». Un balayage les fait
 * diverger *exprès* — glisser pour regarder n'est pas choisir. La première
 * version réconciliait sur le **désaccord**, donc traitait cette divergence
 * voulue comme une erreur et la corrigeait aussitôt.
 */

export interface EtatBandeau {
  /** La semaine affichée, lundi en date locale de la box. */
  lundi: string;
  /**
   * Le dernier jour choisi **qu'on ait vu passer**. C'est lui qui distingue
   * « la valeur a changé » de « les deux ne coïncident pas », et cette
   * distinction est tout le correctif.
   */
  dernierJourVu: string;
}

export function etatInitial(jour: string): EtatBandeau {
  return { lundi: mondayOf(jour), dernierJourVu: jour };
}

/**
 * Un balayage de `pages` pages — négatif vers le passé.
 *
 * Ne touche **pas** au jour choisi : c'est le seul endroit du composant où la
 * semaine regardée s'écarte volontairement de la semaine du jour.
 */
export function apresBalayage(etat: EtatBandeau, pages: number): EtatBandeau {
  if (pages === 0) return etat;
  return { ...etat, lundi: shiftWeeks(etat.lundi, pages) };
}

/**
 * Le jour choisi a peut-être changé — les flèches de l'écran, « Revenir à
 * aujourd'hui », un tap sur une pastille.
 *
 * **On réagit au changement, jamais à l'écart.** Si le jour est le même
 * qu'avant, l'état sort intact, quelle que soit la semaine regardée : c'est
 * précisément ce qui laisse un balayage survivre au rendu suivant.
 */
export function apresJourChoisi(etat: EtatBandeau, jour: string): EtatBandeau {
  if (jour === etat.dernierJourVu) return etat;
  return { lundi: mondayOf(jour), dernierJourVu: jour };
}
