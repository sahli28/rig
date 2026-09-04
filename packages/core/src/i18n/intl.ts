/**
 * **Le seul module du dépôt autorisé à toucher `Intl`.**
 *
 * Il existe parce que trois défauts en une semaine ont eu la même cause, et que
 * deux sont allés jusqu'à l'appareil :
 *
 * | Quand | Ce qui manquait | Où ça s'est vu |
 * | --- | --- | --- |
 * | 3 sept. | `resolvedOptions().locale` ne rend pas la langue du système | passe iPhone (D-004) |
 * | 3 sept. | idem pour `.timeZone` — la sœur, corrigée avec | trouvée en corrigeant |
 * | 4 sept. | **`Intl.PluralRules` n'existe pas** | plantage sur appareil, planning |
 *
 * La cause commune n'est pas `Intl`, c'est **l'endroit où le code s'exécute**.
 * Vitest tourne sous Node, le harnais web dans un navigateur : les deux ont un
 * `Intl` complet. Le produit tourne sous Hermes, qui n'en a qu'une partie. Aucun
 * de nos filets ne peut voir cette classe de défaut, parce qu'ils s'exécutent
 * tous sur un moteur qui n'est pas celui du produit.
 *
 * D'où deux décisions :
 *
 * 1. **`Intl` est un global interdit ailleurs**, imposé par ESLint
 *    (`no-restricted-syntax` sur `packages/**`). Le message dit où passer ;
 * 2. **chaque fonction ci-dessous dit ce qu'elle suppose du moteur**, et si
 *    cette supposition est prouvée ou seulement crue.
 *
 * Ce qui n'utilise plus `Intl` du tout — le pluriel et les jours relatifs — a
 * migré vers des tables explicites. Ce n'est pas de l'orgueil : une
 * fonctionnalité absente du moteur ne se rapièce pas, elle se remplace.
 */

import type { Locale } from './types';
import { LOCALE_TAGS } from './types';

// ---------------------------------------------------------------------------
// Ce qui ne dépend plus du moteur du tout
// ---------------------------------------------------------------------------

/**
 * La catégorie de pluriel d'un nombre — **sans `Intl.PluralRules`**, qui
 * n'existe pas sous Hermes.
 *
 * C'est ce qui a fait planter le planning sur appareil, sur la toute première
 * clé au pluriel jamais rendue par le mobile : « 16 places restantes ».
 *
 * **Pourquoi une table plutôt qu'un polyfill.** Les deux marchent, et le
 * polyfill (`@formatjs/intl-pluralrules`) est correct pour toutes les langues.
 * Il perd quand même, pour une raison qui n'est pas la taille du bundle :
 * **un polyfill réinstalle `Intl.PluralRules` comme global**, donc il rend le
 * code partagé à nouveau dépendant d'`Intl` — exactement ce que la règle
 * ci-dessus interdit. On rapiécerait le moteur pour pouvoir continuer à
 * s'appuyer dessus, alors que le besoin réel tient en deux lignes.
 *
 * Règles CLDR, réduites à ce que le produit parle :
 *
 * - **fr** : `one` si la partie entière vaut 0 ou 1 — « 0 place restante »,
 *   « 1 place restante », « 2 places restantes » ;
 * - **en** : `one` si le nombre vaut exactement 1 — « 0 seats left ».
 *
 * **La condition à ne pas oublier** : ceci ne vaut que pour ces deux langues.
 * Une troisième — polonais, russe, arabe — a trois à six catégories et des
 * règles que personne n'écrit de tête. Le jour où elle arrive, on repasse au
 * polyfill **et** on lève l'interdiction pour ce seul fichier. Ce n'est pas un
 * détail à retrouver : c'est la ligne qui rend cette table honnête.
 */
export function pluralCategory(locale: Locale, count: number): 'one' | 'other' {
  const n = Math.abs(count);
  // Les comptes négatifs n'existent pas dans le produit — on compte des places,
  // des cours, des membres. La valeur absolue évite un « -1 places ».
  if (locale === 'fr') return n < 2 ? 'one' : 'other';
  return n === 1 ? 'one' : 'other';
}

/**
 * Les cinq jours qu'on nomme au lieu de les dater — **sans
 * `Intl.RelativeTimeFormat`**, la seconde bombe du même lot.
 *
 * Elle n'avait pas encore explosé pour une seule raison : aucun écran mobile
 * n'affichait de date relative. `P1-003b` en affichera, et le plantage aurait
 * été identique au mot près.
 *
 * Rend `null` au-delà de deux jours : l'appelant bascule alors sur une date
 * absolue, comme le veut la microcopie §12.3. Les libellés sont des **clés
 * i18n**, pas des chaînes — c'est la règle 8 des règles non négociables, et ça
 * évite une seconde table de traductions à côté de la vraie.
 */
export function relativeDayKey(
  diff: number,
):
  | 'datetime.day_before_yesterday'
  | 'datetime.yesterday'
  | 'datetime.today'
  | 'datetime.tomorrow'
  | 'datetime.day_after_tomorrow'
  | null {
  switch (diff) {
    case -2:
      return 'datetime.day_before_yesterday';
    case -1:
      return 'datetime.yesterday';
    case 0:
      return 'datetime.today';
    case 1:
      return 'datetime.tomorrow';
    case 2:
      return 'datetime.day_after_tomorrow';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Ce qui dépend encore du moteur, et ce qu'on en sait
// ---------------------------------------------------------------------------

/**
 * **Supposition sur le moteur : `Intl.DateTimeFormat` existe et sait appliquer
 * un `timeZone`.**
 *
 * *Prouvée sur appareil*, et pas par un test : le plantage du 4 septembre a eu
 * lieu **après** le rendu de l'en-tête de jour (« vendredi 4 septembre 2026 »)
 * et des heures de chaque ligne (« 18:30 – 19:30 »). La pile s'arrête sur le
 * badge de places ; tout ce qui précède avait donc déjà formaté sous Hermes.
 * C'est la seule preuve qu'on possède, et elle vient d'une trace d'erreur.
 *
 * Reste inconnu : le rendu des noms de mois et de jours en français dépend des
 * données ICU embarquées. Elles étaient là le 4 septembre — sur cet appareil,
 * cette version d'Expo Go.
 */
export function dateTimeFormat(
  locale: Locale | 'en-CA' | 'sv-SE' | 'en-GB',
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const tag = locale in LOCALE_TAGS ? LOCALE_TAGS[locale as Locale] : locale;
  return new Intl.DateTimeFormat(tag, options);
}

/**
 * **Supposition sur le moteur : `Intl.NumberFormat` existe et connaît le style
 * `currency`.**
 *
 * *Non prouvée sur appareil.* Aucun écran mobile n'affiche encore de montant —
 * le premier sera P2-005. C'est donc la **prochaine candidate** de la liste, et
 * elle mérite d'être exercée avant d'être crue : un écran de diagnostic au
 * démarrage, ou simplement un montant affiché quelque part pendant une passe.
 */
export function numberFormat(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], options);
}

/**
 * **Supposition sur le moteur : `Intl.DateTimeFormat` lève sur un fuseau
 * inconnu.**
 *
 * *Non prouvée sur appareil*, et sans conséquence : cette fonction n'est
 * appelée que par le back-office web, où `Intl` est complet. Si elle atterrit
 * un jour sur mobile, c'est le comportement d'`Intl` en cas d'erreur qu'il
 * faudra vérifier, pas sa présence.
 */
export function timeZoneExists(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    return true;
  } catch {
    return false;
  }
}
