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

import { z } from 'zod';
import { dateTimeFormat } from '../i18n/intl';
import type { TranslationKey } from '../i18n/types';
import { tenantScope } from './active-tenant';
import { localizedText } from './box-settings';
import type { RigClient } from './client';
import type { RruleDay } from './class-schedules';
import { shiftDays, weekDates } from './class-schedules';

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
  const formatter = dateTimeFormat('en-CA', {
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
    `${dateTimeFormat('sv-SE', { timeZone, dateStyle: 'short', timeStyle: 'medium' })
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

// ---------------------------------------------------------------------------
// La journée d'un membre
// ---------------------------------------------------------------------------

/**
 * Ce que l'écran mobile affiche pour une journée, et **rien de plus**.
 *
 * Cette forme est aussi celle qui part en cache sur l'appareil, hors RLS. Elle
 * est donc dessinée par la contrainte 1 de P1-002b plutôt que par le confort :
 * ni adresse, ni inscrit, ni note de coach, ni jeton. Un champ ajouté ici est un
 * champ qui finira dans un `AsyncStorage` que plus aucune policy ne protège.
 */
export interface DayClass {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  status: 'SCHEDULED' | 'CANCELLED';
  cancellation_reason: string | null;
  className: string;
  classColor: string;
  roomName: string;
  /**
   * « Sarah D. » — prénom et initiale, jamais le nom complet ni l'adresse.
   *
   * Vide quand la box n'a pas renseigné de coach, ou quand l'appelant n'a pas
   * le droit de le lire : l'écran affiche alors le cours sans coach plutôt que
   * de refuser la journée entière.
   */
  coachName: string;
}

/** Une journée telle qu'elle s'affiche, cache compris. */
export interface DaySchedule {
  /** Le jour, en `YYYY-MM-DD` **local de la box**. */
  date: string;
  classes: DayClass[];
  /** Instant de la lecture réussie. C'est lui que l'écran affiche hors ligne. */
  fetchedAt: string;
}

/**
 * Schéma du cache. **Une lecture de cache n'est pas une lecture de confiance.**
 *
 * Ce que `AsyncStorage` rend a été écrit par une version antérieure de l'app,
 * peut-être d'un autre schéma, et rien ne garantit sa forme. Sans validation,
 * un champ manquant traverse jusqu'au rendu et casse un écran **hors ligne** —
 * c'est-à-dire au moment où l'on peut le moins se le permettre. Un cache
 * illisible se jette ; il ne se devine pas.
 */
export const DayScheduleSchema = z.object({
  date: z.string(),
  fetchedAt: z.string(),
  classes: z.array(
    z.object({
      id: z.string(),
      starts_at: z.string(),
      ends_at: z.string(),
      capacity: z.number(),
      booked_count: z.number(),
      status: z.enum(['SCHEDULED', 'CANCELLED']),
      cancellation_reason: z.string().nullable(),
      className: z.string(),
      classColor: z.string(),
      roomName: z.string(),
      coachName: z.string(),
    }),
  ),
});

/**
 * La journée d'une box, lue en base.
 *
 * Les bornes sont les **instants** qui encadrent le jour local de la box, pas
 * une comparaison de dates en UTC : sinon un cours de 20 h le 3 septembre à
 * Sydney tombe le 4 pour la requête et le 3 pour l'affichage. Même raisonnement
 * que la grille du web, et désormais le même code.
 *
 * Quatre lectures en parallèle plutôt qu'une jointure PostgREST : `class_types`,
 * `rooms` et `tenant_coaches` sont des référentiels de quelques lignes, déjà
 * filtrés par la RLS, et les demander à part garde `tenantScope()` sur son
 * chemin — celui qui pose `.eq('tenant_id', …)` sans qu'on ait à y penser
 * (`.claude/rules/api.md`).
 *
 * `tenant_coaches` ne rend qu'un prénom et une initiale (P1-010). C'est la seule
 * source d'identité qu'un membre peut lire, et c'est délibéré : la règle
 * d'exposition est dans `.claude/rules/privacy.md`.
 */
/**
 * **Cinq secondes, et pas de « ça finira bien par répondre ».**
 *
 * Sans délai explicite, l'écran attend que le système d'exploitation abandonne,
 * et ce délai n'est pas le même deux fois : la passe du 4 septembre 2026 a vu,
 * pour un même geste hors ligne, tantôt des squelettes très longtemps, tantôt
 * « Planning indisponible », tantôt rien. L'état final était correct ; c'est le
 * **chemin** qui était indéterminé.
 *
 * Pourquoi cinq. Le p95 visé pour une écriture de réservation est de 800 ms
 * (P1-003) ; une lecture de journée est plus légère. Cinq secondes valent donc
 * plus de six fois la pire latence acceptable : ce délai ne peut pas couper une
 * requête qui allait aboutir. Et il reste sous les dix secondes à partir
 * desquelles on tue une app plutôt que de l'attendre.
 *
 * Le cas visé n'est pas le mode avion — là, l'app sait qu'elle est hors ligne et
 * ne part même pas. C'est le **wifi qui capte mal dans un sous-sol de box** :
 * le réseau se déclare connecté et ne répond jamais.
 */
export const DAY_SCHEDULE_TIMEOUT_MS = 5_000;

export async function fetchDaySchedule(
  client: RigClient,
  {
    tenantId,
    date,
    timeZone,
    locale,
    timeoutMs = DAY_SCHEDULE_TIMEOUT_MS,
  }: {
    tenantId: string;
    date: string;
    timeZone: string;
    locale: string;
    /** Injectable pour les tests : rien d'autre ne doit le changer. */
    timeoutMs?: number;
  },
): Promise<DaySchedule> {
  const scope = tenantScope(client, tenantId);

  /**
   * **Supposition sur le moteur : `AbortController` existe.**
   *
   * React Native le fournit avec son `fetch`, et le runtime « winter » d'Expo
   * pose `AbortSignal`. Assumé, pas prouvé sur appareil — au même titre que les
   * globales recensées dans `packages/core/src/i18n/intl.ts`, et pour la même
   * raison : nos tests tournent sous Node. Voir `D-010`.
   *
   * `AbortSignal.timeout()` aurait tenu en une ligne et **n'est pas utilisé** :
   * c'est une statique récente, exactement le genre d'hypothèse qui a coûté un
   * plantage la semaine dernière. Un `AbortController` et un `setTimeout` ne
   * supposent rien de neuf.
   */
  const abandon = new AbortController();
  const minuterie = setTimeout(() => abandon.abort(), timeoutMs);

  try {
    const [classesRows, typesRows, roomsRows, coachesRows] = await Promise.all([
      scope
        .select('classes')
        .is('deleted_at', null)
        .gte('starts_at', instantLocal(`${date}T00:00:00`, timeZone))
        .lt('starts_at', instantLocal(`${shiftDays(date, 1)}T00:00:00`, timeZone))
        .order('starts_at')
        .abortSignal(abandon.signal),
      scope.select('class_types').is('deleted_at', null).abortSignal(abandon.signal),
      scope.select('rooms').is('deleted_at', null).abortSignal(abandon.signal),
      scope.selectView('tenant_coaches').abortSignal(abandon.signal),
    ]);

    if (classesRows.error !== null) throw classesRows.error;

    const types = new Map(
      (typesRows.data ?? []).map((row) => [
        row.id,
        { label: localizedText(row.name_i18n, locale), color: row.color },
      ]),
    );
    const rooms = new Map((roomsRows.data ?? []).map((row) => [row.id, row.name]));
    const coaches = new Map(
      CoachRowSchema.array()
        .parse(coachesRows.data ?? [])
        .map((row) => [row.membership_id, coachDisplayName(row)]),
    );

    return {
      date,
      fetchedAt: new Date().toISOString(),
      classes: (classesRows.data ?? []).map((row) => ({
        id: row.id,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        capacity: row.capacity,
        booked_count: row.booked_count,
        status: row.status,
        cancellation_reason: row.cancellation_reason,
        className: types.get(row.class_type_id)?.label ?? '',
        classColor: types.get(row.class_type_id)?.color ?? '',
        roomName: rooms.get(row.room_id) ?? '',
        coachName: coaches.get(row.coach_membership_id) ?? '',
      })),
    };
  } finally {
    // Toujours, y compris quand la requête a abouti : une minuterie qui survit
    // garde le processus JavaScript éveillé pour rien.
    clearTimeout(minuterie);
  }
}

/**
 * Ce que `tenant_coaches` rend. Zod comme frontière de type, comme l'écran
 * Staff : `selectView()` rend des lignes `GenericStringError` faute de liste de
 * colonnes — c'est le compromis assumé d'`active-tenant.ts`, où typer les
 * colonnes fait exploser `tsc` en « heap out of memory ».
 */
export const CoachRowSchema = z.object({
  membership_id: z.string(),
  first_name: z.string().nullable(),
  last_initial: z.string().nullable(),
});

/**
 * « Sarah D. » — et rien de plus.
 *
 * La composition est ici plutôt qu'en base parce que c'est de la présentation,
 * et ici plutôt que dans chaque écran parce que le planning et le détail d'un
 * cours l'afficheront tous les deux. Ce qui **n'est pas** ici : le nom complet.
 * Il n'existe pas dans la vue, donc aucune version de cette fonction ne peut le
 * reconstituer.
 */
export function coachDisplayName(coach: {
  first_name: string | null;
  last_initial: string | null;
}): string {
  const prenom = coach.first_name?.trim() ?? '';
  const initiale = coach.last_initial?.trim() ?? '';
  if (prenom === '') return '';
  return initiale === '' ? prenom : `${prenom} ${initiale}.`;
}

/** Places restantes, jamais négatives — le compteur est borné en base, l'écran ne parie pas dessus. */
export function seatsLeft(item: Pick<DayClass, 'capacity' | 'booked_count'>): number {
  return Math.max(0, item.capacity - item.booked_count);
}
