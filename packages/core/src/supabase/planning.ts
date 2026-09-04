/**
 * Le modèle de vue du planning — **partagé, parce qu'il porte des règles de
 * date, et qu'une règle de date dupliquée diverge en silence.**
 *
 * Ces fonctions vivaient dans `apps/web/app/box/[slug]/planning/view-model.ts`,
 * où elles étaient pures, correctes, et **sans un seul test** : `apps/web` n'a
 * pas de suite. Le mobile allait en avoir besoin ; les recopier aurait donné
 * deux calculs de semaine libres de dériver, et la dérive aurait été silencieuse
 * — les deux écrans auraient affiché quelque chose de plausible. C'est
 * `isCalendarDate` en plus gros.
 *
 * Ce qui reste dans chaque application : la **présentation**. Le web a une
 * grille de sept colonnes — souris, écran large, édition d'une série ; le mobile
 * a une liste par jour — pouce, écran étroit, lecture seule. Ce ne sont pas les
 * mêmes écrans, et il ne faut pas essayer d'en faire un.
 */

import type { TranslationKey } from '../i18n/types';
import type { RruleDay } from './class-schedules';
import { weekDates } from './class-schedules';

/** Une occurrence de cours, telle qu'un écran l'affiche. */
export type Occurrence = {
  id: string;
  schedule_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  status: 'SCHEDULED' | 'CANCELLED';
  cancellation_reason: string | null;
  className: string;
  roomName: string;
  coachName: string;
};

/** Une série hebdomadaire, telle que le back-office l'affiche et l'édite. */
export type Serie = {
  id: string;
  class_type_id: string;
  room_id: string;
  coach_membership_id: string;
  starts_on: string;
  starts_at_local: string;
  rrule: string;
  capacity: number;
  className: string;
};

export type Choice = { id: string; label: string };

/**
 * Range les occurrences dans les sept colonnes de la semaine.
 *
 * `dayOf` reçoit la date locale de la box — **pas** celle du navigateur. Une
 * occurrence à 00 h 30 heure de Paris est un `timestamptz` qui, lu à Londres,
 * tombe la veille : sans conversion explicite, un cours du lundi apparaîtrait le
 * dimanche pour qui regarde depuis un autre fuseau. Le calcul est fait par
 * l'appelant, qui seul connaît le fuseau du tenant.
 */
export function groupByDay(
  monday: string,
  occurrences: Occurrence[],
  dayOf: (isoInstant: string) => string,
): Array<{ date: string; occurrences: Occurrence[] }> {
  const buckets = new Map<string, Occurrence[]>(weekDates(monday).map((date) => [date, []]));

  for (const occurrence of occurrences) {
    buckets.get(dayOf(occurrence.starts_at))?.push(occurrence);
  }

  return [...buckets.entries()].map(([date, list]) => ({
    date,
    occurrences: list.sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  }));
}

/**
 * La date d'un instant, dans le fuseau de la box, en `YYYY-MM-DD`.
 *
 * `en-CA` parce que son format court **est** l'ISO. C'est un détour, mais il
 * évite de recomposer la date à la main à partir de `formatToParts`, et `Intl`
 * est la seule source qui connaisse les règles d'heure d'été.
 */
export function localDayIn(timeZone: string): (isoInstant: string) => string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return (isoInstant) => formatter.format(new Date(isoInstant));
}

/** La date d'un instant dans le fuseau de la box, en `YYYY-MM-DD`. */
export function localDay(isoInstant: string, timeZone: string): string {
  return localDayIn(timeZone)(isoInstant);
}

/**
 * L'instant UTC correspondant à une heure **locale de la box** — l'inverse de ce
 * que fait `at time zone t.timezone` côté SQL.
 *
 * Il sert à borner une requête. Filtrer sur `starts_at` en UTC ferait manquer
 * les cours de fin de soirée, ou déborder sur le jour suivant, selon le fuseau —
 * le genre d'erreur qu'on ne voit qu'en production, et seulement deux fois par an.
 *
 * Approche par décalage mesuré : on demande à `Intl` ce que devient l'instant
 * naïf dans le fuseau visé, et on corrige de l'écart constaté. C'est laid, et
 * c'est la seule façon de le faire sans dépendance. Le jour où une bibliothèque
 * de dates entre dans le dépôt, ces quelques lignes disparaissent.
 *
 * Une seule passe suffit parce que les bornes tombent à minuit : le seul cas où
 * une correction unique dérape est un instant situé **dans** l'heure de bascule,
 * et minuit n'en est jamais une en Europe.
 */
export function instantLocal(naiveLocal: string, timeZone: string): string {
  const supposed = new Date(`${naiveLocal}Z`);
  const seen = new Date(
    `${new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      dateStyle: 'short',
      timeStyle: 'medium',
    })
      .format(supposed)
      .replace(' ', 'T')}Z`,
  );
  return new Date(supposed.getTime() - (seen.getTime() - supposed.getTime())).toISOString();
}

/**
 * Les jours, en clés i18n. Ici plutôt que dans chaque composant : la grille, le
 * formulaire et bientôt la liste mobile les nomment tous, et trois tables à
 * tenir à jour, c'est une table qui finit par mentir.
 *
 * Indexé par code RFC et non par position : `dayOfWeekday()` fait la conversion,
 * et le `Record` est **total**, donc rien à raccrocher sur un `undefined`.
 */
export const DAY_LABELS: Record<RruleDay, TranslationKey> = {
  MO: 'settings.weekday_monday',
  TU: 'settings.weekday_tuesday',
  WE: 'settings.weekday_wednesday',
  TH: 'settings.weekday_thursday',
  FR: 'settings.weekday_friday',
  SA: 'settings.weekday_saturday',
  SU: 'settings.weekday_sunday',
};
