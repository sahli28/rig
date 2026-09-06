import type { BookedDays } from '@rack/core/supabase';

/**
 * Ce qui est réservé, vu depuis la liste d'un jour (P1-012).
 *
 * **Aucun import de `react-native` ici**, comme `color-scheme.ts` : c'est ce qui
 * rend le fichier lisible par Vitest, et donc ce qui rend le badge vérifiable
 * sans téléphone.
 *
 * ---
 *
 * **Le trou que ces quelques lignes ferment.**
 *
 * Les jours réservés se chargent **par mois** — c'est la grille du calendrier
 * qui commande, et une requête par mois affiché suffit à ses pastilles. Mais le
 * mois feuilleté et le jour affiché sont deux choses **séparées** depuis
 * P1-014 : on peut regarder octobre en gardant le 5 septembre ouvert en dessous,
 * et c'est même tout l'intérêt.
 *
 * Un badge qui lirait « le mois chargé » perdrait donc ses marqueurs dès qu'on
 * feuillette, sur une liste qui, elle, n'a pas bougé. D'où un état **indexé par
 * mois** plutôt qu'un seul mois à la fois, et deux fonctions qui disent
 * lesquels doivent être chargés.
 */

/** Ce qui est chargé, par mois (`AAAA-MM`). */
export type ReservesParMois = Readonly<Record<string, BookedDays>>;

/**
 * Les cours réservés du jour affiché, prêts pour un `has()` par ligne.
 *
 * Un `Set` et non le tableau : la liste teste une appartenance par cours, et
 * `includes()` sur chaque ligne referait le parcours à chaque rendu.
 */
export function reservesDuJour(parMois: ReservesParMois, jour: string): ReadonlySet<string> {
  const mois = jour.slice(0, 7);
  return new Set(parMois[mois]?.[jour] ?? []);
}

/**
 * Les mois qu'il faut avoir chargés : celui qu'on feuillette, et celui du jour
 * affiché.
 *
 * **Un seul quand ils coïncident**, c'est-à-dire le cas courant : on ne paie la
 * seconde requête qu'en feuilletant réellement ailleurs.
 */
export function moisACharger(moisAffiche: string, jourAffiche: string): string[] {
  const moisDuJour = jourAffiche.slice(0, 7);
  return moisAffiche === moisDuJour ? [moisAffiche] : [moisAffiche, moisDuJour];
}

/**
 * Combien de réservations un jour porte — ce que la pastille du calendrier
 * affiche.
 *
 * **Dérivé, jamais stocké** : le compte était une donnée à part jusqu'à P1-012,
 * et deux valeurs qui décrivent la même chose finissent par se contredire.
 */
export function comptesDuMois(jours: BookedDays | undefined): Record<string, number> {
  const comptes: Record<string, number> = {};
  for (const [jour, ids] of Object.entries(jours ?? {})) comptes[jour] = ids.length;
  return comptes;
}
