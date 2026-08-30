/**
 * Formatage des montants, dates et heures.
 *
 * Deux règles gouvernent ce fichier :
 * - **Les montants sont des centimes entiers** (règle 5 de CLAUDE.md). Un
 *   nombre à virgule ici trahit un bug ailleurs : on lève plutôt que d'arrondir.
 * - **Les heures s'affichent dans le fuseau de la box**, jamais dans celui de
 *   l'appareil. Un membre en déplacement doit lire l'heure du cours, pas la sienne.
 */

import { translate } from './translate';
import { LOCALE_TAGS, type Locale } from './types';

export interface MoneyOptions {
  locale: Locale;
  /** Code ISO 4217. L'euro par défaut : le marché est européen. */
  currency?: string;
}

export function formatMoney(
  amountCents: number,
  { locale, currency = 'EUR' }: MoneyOptions,
): string {
  if (!Number.isInteger(amountCents)) {
    throw new Error(
      `Montant invalide : ${amountCents}. Les montants sont des centimes entiers, jamais des unités.`,
    );
  }

  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

export interface DateOptions {
  locale: Locale;
  /** Fuseau de la box, ex. `Europe/Paris`. */
  timeZone: string;
}

export interface FormatDateOptions extends DateOptions {
  style?: 'short' | 'long';
}

export function formatDate(
  value: Date | string,
  { locale, timeZone, style = 'short' }: FormatDateOptions,
): string {
  const date = toDate(value);
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' };

  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], options).format(date);
}

export function formatTime(value: Date | string, { locale, timeZone }: DateOptions): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(toDate(value));
}

export interface RelativeDateOptions extends DateOptions {
  /** Injectable pour les tests ; l'instant courant sinon. */
  now?: Date;
}

/**
 * « demain à 18:30 » jusqu'à deux jours, date absolue au-delà
 * (spec §12.3). L'écart se compte en **jours calendaires du fuseau de la box** :
 * compter en UTC ferait basculer les cours de fin de soirée au mauvais jour.
 */
export function formatRelativeDate(
  value: Date | string,
  { locale, timeZone, now = new Date() }: RelativeDateOptions,
): string {
  const date = toDate(value);
  const diff = calendarDayDiff(date, now, timeZone);

  const day =
    Math.abs(diff) <= 2
      ? new Intl.RelativeTimeFormat(LOCALE_TAGS[locale], { numeric: 'auto' }).format(diff, 'day')
      : formatDate(date, { locale, timeZone });

  return translate(locale, 'datetime.day_at_time', {
    day,
    time: formatTime(date, { locale, timeZone }),
  });
}

function toDate(value: Date | string): Date {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Date invalide : ${String(value)}`);
  }
  return date;
}

/** Jour calendaire `YYYY-MM-DD` tel que vu dans le fuseau donné. */
function calendarDay(date: Date, timeZone: string): string {
  // `en-CA` produit nativement `2026-08-31`, ce qui évite un assemblage manuel.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function calendarDayDiff(target: Date, reference: Date, timeZone: string): number {
  const toUtcMidnight = (date: Date): number => {
    const [year, month, day] = calendarDay(date, timeZone).split('-').map(Number);
    return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
  };

  const millisPerDay = 24 * 60 * 60 * 1000;
  return Math.round((toUtcMidnight(target) - toUtcMidnight(reference)) / millisPerDay);
}
