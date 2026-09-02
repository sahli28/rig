/**
 * Séries hebdomadaires et occurrences — la forme partagée par l'écran, la base
 * et le futur mobile.
 *
 * Rien n'écrit ici. Ce fichier porte **la grammaire RRULE du pilote** et les
 * quelques fonctions pures qui la manipulent.
 *
 * La grammaire est délibérément petite, et elle est écrite **deux fois** : ici
 * en Zod, et dans `pilot_weekly_rrule_valid()` côté base. Ce n'est pas une
 * duplication à regretter, c'est la règle des sœurs appliquée d'avance — un
 * contrôle porté par le seul écran n'est pas un invariant, et une contrainte
 * portée par la seule base remonte un 23514 opaque au lieu d'un message de
 * champ. Les deux doivent bouger ensemble ; le test de parité ci-dessous
 * (`class-schedules.test.ts`) échoue si l'une dérive.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Les jours
// ---------------------------------------------------------------------------

/**
 * Codes RFC 5545, **dans l'ordre où la semaine commence en France**, et indexés
 * pour coïncider avec `opening_hours.weekday` (0 = lundi … 6 = dimanche).
 *
 * Trois conventions cohabitent dans ce produit, et les confondre est une erreur
 * silencieuse : `BYDAY` en lettres, `opening_hours.weekday` en 0–6 à partir du
 * lundi, et `extract(isodow)` de PostgreSQL en 1–7 à partir du lundi. Cette
 * table est le seul endroit où l'on passe de l'une à l'autre.
 */
export const RRULE_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

export type RruleDay = (typeof RRULE_DAYS)[number];

/** `MO` → 0, `SU` → 6. Même base que `opening_hours.weekday`. */
export function weekdayOf(day: RruleDay): number {
  return RRULE_DAYS.indexOf(day);
}

/** 0 → `MO`, 6 → `SU`. Réciproque de `weekdayOf`. */
export function dayOfWeekday(weekday: number): RruleDay {
  return RRULE_DAYS[weekday] ?? 'MO';
}

// ---------------------------------------------------------------------------
// La grammaire du pilote
// ---------------------------------------------------------------------------

/**
 * Miroir **littéral** de la contrainte `class_schedules_rrule_pilot`.
 *
 * `FREQ=WEEKLY[;INTERVAL=1..52];BYDAY=MO[,TU…][;UNTIL=YYYYMMDD]`
 *
 * Tout le reste est refusé, et c'est le point du ticket : PostgreSQL n'a pas de
 * parseur RFC 5545 et le job `pg_cron` ne peut pas exécuter de TypeScript.
 * Interpréter `COUNT`, `MONTHLY`, `BYSETPOS` ou `WKST` par approximation ferait
 * tenir un cours à une heure que la box n'a jamais choisie. Un refus assorti
 * d'une alternative vaut mieux qu'une récurrence à peu près juste.
 */
const RRULE_PATTERN =
  /^FREQ=WEEKLY(;INTERVAL=([1-9]|[1-4][0-9]|5[0-2]))?;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*(;UNTIL=\d{8})?$/;

export const RRULE_MIN_INTERVAL = 1;
export const RRULE_MAX_INTERVAL = 52;

/** Ce qu'une série dit, une fois la chaîne relue. */
export type WeeklyRecurrence = {
  days: RruleDay[];
  interval: number;
  /** `YYYY-MM-DD`, ou `null` quand la série n'a pas de fin. */
  until: string | null;
};

/**
 * `YYYYMMDD` → `YYYY-MM-DD`, et **`null` si la date n'existe pas**.
 *
 * Le contrôle du calendrier n'est pas décoratif : `20260230` passe l'expression
 * régulière et n'est pas une date. La base fait le même aller-retour
 * (`to_char(to_date(…)) = …`) précisément pour ça.
 */
function calendarDate(compact: string): string | null {
  const year = Number(compact.slice(0, 4));
  const month = Number(compact.slice(4, 6));
  const day = Number(compact.slice(6, 8));

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

/**
 * Relit une RRULE du pilote. `null` dès que quelque chose ne va pas — la forme,
 * un jour répété, ou une date qui n'existe pas.
 *
 * On rend `null` plutôt que de lever : l'appelant est un écran, et une série
 * illisible venue de la base est un cas à afficher, pas un cas à faire planter.
 */
export function parseWeeklyRrule(rrule: string): WeeklyRecurrence | null {
  if (!RRULE_PATTERN.test(rrule)) return null;

  const days = (rrule.match(/BYDAY=([^;]+)/)?.[1] ?? '').split(',') as RruleDay[];
  if (new Set(days).size !== days.length) return null;

  const until = rrule.match(/UNTIL=(\d{8})/)?.[1] ?? null;
  const parsedUntil = until === null ? null : calendarDate(until);
  if (until !== null && parsedUntil === null) return null;

  return {
    days: [...days].sort((a, b) => weekdayOf(a) - weekdayOf(b)),
    interval: Number(rrule.match(/INTERVAL=(\d+)/)?.[1] ?? 1),
    until: parsedUntil,
  };
}

/**
 * Écrit la forme **canonique**, celle que la base accepte.
 *
 * Deux choix qui évitent de faux changements sur un aller-retour formulaire →
 * base → formulaire : les jours sortent triés du lundi au dimanche, et
 * `INTERVAL=1` est omis puisqu'il est la valeur par défaut de la RFC. Sans ça,
 * rouvrir une série sans rien toucher la marquerait modifiée.
 */
export function buildWeeklyRrule(recurrence: WeeklyRecurrence): string {
  const days = [...new Set(recurrence.days)].sort((a, b) => weekdayOf(a) - weekdayOf(b));

  const parts = ['FREQ=WEEKLY'];
  if (recurrence.interval > 1) parts.push(`INTERVAL=${recurrence.interval}`);
  parts.push(`BYDAY=${days.join(',')}`);
  if (recurrence.until !== null) parts.push(`UNTIL=${recurrence.until.replaceAll('-', '')}`);

  return parts.join(';');
}

/** Vrai si la base l'acceptera. Le test de parité s'appuie dessus. */
export function isPilotRrule(rrule: string): boolean {
  return parseWeeklyRrule(rrule) !== null;
}

// ---------------------------------------------------------------------------
// Ce qu'un formulaire de série envoie
// ---------------------------------------------------------------------------

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * `HH:MM` — l'heure **locale de la box**, nue. Elle n'est pas un instant : la
 * base la convertit en UTC à la matérialisation, avec le fuseau du tenant, pour
 * que 18h30 reste 18h30 au passage à l'heure d'hiver (règle 9 de `CLAUDE.md`).
 */
const LocalTimeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  .transform((value) => value.slice(0, 5));

export const RecurrenceSchema = z
  .object({
    days: z.array(z.enum(RRULE_DAYS)).min(1).max(7),
    interval: z.number().int().min(RRULE_MIN_INTERVAL).max(RRULE_MAX_INTERVAL),
    until: DateString.nullable(),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.days).size !== value.days.length) {
      ctx.addIssue({ code: 'custom', path: ['days'], message: 'duplicate_day' });
    }
  });

export const ClassSchedulePatchSchema = z
  .object({
    class_type_id: z.string().uuid(),
    room_id: z.string().uuid(),
    coach_membership_id: z.string().uuid(),
    starts_on: DateString,
    starts_at_local: LocalTimeString,
    rrule: z.string().refine(isPilotRrule, { message: 'unsupported_rrule' }),
    capacity: z.number().int().positive().max(500),
  })
  .superRefine((value, ctx) => {
    // Miroir de `class_schedules_until_after_start`. La base refuse déjà ; le
    // dire ici évite un 23514 sans nom de champ.
    const until = parseWeeklyRrule(value.rrule)?.until ?? null;
    if (until !== null && until < value.starts_on) {
      ctx.addIssue({ code: 'custom', path: ['rrule'], message: 'until_before_start' });
    }
  });

export type ClassSchedulePatch = z.infer<typeof ClassSchedulePatchSchema>;

// ---------------------------------------------------------------------------
// La semaine affichée
// ---------------------------------------------------------------------------

/**
 * Une date de calendrier bien formée, telle qu'elle arrive d'une URL.
 *
 * Elle vivait dans la couche web, seule de sa famille — et c'est **elle** qui
 * s'est cassée : une expression régulière dont les antislashs avaient sauté à
 * l'écriture (`/^d{4}-.../` au lieu de `/^d{4}-.../`) acceptait la chaîne
 * littérale « dddd-dd-dd » et refusait toute vraie date. Le planning retombait
 * donc silencieusement sur la semaine courante, quel que soit le lien suivi.
 *
 * Aucun test ne l'a vu, pour une raison simple : ses sœurs `mondayOf()`,
 * `weekDates()` et `shiftWeeks()` sont ici, sous Vitest, et elle non. Le
 * correctif n'est pas l'expression régulière, c'est l'endroit.
 */
export function isCalendarDate(value: string | undefined | null): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // La forme ne suffit pas : `2026-02-30` la respecte et n'existe pas. Le
  // contrôle du calendrier est celui de `UNTIL`, réutilisé plutôt que recopié —
  // deux vérifications de date à tenir à jour, c'est une qui finit par mentir.
  return calendarDate(value.replaceAll('-', '')) !== null;
}

/**
 * Le lundi de la semaine contenant `date`, en `YYYY-MM-DD`.
 *
 * Tout se fait en UTC **volontairement** : ces dates sont des étiquettes de
 * calendrier, pas des instants. Passer par l'heure locale du navigateur ferait
 * changer de semaine selon le fuseau de la personne qui regarde, alors que la
 * semaine affichée est celle de la box.
 */
export function mondayOf(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  const isoDow = parsed.getUTCDay() === 0 ? 7 : parsed.getUTCDay();
  parsed.setUTCDate(parsed.getUTCDate() - (isoDow - 1));
  return parsed.toISOString().slice(0, 10);
}

/** Les sept dates d'une semaine, du lundi au dimanche. */
export function weekDates(monday: string): string[] {
  const start = new Date(`${monday}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

/** Décale d'un nombre de semaines. Négatif pour reculer. */
export function shiftWeeks(monday: string, weeks: number): string {
  const start = new Date(`${monday}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + weeks * 7);
  return start.toISOString().slice(0, 10);
}
