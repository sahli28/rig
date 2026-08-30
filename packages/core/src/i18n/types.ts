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

/** Langue par défaut quand celle de l'appareil n'est pas gérée. */
export const FALLBACK_LOCALE: Locale = 'en';

/**
 * Ramène une étiquette BCP-47 (`fr-CA`, `en_US`, `de-DE`) à une langue du
 * produit. Sert à lire la langue de l'appareil sans dépendance : sur mobile
 * comme sur le web, `Intl.DateTimeFormat().resolvedOptions().locale` la donne.
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
