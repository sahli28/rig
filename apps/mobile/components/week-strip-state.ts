import { mondayOf, shiftWeeks } from '@rack/core/supabase';

/**
 * Les semaines que le bandeau donne à voir — **hors de React et hors de React
 * Native**, donc testables sans appareil.
 *
 * ---
 *
 * **Ce module a changé de forme après deux échecs sur appareil, et la raison
 * vaut d'être écrite.**
 *
 * La première version tenait « la semaine regardée » dans un état, et faisait
 * revenir le défilement au centre à chaque changement — un carrousel sans fin à
 * trois pages. Deux corrections plus tard, le balayage ne fonctionnait toujours
 * pas : on glissait vers la semaine suivante et on revenait à la semaine
 * courante.
 *
 * Le défaut de fond n'était aucun des deux bugs corrigés : **c'était d'avoir un
 * état à tenir synchronisé avec une position de défilement.** Cette
 * synchronisation dépend d'événements de geste (`onMomentumScrollEnd`), de
 * l'ordre entre une mesure de largeur et un `scrollTo`, et de ce qu'iOS fait
 * d'un `scrollTo` émis avant que la taille du contenu soit connue. Rien de tout
 * cela n'est testable ici — le SDK web n'émet même pas le geste — et chaque
 * correctif était donc un pari.
 *
 * **La conception actuelle n'a pas d'état à synchroniser.** La position de
 * défilement *est* la vérité : les pages sont la semaine du jour choisi et les
 * trois suivantes, et **rien ne défile jamais par programme**, sauf un retour à
 * `x = 0` quand le jour choisi change depuis l'extérieur — le seul décalage qui
 * ne peut pas être faux.
 *
 * Ce qui est perdu : on ne balaie plus vers le passé. Ce n'est pas une
 * régression du besoin — la fenêtre de réservation par défaut est de sept jours
 * (`open_days_before`), un cours passé ne se réserve pas, et les flèches de jour
 * restent là pour reculer.
 */

/** Ce que le bandeau montre : la semaine du jour choisi, et les suivantes. */
export const SEMAINES_VISIBLES = 4;

export interface FenetreBandeau {
  /** Lundi de la première page. Toujours la semaine du jour choisi. */
  base: string;
  /** Le jour choisi qu'on a vu passer — sert à ne réagir qu'aux changements. */
  dernierJourVu: string;
}

export function fenetreInitiale(jour: string): FenetreBandeau {
  return { base: mondayOf(jour), dernierJourVu: jour };
}

/**
 * Le jour choisi a peut-être changé — flèches de l'écran, « Revenir à
 * aujourd'hui », tap sur une pastille.
 *
 * **On réagit au changement, jamais à l'écart** entre la fenêtre et le jour :
 * c'est ce qui laisse la personne regarder une autre semaine sans que son geste
 * soit défait. Le défaut du 5 septembre était exactement cette confusion.
 */
export function apresJourChoisi(fenetre: FenetreBandeau, jour: string): FenetreBandeau {
  if (jour === fenetre.dernierJourVu) return fenetre;
  return { base: mondayOf(jour), dernierJourVu: jour };
}

/** Les lundis des pages, dans l'ordre où elles s'affichent. */
export function semainesDeLaFenetre(fenetre: FenetreBandeau): string[] {
  return Array.from({ length: SEMAINES_VISIBLES }, (_, index) => shiftWeeks(fenetre.base, index));
}

/**
 * La page sur laquelle on est posé, d'après la position de défilement.
 *
 * Bornée aux pages qui existent : sur iOS le rebond élastique rend des offsets
 * négatifs ou au-delà du contenu, et un index hors bornes afficherait une
 * semaine vide le temps d'un rendu.
 */
export function pageVisible(offsetX: number, largeur: number): number {
  if (largeur <= 0) return 0;
  const page = Math.round(offsetX / largeur);
  return Math.min(Math.max(page, 0), SEMAINES_VISIBLES - 1);
}
