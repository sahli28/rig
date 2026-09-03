import fr from './locales/fr.json';

/**
 * Langues du produit. FR et EN dès le premier écran ; toute troisième langue
 * n'ajoutera qu'un fichier, jamais de logique.
 */
export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Étiquette BCP-47 passée à l'API `Intl`. L'anglais est en `en-GB` : le marché
 * est européen, et le format de date britannique est celui qui surprend le
 * moins un membre francophone qui bascule la langue.
 */
export const LOCALE_TAGS: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Langue servie quand on ne sait **rien** : appareil dans une langue non gérée,
 * aucune préférence enregistrée, aucun profil.
 *
 * **Le français, tranché par D-004.** Le produit est vendu à des boxes
 * françaises et ses écrans sont pensés en français ; un repli anglais était
 * l'inverse du défaut attendu, et venait de l'habitude plutôt que d'un
 * arbitrage. Le rang 4 de `resolve-locale.ts` est le seul à s'en servir : une
 * personne dont le téléphone est en allemand voit désormais la langue de la
 * box, pas une troisième langue.
 */
export const FALLBACK_LOCALE: Locale = 'fr';

/**
 * Ramène une étiquette BCP-47 (`fr-CA`, `en_US`, `de-DE`) à une langue du
 * produit, avec repli. Sert à **afficher** quelque chose à partir d'une
 * étiquette quelconque.
 *
 * Pour **choisir** entre plusieurs sources, prendre `localeFromTagOrNull()` :
 * cette fonction-ci ne distingue pas « allemand » de « rien », puisqu'elle rend
 * le repli dans les deux cas.
 *
 * Sur le web, `navigator.language` donne la langue du navigateur. **Sur mobile,
 * `Intl.DateTimeFormat().resolvedOptions().locale` ne donne pas celle de
 * l'appareil** : sous Hermes elle vaut `en-US` quels que soient les réglages du
 * téléphone. C'est `expo-localization` qui la donne, et cette phrase remplace
 * l'hypothèse inverse, qui était écrite ici et fausse — vérifiée sur un iPhone
 * réglé en français le 3 septembre 2026.
 */
export function localeFromTag(tag: string | null | undefined): Locale {
  if (!tag) return FALLBACK_LOCALE;
  const base = tag.replace('_', '-').split('-')[0]?.toLowerCase() ?? '';
  return isLocale(base) ? base : FALLBACK_LOCALE;
}

/**
 * Toutes les clés existantes, dérivées du fichier français.
 * Le français fait foi : c'est la langue dans laquelle les écrans sont pensés.
 */
export type TranslationKey = keyof typeof fr;

/**
 * Clés de pluriel, sans leur suffixe. `class.spots_left_one` et
 * `class.spots_left_other` donnent `class.spots_left`, la clé que le code appelle.
 */
export type PluralKey = keyof typeof fr extends infer K
  ? K extends `${infer Base}_one`
    ? Base
    : never
  : never;

/** Valeurs interpolées dans un message : `{position}`, `{count}`… */
export type TranslationValues = Record<string, string | number>;

/** Un dictionnaire complet. Le type impose la parité des clés avec le français. */
export type Messages = Record<TranslationKey, string>;
