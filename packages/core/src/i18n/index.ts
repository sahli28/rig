/**
 * i18n — moteur pur, sans React ni dépendance plateforme.
 * Le liant React vit dans `@rig/ui/i18n`.
 */

export { translate, interpolate, knownKeys, type TranslateOptions } from './translate';
export {
  formatMoney,
  formatDate,
  formatTime,
  formatRelativeDate,
  type MoneyOptions,
  type DateOptions,
  type FormatDateOptions,
  type RelativeDateOptions,
} from './format';
export {
  LOCALES,
  LOCALE_TAGS,
  FALLBACK_LOCALE,
  isLocale,
  localeFromTag,
  type Locale,
  type TranslationKey,
  type PluralKey,
  type TranslationValues,
  type Messages,
} from './types';
export {
  localeFromTagOrNull,
  profileLocaleToSync,
  resolveLocale,
  type LocaleSources,
} from './resolve-locale';
