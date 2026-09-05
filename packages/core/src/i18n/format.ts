/**
 * Formatage des montants, dates et heures.
 *
 * Deux règles gouvernent ce fichier :
 * - **Les montants sont des centimes entiers** (règle 5 de CLAUDE.md). Un
 *   nombre à virgule ici trahit un bug ailleurs : on lève plutôt que d'arrondir.
 * - **Les heures s'affichent dans le fuseau de la box**, jamais dans celui de
 *   l'appareil. Un membre en déplacement doit lire l'heure du cours, pas la sienne.
 */

import { dateTimeFormat, numberFormat, relativeDayKey } from './intl';
import { translate } from './translate';
import { type Locale } from './types';

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

  return numberFormat(locale, { style: 'currency', currency }).format(amountCents / 100);
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

  return dateTimeFormat(locale, options).format(date);
}

/**
 * Le jour de la semaine, abrégé — « lun. », « Mon ».
 *
 * Séparé de `formatDate` parce que le bandeau de semaine (P1-011) affiche le
 * jour et le numéro sur **deux lignes** : les demander ensemble obligerait à
 * découper une chaîne formatée, ce qui ne survit pas au changement de langue.
 *
 * **Supposition sur le moteur** : les mêmes données ICU que `style: 'long'`,
 * qui affiche « vendredi 4 septembre 2026 » sur appareil depuis le 4 septembre
 * 2026. L'abrégé vient du même jeu ; le risque est faible et de la même famille
 * qu'`Intl.PluralRules`, donc il se vérifie **à la passe**, pas au harnais.
 */
export function formatWeekday(value: Date | string, { locale, timeZone }: DateOptions): string {
  return dateTimeFormat(locale, { timeZone, weekday: 'short' }).format(toDate(value));
}

/** Le numéro du jour dans le mois, sans zéro devant — « 7 », pas « 07 ». */
export function formatDayOfMonth(value: Date | string, { locale, timeZone }: DateOptions): string {
  return dateTimeFormat(locale, { timeZone, day: 'numeric' }).format(toDate(value));
}

export function formatTime(value: Date | string, { locale, timeZone }: DateOptions): string {
  return dateTimeFormat(locale, {
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

  // `relativeDayKey` et non `Intl.RelativeTimeFormat` : celui-ci **n'existe pas
  // non plus sous Hermes**. Il n'avait pas encore planté parce qu'aucun écran
  // mobile n'affichait de date relative — P1-003b en affichera. Traité dans le
  // même lot que `PluralRules`, sans quoi le prochain plantage aurait été
  // identique au mot près.
  const key = relativeDayKey(diff);
  const day = key === null ? formatDate(date, { locale, timeZone }) : translate(locale, key);

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
  return dateTimeFormat('en-CA', {
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
