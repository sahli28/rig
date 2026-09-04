/**
 * Moteur de traduction.
 *
 * Volontairement écrit à la main plutôt qu'importé : le besoin se limite à
 * deux langues, à l'interpolation et au pluriel, et `Intl.PluralRules` fait
 * déjà le travail difficile. En échange on obtient des **clés typées** —
 * une clé inexistante casse le typecheck, pas l'écran.
 */

import { pluralCategory } from './intl';
import en from './locales/en.json';
import fr from './locales/fr.json';
import {
  type Locale,
  type Messages,
  type PluralKey,
  type TranslationKey,
  type TranslationValues,
} from './types';

// L'annotation `Messages` impose au compilateur que l'anglais couvre toutes les
// clés du français. Une clé oubliée en EN est une erreur de typecheck, pas un
// texte manquant découvert en production.
const MESSAGES: Record<Locale, Messages> = {
  fr: fr satisfies Messages,
  en: en satisfies Messages,
};

const PLACEHOLDER = /\{(\w+)\}/g;

export function interpolate(template: string, values: TranslationValues = {}): string {
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = values[name];
    // Un placeholder sans valeur reste visible tel quel : mieux vaut un
    // « {position} » à l'écran qu'un trou silencieux dans une phrase.
    return value === undefined ? match : String(value);
  });
}

export interface TranslateOptions extends TranslationValues {
  /** Déclenche la résolution du pluriel et alimente `{count}`. */
  count?: number;
}

/**
 * Traduit une clé. Avec `count`, cherche d'abord la variante de pluriel
 * (`_one`, `_other`…) que la langue impose.
 */
export function translate(
  locale: Locale,
  key: TranslationKey | PluralKey,
  options: TranslateOptions = {},
): string {
  const messages = MESSAGES[locale];
  const { count, ...values } = options;

  let template = messages[key as TranslationKey];

  if (count !== undefined) {
    // `pluralCategory` et non `Intl.PluralRules` : ce dernier **n'existe pas
    // sous Hermes**, et c'est ici que le planning a planté sur appareil le
    // 4 septembre 2026, sur la première clé au pluriel jamais rendue par le
    // mobile. Voir `intl.ts`.
    const category = pluralCategory(locale, count);
    const plural = messages[`${key}_${category}` as TranslationKey];
    // `other` sert de repli : toutes les langues l'ont, `one` non.
    const fallback = messages[`${key}_other` as TranslationKey];
    template = plural ?? fallback ?? template;
  }

  if (template === undefined) {
    // On renvoie la clé plutôt que de lever : une clé manquante ne doit pas
    // faire tomber un écran de réservation. `pnpm i18n:check` la rattrape en CI.
    return key;
  }

  return interpolate(template, count === undefined ? values : { ...values, count });
}

/** Toutes les clés connues, pour les outils de vérification. */
export function knownKeys(locale: Locale): string[] {
  return Object.keys(MESSAGES[locale]);
}
