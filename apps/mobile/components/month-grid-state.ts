import { mondayOf, shiftDays } from '@rack/core/supabase';

/**
 * La grille d'un mois — **hors de React et hors de React Native**, donc
 * vérifiable sans appareil (P1-014).
 *
 * ---
 *
 * **Ce module remplace `week-strip-state.ts`, et il hérite de sa leçon.**
 *
 * Le bandeau de semaine a coûté trois essais, tous sur le même défaut : un état
 * « la semaine regardée » qu'il fallait tenir d'accord avec une position de
 * défilement. Cette synchronisation dépend d'événements de geste, de l'ordre
 * entre une mesure et un `scrollTo`, et de ce qu'iOS fait d'un `scrollTo` émis
 * trop tôt — rien de tout cela n'étant testable ici.
 *
 * **Une grille de mois n'a pas ce problème, et c'est la raison de sa forme.**
 * Elle est statique : on affiche le mois demandé, on change de mois par une
 * flèche, rien ne défile. La propriété qui a coûté trois essais là-bas est
 * gratuite ici, et le seul état est une chaîne `AAAA-MM`.
 *
 * **Tout est en UTC, volontairement**, comme `mondayOf()` et `shiftDays()` dont
 * ce module se sert : ce sont des **étiquettes de calendrier**, pas des
 * instants. Le passage d'un instant à la date locale de la box est le travail de
 * `localDay()`, et il se fait avant d'arriver ici — la grille ne voit jamais un
 * fuseau.
 */

/** Un mois, en `AAAA-MM`. */
export type Mois = string;

/** Le mois d'une date de calendrier. */
export function moisDe(date: string): Mois {
  return date.slice(0, 7);
}

/** Le premier jour d'un mois, en `AAAA-MM-JJ`. */
export function premierJourDu(mois: Mois): string {
  return `${mois}-01`;
}

/**
 * Le dernier jour d'un mois.
 *
 * Par le premier du mois suivant moins un jour, plutôt qu'une table de
 * longueurs : février bissextile s'obtient sans le savoir.
 */
export function dernierJourDu(mois: Mois): string {
  return shiftDays(premierJourDu(moisSuivant(mois)), -1);
}

export function moisSuivant(mois: Mois): Mois {
  const [annee, m] = decoupe(mois);
  return m === 12 ? formate(annee + 1, 1) : formate(annee, m + 1);
}

export function moisPrecedent(mois: Mois): Mois {
  const [annee, m] = decoupe(mois);
  return m === 1 ? formate(annee - 1, 12) : formate(annee, m - 1);
}

/**
 * Les semaines de la grille, du lundi au dimanche, telles qu'elles s'affichent.
 *
 * **Le nombre de lignes varie — 4, 5 ou 6 — et c'est voulu.** Une grille figée à
 * six lignes ajoute une ligne vide onze mois sur douze, et pousse la liste des
 * cours hors de l'écran pour rien. Février d'une année non bissextile commençant
 * un lundi tient en quatre lignes ; mai 2027, commençant un samedi, en demande
 * six.
 *
 * Les cases hors du mois sont rendues (la semaine reste une semaine), mais
 * `estDansLe()` permet de les afficher en retrait — sans quoi le 31 août
 * ressemblerait à un jour de septembre.
 */
export function semainesDu(mois: Mois): string[][] {
  const premier = premierJourDu(mois);
  const dernier = dernierJourDu(mois);
  const depart = mondayOf(premier);

  const semaines: string[][] = [];
  for (let curseur = depart; curseur <= dernier; curseur = shiftDays(curseur, 7)) {
    semaines.push(Array.from({ length: 7 }, (_, index) => shiftDays(curseur, index)));
  }
  return semaines;
}

/** Cette date appartient-elle au mois affiché ? */
export function estDansLe(mois: Mois, date: string): boolean {
  return moisDe(date) === mois;
}

/**
 * Peut-on reculer avant ce mois ?
 *
 * La borne est l'adhésion : avant, la personne n'était pas là, et une navigation
 * sans fin vers du vide n'est pas une fonctionnalité. `null` quand l'adhésion
 * est inconnue — on ne bloque pas sur une donnée absente.
 */
export function peutReculer(mois: Mois, moisDAdhesion: Mois | null): boolean {
  return moisDAdhesion === null || mois > moisDAdhesion;
}

function decoupe(mois: Mois): [number, number] {
  return [Number(mois.slice(0, 4)), Number(mois.slice(5, 7))];
}

function formate(annee: number, mois: number): Mois {
  return `${String(annee).padStart(4, '0')}-${String(mois).padStart(2, '0')}`;
}
