/**
 * Réserver un cours — l'appelant de `book_class()`, et la décision qui le
 * précède.
 *
 * **Deux responsabilités, et il faut voir pourquoi elles sont ensemble.**
 *
 * 1. `bookClass()` appelle la fonction SQL. Elle ne décide de rien : la base
 *    verrouille la ligne, compte les places et tranche. C'est la règle 3 —
 *    jamais de lecture-puis-écriture en TypeScript ;
 * 2. `bookingAffordance()` décide **ce que l'écran propose** avant l'appel :
 *    réservable, complet, fenêtre close, plafond atteint… Elle ne protège rien
 *    — un client ne protège jamais rien (règle 2) — elle évite de proposer une
 *    action que la base refusera.
 *
 * **L'écran n'a le droit de se tromper que dans un sens.** Proposer une action
 * qui échouera est un désagrément : le refus arrive, traduit, et la place
 * revient à sa valeur réelle. Refuser une action que la base aurait acceptée est
 * un bug invisible — personne ne signale un bouton qu'il n'a pas pu toucher.
 * D'où deux règles suivies à la lettre ici : **l'ordre des cas est celui du
 * SQL**, et les fenêtres se comparent en **instants**, comme dans
 * `book_class()`, jamais en dates locales.
 *
 * La clé d'idempotence (règle 4) n'est pas générée ici : elle vit dans l'état de
 * l'écran, **du premier tap jusqu'à la réponse**. Générée dans la fonction
 * d'envoi, elle changerait à chaque nouvel essai et ne protégerait de rien —
 * c'est précisément le cas du réseau lent que la règle vise.
 */

import { z } from 'zod';
import { UNKNOWN_ERROR_MESSAGE_KEY, appErrorCodeOf, errorMessageKey } from '../errors';
import type { AppErrorCode } from '../errors';
import type { PluralKey, TranslationKey, TranslationValues } from '../i18n/types';
import { tenantScope } from './active-tenant';
import { fetchClassWorkout } from './workouts';
import type { RackClient } from './client';
import { localizedText } from './box-settings';
import { CoachRowSchema, coachDisplayName, instantLocal, localDay } from './planning';
import { shiftDays } from './class-schedules';

// ---------------------------------------------------------------------------
// La décision, avant l'appel
// ---------------------------------------------------------------------------

/** Ce qu'il faut savoir d'un cours pour décider si on peut le réserver. */
export interface AffordanceClass {
  starts_at: string;
  capacity: number;
  booked_count: number;
  status: 'SCHEDULED' | 'CANCELLED';
}

/** Les réglages de la box, tels que `me()` les rend. */
export interface AffordanceRules {
  open_days_before: number;
  close_minutes_before: number;
  max_upcoming_bookings: number;
}

/**
 * L'entrée de liste d'attente **active** de la personne sur ce cours, ou `null`.
 *
 * Une seule peut être active à la fois (unique partiel `WAITING`/`OFFERED`).
 * `position` est le **rang dérivé** rendu par `my_waitlist_rank` — pas la clé
 * d'insertion `position` de la table, qui n'est pas un rang. `total` est
 * `classes.waitlist_count`.
 */
export interface MyWaitlistEntry {
  entryId: string;
  status: 'WAITING' | 'OFFERED';
  position: number;
  total: number;
  /** Fin de l'offre — non-null seulement quand `status === 'OFFERED'`. */
  expiresAt: string | null;
}

export interface AffordanceInput {
  klass: AffordanceClass;
  rules: AffordanceRules;
  /** Injecté : un écran qui lit l'heure lui-même n'est pas testable aux bornes. */
  now: Date;
  alreadyBooked: boolean;
  /**
   * L'entrée de liste d'attente active de la personne, si elle en a une.
   * Optionnel : c'est une lecture **en plus** (mon entrée + mon rang) que tout
   * appelant n'a pas — absent ou `null` vaut « pas sur la liste », le défaut sûr.
   * L'union force malgré tout `affordanceLabelKey`/`affordanceHint` à traiter les
   * deux états, et les tests les exercent explicitement.
   */
  myWaitlist?: MyWaitlistEntry | null;
  /** Réservations à venir de la personne, tous cours confondus. */
  upcomingCount: number;
  online: boolean;
  /** D'où vient la journée affichée. Le cache ne fait jamais autorité sur une place. */
  origin: 'network' | 'cache';
}

/**
 * Ce que l'écran propose. Une union discriminée plutôt qu'un booléen et un
 * message : le jour où un état s'ajoute, le compilateur nomme les endroits à
 * mettre à jour.
 */
export type BookingAffordance =
  | { kind: 'bookable'; seatsLeft: number }
  | { kind: 'offline' }
  | { kind: 'cancelled' }
  | { kind: 'already_booked' }
  | { kind: 'window_closed'; minutes: number }
  | { kind: 'window_not_open'; days: number }
  | { kind: 'cap_reached'; upcoming: number }
  // `full` n'est plus une impasse : le cours est complet **et rejoignable**.
  | { kind: 'full' }
  // Sur la liste, en attente : rang dérivé et longueur, pour « 2ᵉ sur 5 ».
  | { kind: 'on_waitlist'; position: number; total: number }
  // Une place est offerte à la personne : elle a `entryId` pour la confirmer et
  // `expiresAt` pour le compte à rebours.
  | { kind: 'promotion_offered'; entryId: string; expiresAt: string | null };

const MINUTE_MS = 60_000;
const JOUR_MS = 86_400_000;

/**
 * **L'ordre est celui de `book_class()`, et ce n'est pas un détail de style.**
 *
 * Le SQL vérifie, dans cet ordre : le cours est-il annulé, la personne a-t-elle
 * déjà sa place, a-t-elle le droit de réserver, la fenêtre est-elle ouverte, le
 * plafond est-il atteint, reste-t-il une place. Un écran qui inverserait deux
 * de ces cas dirait autre chose que ce que la base fera — et c'est exactement
 * le défaut que le SQL a corrigé chez lui : « ce cours est complet » répondu à
 * quelqu'un qui **avait** sa place.
 *
 * Deux différences assumées :
 *
 * - **le hors ligne passe avant tout.** Il n'existe pas côté base, et pour
 *   cause : sans réseau, il n'y a pas d'appel. Un cours affiché depuis le cache
 *   est dans le même cas — ses places datent, et proposer d'agir dessus serait
 *   le mensonge que P1-002b a passé un lot à rendre impossible ;
 * - **`NO_VALID_ENTITLEMENT` n'est pas ici.** `member_has_booking_right()` rend
 *   vrai pour toute appartenance `ACTIVE`, et `current_tenant_ids()` — base de
 *   toutes les policies — exige `ACTIVE` aussi : un membre suspendu ne voit
 *   aucun cours, donc n'atteint jamais cet écran. Le code est traité à l'arrivée
 *   (une suspension peut tomber entre l'affichage et le tap), pas anticipé.
 */
export function bookingAffordance(input: AffordanceInput): BookingAffordance {
  const { klass, rules, now, alreadyBooked, myWaitlist, upcomingCount, online, origin } = input;

  if (!online || origin === 'cache') return { kind: 'offline' };
  if (klass.status !== 'SCHEDULED') return { kind: 'cancelled' };
  if (alreadyBooked) return { kind: 'already_booked' };

  // **Ma liste d'attente passe avant les refus de fenêtre et de plafond.** Qui a
  // déjà une entrée active n'est plus dans le flux « réserver » : lui répondre
  // « fenêtre close » ou « plafond atteint » cacherait ce qui le concerne — sa
  // place offerte ou son rang. L'offre en premier : elle a un compte à rebours.
  // Les deux sont exclusives d'`already_booked` (une entrée active suppose
  // qu'on n'a pas de réservation confirmée sur ce cours).
  if (myWaitlist?.status === 'OFFERED') {
    return {
      kind: 'promotion_offered',
      entryId: myWaitlist.entryId,
      expiresAt: myWaitlist.expiresAt,
    };
  }
  if (myWaitlist?.status === 'WAITING') {
    return { kind: 'on_waitlist', position: myWaitlist.position, total: myWaitlist.total };
  }

  const départ = new Date(klass.starts_at).getTime() - now.getTime();

  // `<` et non `<=` : le SQL compare `starts_at - now() < close_minutes_before`.
  // À la seconde près, la base accepte encore — l'écran doit accepter aussi.
  if (départ < rules.close_minutes_before * MINUTE_MS) {
    return { kind: 'window_closed', minutes: rules.close_minutes_before };
  }

  if (départ > rules.open_days_before * JOUR_MS) {
    return { kind: 'window_not_open', days: rules.open_days_before };
  }

  if (upcomingCount >= rules.max_upcoming_bookings) {
    return { kind: 'cap_reached', upcoming: upcomingCount };
  }

  if (klass.booked_count >= klass.capacity) return { kind: 'full' };

  return { kind: 'bookable', seatsLeft: klass.capacity - klass.booked_count };
}

/**
 * Le libellé du bouton. Une table, et non des `t()` éparpillés dans l'écran :
 * c'est ce qui permet de vérifier d'un test que **chaque état a des mots**.
 */
export function affordanceLabelKey(affordance: BookingAffordance): TranslationKey {
  switch (affordance.kind) {
    case 'bookable':
      return 'booking.book';
    case 'offline':
      return 'planning.offline_title';
    case 'cancelled':
      return 'booking.cancelled';
    case 'already_booked':
      return 'booking.booked';
    case 'window_closed':
      return 'booking.window_closed';
    case 'window_not_open':
      return 'booking.window_not_open';
    case 'cap_reached':
      return 'booking.cap_reached';
    case 'full':
      return 'booking.full_title';
    case 'on_waitlist':
      return 'booking.on_waitlist_title';
    case 'promotion_offered':
      return 'booking.promotion_offered_title';
  }
}

/** La phrase sous le bouton, et le nombre qu'elle contient. `null` si tout va bien. */
export function affordanceHint(
  affordance: BookingAffordance,
): { key: TranslationKey | PluralKey; count?: number; values?: TranslationValues } | null {
  switch (affordance.kind) {
    case 'bookable':
      return null;
    case 'offline':
      return { key: 'booking.offline_hint' };
    case 'cancelled':
      return { key: 'booking.cancelled_hint' };
    case 'already_booked':
      return { key: 'booking.booked_hint' };
    // Les trois refus chiffrés portent la valeur **des réglages de la box**, pas
    // une constante recopiée dans la phrase : une box qui ferme à 60 minutes
    // doit lire 60.
    case 'window_closed':
      return { key: 'booking.window_closed_hint', count: affordance.minutes };
    case 'window_not_open':
      return { key: 'booking.window_not_open_hint', count: affordance.days };
    case 'cap_reached':
      return { key: 'booking.cap_reached_hint', count: affordance.upcoming };
    // Complet, mais plus une impasse : on invite à rejoindre la liste. Le
    // libellé du bouton et l'annonce vivent côté écran ; ici, la phrase qui
    // explique ce qu'est cette liste (« on te prévient… »).
    case 'full':
      return { key: 'booking.full_hint' };
    // « 2ᵉ sur 5 ». Le pluriel se joue sur `total` (seul, la phrase change), et
    // `{position}`/`{total}` s'interpolent tous deux — d'où le sac `values`.
    case 'on_waitlist':
      return {
        key: 'waitlist.position',
        count: affordance.total,
        values: { position: affordance.position, total: affordance.total },
      };
    // Le compte à rebours et le bouton « Confirmer » sont côté écran ; ici, ce
    // qui explique l'urgence.
    case 'promotion_offered':
      return { key: 'booking.confirm_spot_hint' };
  }
}

// ---------------------------------------------------------------------------
// L'appel
// ---------------------------------------------------------------------------

/**
 * Un refus de réservation, traduit à la frontière.
 *
 * L'écran n'a alors qu'une chose à faire : `t(erreur.messageKey)`. Il ne voit
 * jamais le message de la base — technique, anglais, et parfois révélateur du
 * schéma (§12.3).
 */
export class BookingFailed extends Error {
  readonly code: AppErrorCode | null;
  readonly messageKey: TranslationKey;

  constructor(code: AppErrorCode | null, messageKey: TranslationKey, cause?: unknown) {
    super(`Réservation refusée : ${code ?? 'inconnu'}`);
    this.name = 'BookingFailed';
    this.code = code;
    this.messageKey = messageKey;
    this.cause = cause;
  }
}

export interface BookClassInput {
  classId: string;
  membershipId: string;
  /** Générée **au tap** par `uuidV7()`, conservée jusqu'à la réponse (règle 4). */
  idempotencyKey: string;
}

export interface BookClassOptions {
  /**
   * Reçoit la durée de l'appel en millisecondes.
   *
   * Un rappel plutôt qu'un `console.log` : `packages/core` ne suppose rien de
   * son hôte, et c'est l'app qui décide d'écrire — en développement seulement.
   * Sans lui, « p95 mesuré sur vingt appels » redevient une impression.
   */
  onDuration?: (ms: number) => void;
}

const IdentifiantRéservation = z.string().uuid();

export async function bookClass(
  client: RackClient,
  input: BookClassInput,
  options: BookClassOptions = {},
): Promise<string> {
  const début = Date.now();

  try {
    const { data, error } = await client.rpc('book_class', {
      p_class_id: input.classId,
      p_membership_id: input.membershipId,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error !== null) {
      const code = appErrorCodeOf(error);
      throw new BookingFailed(code, errorMessageKey(code), error);
    }

    const parsed = IdentifiantRéservation.safeParse(data);
    if (!parsed.success) {
      // PostgREST rend `null` sans erreur si la fonction ne rend rien. Traiter ça
      // comme une réussite afficherait « c'est réservé » sur une place qui
      // n'existe pas — le mensonge exact que P1-003 a rendu impossible côté base.
      throw new BookingFailed(null, UNKNOWN_ERROR_MESSAGE_KEY, data);
    }

    return parsed.data;
  } catch (cause) {
    // Une panne réseau n'est pas un refus métier, mais l'écran n'a qu'un endroit
    // pour afficher : elle ressort **traduite**, jamais masquée ni avalée.
    if (cause instanceof BookingFailed) throw cause;
    throw new BookingFailed(null, UNKNOWN_ERROR_MESSAGE_KEY, cause);
  } finally {
    options.onDuration?.(Date.now() - début);
  }
}

// ---------------------------------------------------------------------------
// Ce que les écrans lisent
// ---------------------------------------------------------------------------

/** Un cours, tel que l'écran de détail l'affiche. */
export interface ClassDetail {
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
  coachName: string;
  /** Combien attendent une place (P1-006). Sert de `total` à l'affichage du rang. */
  waitlistCount: number;
  /** La réservation de la personne sur ce cours, si elle existe. */
  myBookingId: string | null;
  /**
   * L'entrée de liste d'attente **active** de la personne sur ce cours (P1-006),
   * rang dérivé compris, ou `null`. C'est ce que `bookingAffordance` consomme
   * pour proposer « quitter la liste » ou « confirmer ma place ».
   */
  myWaitlist: MyWaitlistEntry | null;
  /**
   * La séance écrite par le coach (P1-015), **publiée seulement**.
   *
   * Un brouillon n'arrive jamais jusqu'ici : la policy le retient. L'écran n'a
   * donc rien à filtrer, et il ne peut pas se tromper en oubliant de le faire.
   */
  workoutTitle: string | null;
  workoutBody: string | null;
}

/**
 * Un cours et son entourage, pour l'écran de détail.
 *
 * Quatre lectures parallèles plutôt qu'une jointure, comme `fetchDaySchedule` :
 * les référentiels sont minuscules, déjà filtrés par la RLS, et les demander à
 * part garde `tenantScope()` sur son chemin (`.claude/rules/api.md`).
 *
 * `bookings` passe par `tenantScope` comme le reste : elle **a** un `tenant_id`,
 * donc elle relève exactement du piège que le helper existe pour fermer. La
 * policy `bookings_own_select` borne déjà à ses propres réservations — mais la
 * RLS ne garde pas dans la **box active**, et Julie est membre de deux boxes.
 */
export async function fetchClassDetail(
  client: RackClient,
  {
    tenantId,
    classId,
    membershipId,
    locale,
  }: { tenantId: string; classId: string; membershipId: string; locale: string },
): Promise<ClassDetail | null> {
  const scope = tenantScope(client, tenantId);

  const [classes, types, rooms, coaches, bookings, waitlist, rang, seance] = await Promise.all([
    scope.select('classes').eq('id', classId).is('deleted_at', null),
    scope.select('class_types').is('deleted_at', null),
    scope.select('rooms').is('deleted_at', null),
    scope.selectView('tenant_coaches'),
    scope
      .select('bookings')
      .eq('class_id', classId)
      .eq('membership_id', membershipId)
      .eq('status', 'CONFIRMED')
      .maybeSingle(),
    // Mon entrée **active** de liste d'attente (au plus une, unique partiel).
    // La RLS `waitlist_own_select` la borne à moi ; le rang, lui, ne se lit pas
    // ainsi (je ne vois pas les lignes des autres) — d'où l'appel séparé.
    scope
      .select('waitlist_entries')
      .eq('class_id', classId)
      .eq('membership_id', membershipId)
      .in('status', ['WAITING', 'OFFERED'])
      .maybeSingle(),
    client.rpc('my_waitlist_rank', { p_class_id: classId }),
    fetchClassWorkout(client, { tenantId, classId }),
  ]);

  if (classes.error !== null) throw classes.error;

  const row = (classes.data ?? [])[0];
  if (row === undefined) return null;

  const type = (types.data ?? []).find((t) => t.id === row.class_type_id);
  const room = (rooms.data ?? []).find((r) => r.id === row.room_id);
  const coach = CoachRowSchema.array()
    .parse(coaches.data ?? [])
    .find((c) => c.membership_id === row.coach_membership_id);

  // Mon état de liste d'attente. `waitlist.data` est null si je n'y suis pas ;
  // `rang.data` est le rang dérivé (`my_waitlist_rank`). Si l'un des deux échoue
  // (réseau, course), on retombe sur « pas sur la liste » ou un rang de secours
  // plutôt que de masquer le cours entier — le temps réel corrige ensuite. Le
  // filtre `.in` garantit un statut actif : on le rétrécit sans cast risqué.
  const entree = waitlist.data;
  const myWaitlist: MyWaitlistEntry | null =
    entree == null
      ? null
      : {
          entryId: entree.id,
          status: entree.status === 'OFFERED' ? 'OFFERED' : 'WAITING',
          position: typeof rang.data === 'number' ? rang.data : 1,
          total: row.waitlist_count,
          expiresAt: entree.expires_at,
        };

  return {
    id: row.id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    capacity: row.capacity,
    booked_count: row.booked_count,
    status: row.status,
    cancellation_reason: row.cancellation_reason,
    className: type === undefined ? '' : localizedText(type.name_i18n, locale),
    classColor: type?.color ?? '',
    roomName: room?.name ?? '',
    coachName: coach === undefined ? '' : coachDisplayName(coach),
    waitlistCount: row.waitlist_count,
    myBookingId: bookings.data?.id ?? null,
    myWaitlist,
    // **La séance, si elle est publiée** (P1-015). La RLS décide : un brouillon
    // n'arrive tout simplement pas ici, il n'y a rien à filtrer côté écran.
    workoutTitle: seance === null ? null : seance.title?.trim() || null,
    workoutBody: seance?.body ?? null,
  };
}

/** Une réservation à venir, telle que « Mes réservations » l'affiche. */
export interface UpcomingBooking {
  bookingId: string;
  classId: string;
  starts_at: string;
  ends_at: string;
  className: string;
  roomName: string;
  coachName: string;
}

/**
 * Les cours à venir de la personne, du plus proche au plus lointain.
 *
 * **C'est aussi le compteur du plafond** (`max_upcoming_bookings`) : la longueur
 * de cette liste est exactement ce que `book_class()` compte. Une seconde
 * requête pour le nombre donnerait deux vérités à synchroniser.
 */
export async function fetchUpcomingBookings(
  client: RackClient,
  {
    tenantId,
    membershipId,
    locale,
    now = new Date(),
  }: { tenantId: string; membershipId: string; locale: string; now?: Date },
): Promise<UpcomingBooking[]> {
  const scope = tenantScope(client, tenantId);

  const { data: rows, error } = await scope
    .select('bookings')
    .eq('membership_id', membershipId)
    .eq('status', 'CONFIRMED');

  if (error !== null) throw error;

  const parIdentifiant = new Map((rows ?? []).map((row) => [row.class_id, row.id]));
  if (parIdentifiant.size === 0) return [];

  const [classes, types, rooms, coaches] = await Promise.all([
    scope
      .select('classes')
      .is('deleted_at', null)
      .gt('starts_at', now.toISOString())
      .order('starts_at'),
    scope.select('class_types').is('deleted_at', null),
    scope.select('rooms').is('deleted_at', null),
    scope.selectView('tenant_coaches'),
  ]);

  if (classes.error !== null) throw classes.error;

  const typesParId = new Map((types.data ?? []).map((t) => [t.id, t]));
  const sallesParId = new Map((rooms.data ?? []).map((r) => [r.id, r.name]));
  const coachsParId = new Map(
    CoachRowSchema.array()
      .parse(coaches.data ?? [])
      .map((c) => [c.membership_id, coachDisplayName(c)]),
  );

  return (classes.data ?? [])
    .filter((row) => parIdentifiant.has(row.id))
    .map((row) => {
      const type = typesParId.get(row.class_type_id);
      return {
        bookingId: parIdentifiant.get(row.id) ?? '',
        classId: row.id,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        className: type === undefined ? '' : localizedText(type.name_i18n, locale),
        roomName: sallesParId.get(row.room_id) ?? '',
        coachName: coachsParId.get(row.coach_membership_id) ?? '',
      };
    });
}

/** Combien de réservations confirmées par jour, en dates locales de la box. */
export type BookedDays = Record<string, string[]>;

/**
 * Les réservations confirmées d'un intervalle, **rangées par jour local de la
 * box** : une date vers les `class_id` réservés ce jour-là (P1-014, P1-012).
 *
 * **Des dates et des identifiants de cours, rien d'autre.** Ni heure, ni nom, ni
 * identifiant de réservation : c'est tout ce que la pastille du calendrier et le
 * badge « Réservé » demandent, et c'est aussi tout ce qui finira dans le cache
 * de l'appareil.
 *
 * **Cette fonction rendait un compte, elle rend maintenant les identifiants**
 * (P1-012). Le compte n'était pas faux, il était juste trop pauvre : il dit « tu
 * as deux choses mardi », pas *lesquelles*, et un badge se pose sur une ligne de
 * cours. Deux façons de combler ça — une seconde lecture par jour, ou élargir
 * celle-ci. C'est la seconde, parce qu'une seule requête sert alors les deux
 * usages et que **le compte devient dérivé** (`ids.length`) : deux valeurs qui
 * ne peuvent plus se contredire valent mieux que deux valeurs à synchroniser.
 *
 * **Pourquoi une fonction de plus, et pas `fetchUpcomingBookings()`.** Celle-ci
 * lit **toutes** les réservations de la personne, puis ne garde que les cours
 * `starts_at > now()`. Elle ne sait pas regarder en arrière, et c'est exactement
 * la moitié de ce que la grille du mois doit montrer : « j'ai réservé plusieurs
 * jours ce mois-ci » est une question d'historique. Élargir l'autre fonction
 * aurait fait porter deux besoins à un seul lecteur, dont l'un est un **plafond
 * de réservations à venir** — celui de `book_class()`. Ce compteur-là ne doit
 * jamais se mettre à compter le passé.
 *
 * **Les bornes sont locales, la requête est en instants.** `from` et `to` sont
 * des étiquettes de calendrier de la box (`AAAA-MM-JJ`, `to` inclus) ;
 * `instantLocal()` les convertit en instants UTC pour filtrer `starts_at`.
 * Filtrer sur une chaîne UTC ferait manquer les cours de fin de soirée et
 * déborder sur le mois suivant — deux fois par an, et seulement en production.
 */
export async function fetchBookedDays(
  client: RackClient,
  {
    tenantId,
    membershipId,
    timeZone,
    from,
    to,
  }: {
    tenantId: string;
    membershipId: string;
    timeZone: string;
    /** Premier jour affiché, en date locale de la box. */
    from: string;
    /** Dernier jour affiché, **inclus**. */
    to: string;
  },
): Promise<BookedDays> {
  const scope = tenantScope(client, tenantId);

  const { data: rows, error } = await scope
    .select('bookings')
    .eq('membership_id', membershipId)
    .eq('status', 'CONFIRMED');

  if (error !== null) throw error;

  const reservés = new Set((rows ?? []).map((row) => row.class_id));
  if (reservés.size === 0) return {};

  // Deux requêtes plutôt qu'une jointure : PostgREST n'en fait pas sans
  // relation déclarée, et la première est déjà bornée par la RLS à ses propres
  // réservations. La seconde est bornée par le mois affiché — c'est elle qui
  // empêche « toutes mes réservations depuis toujours » de traverser le réseau.
  const { data: classes, error: erreurCours } = await scope
    .select('classes')
    .is('deleted_at', null)
    .gte('starts_at', instantLocal(`${from}T00:00:00`, timeZone))
    .lt('starts_at', instantLocal(`${shiftDays(to, 1)}T00:00:00`, timeZone));

  if (erreurCours !== null) throw erreurCours;

  const jours: BookedDays = {};
  for (const row of classes ?? []) {
    if (!reservés.has(row.id)) continue;
    // **`localDay()` et pas `starts_at.slice(0, 10)`.** Un cours à 00h30 le
    // 1er octobre à Paris est le 30 septembre à 22h30 en UTC : la découpe de
    // chaîne poserait la pastille sur le mauvais jour, et sur le mauvais
    // **mois** une fois par mois. Règle 9 de `CLAUDE.md`.
    const jour = localDay(row.starts_at, timeZone);
    (jours[jour] ??= []).push(row.id);
  }

  return jours;
}

/**
 * Un inscrit, tel que la feuille l'affiche. Prénom et initiale, rien d'autre.
 *
 * Les noms de champs sont ceux de la vue, en `snake_case`, et c'est délibéré :
 * `coachDisplayName()` compose déjà « Sarah D. » à partir de cette forme
 * exacte. Renommer en `camelCase` aurait obligé à réécrire la composition, ou à
 * la contourner — deux façons de laisser un nom complet réapparaître un jour.
 */
export interface RosterPeer {
  membership_id: string;
  first_name: string | null;
  last_initial: string | null;
}

/**
 * Les inscrits d'un cours — **les gens qu'on croise, pas l'annuaire de la box**.
 *
 * La vue `class_roster` ne rend quelque chose qu'à quelqu'un qui est **lui-même
 * inscrit** à ce cours ; un membre de la même box qui ne l'est pas obtient une
 * liste vide, et c'est le comportement voulu, pas une erreur à rattraper ici.
 * Elle applique aussi l'opposition (`memberships.hidden_from_roster`) : une
 * personne qui s'y est opposée **n'a pas de ligne**, elle n'a pas une ligne
 * anonyme — une case « membre masqué » dirait qu'il y a quelqu'un.
 *
 * Base juridique, portée et raison de chaque colonne : la migration
 * `20260905090000_class_roster.sql` et `.claude/rules/privacy.md`.
 */
export async function fetchClassRoster(
  client: RackClient,
  { tenantId, classId }: { tenantId: string; classId: string },
): Promise<RosterPeer[]> {
  const { data, error } = await tenantScope(client, tenantId)
    .selectView('class_roster')
    .eq('class_id', classId);

  if (error !== null) throw error;

  return RosterRowSchema.array().parse(data ?? []);
}

/**
 * Zod comme frontière de type, comme pour `tenant_coaches` : `selectView()` rend
 * des lignes non typées faute de liste de colonnes — compromis assumé
 * d'`active-tenant.ts`, où typer les colonnes fait exploser `tsc`.
 */
const RosterRowSchema = z.object({
  membership_id: z.string(),
  first_name: z.string().nullable(),
  last_initial: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Annuler — P1-004
// ---------------------------------------------------------------------------

/**
 * Ce que l'écran doit dire **avant** de valider une annulation.
 *
 * Le critère du ticket est « la conséquence est affichée avant validation,
 * jamais après ». Encore faut-il que la conséquence annoncée soit vraie : la
 * spec §12.3 propose « ton crédit sera consommé », et **aucune table de crédits
 * n'existe** avant P2-007. Promettre une conséquence qui n'arrivera pas est
 * pire que ne rien promettre — la personne annule en croyant payer, ou renonce
 * en croyant perdre quelque chose.
 *
 * Le pilote dit donc la vérité du pilote : l'annulation est enregistrée comme
 * tardive, et la box applique sa propre règle hors de l'app.
 */
export type CancelConsequence =
  | { kind: 'free' }
  | { kind: 'late'; minutesBefore: number }
  /**
   * Le cours a commencé : il n'y a plus de geste à proposer. `cancel_booking()`
   * refuse par `CLASS_ALREADY_STARTED`, parce qu'annuler après coup effacerait
   * le no-show de RM3.4 et fausserait le remplissage d'un cours qui a eu lieu.
   *
   * Ce n'est **pas** une décision d'autorisation prise ici (règle 2) : la base
   * refuse, quoi qu'affiche l'écran. Ce cas existe pour que l'écran ne propose
   * pas un bouton dont la seule issue est un refus — et le refus reste géré à
   * l'arrivée, parce qu'un écran ouvert peut traverser l'heure de début.
   */
  | { kind: 'started' };

/**
 * Dans la fenêtre, hors fenêtre, ou trop tard tout court — **les mêmes
 * comparaisons que `cancel_booking()`**, à la minute près.
 *
 * Écrite ici en pur, et injectée de `now`, parce qu'un écran qui lit l'heure
 * lui-même n'est pas testable aux bornes — et que les bornes sont tout le sujet
 * d'une fenêtre. La base reste juge : ce calcul sert à **annoncer**, jamais à
 * décider. Si les deux divergeaient, c'est l'annonce qui aurait tort.
 */
export function cancelConsequence(input: {
  startsAt: string;
  cancelWindowMinutes: number;
  now: Date;
}): CancelConsequence {
  const départ = new Date(input.startsAt).getTime() - input.now.getTime();

  // **Le début d'abord** : la fenêtre juge une annulation possible, le début dit
  // qu'il n'y en a plus. `<= 0` et non `< 0`, comme le `starts_at <= now()` du
  // SQL — à la seconde du début, le cours a commencé.
  if (départ <= 0) return { kind: 'started' };

  // Passé ce point `départ` est strictement positif, donc `minutesBefore` aussi :
  // le `Math.max(0, …)` qu'il y avait ici bornait un négatif que la garde du
  // début rend impossible. Un garde-fou qui ne peut plus se déclencher laisse
  // croire qu'il protège de quelque chose.
  const minutesBefore = Math.floor(départ / MINUTE_MS);

  return minutesBefore >= input.cancelWindowMinutes
    ? { kind: 'free' }
    : { kind: 'late', minutesBefore };
}

/**
 * Annule une réservation.
 *
 * **Pas de clé d'idempotence**, contrairement à `bookClass()`, et ce n'est pas
 * un oubli : réserver *crée* une ligne — il faut donc une clé pour reconnaître
 * deux tentatives de la même création. Annuler *transitionne* une ligne
 * existante vers un état terminal, et son identifiant suffit. Rejouer l'appel
 * rend la même réservation sans rien décrémenter une seconde fois, ce que la
 * base garantit sous son verrou.
 *
 * Les refus remontent traduits, comme pour `bookClass()` : l'écran n'a qu'un
 * endroit pour afficher, et une panne réseau ne doit pas y arriver nue.
 */
export async function cancelBooking(client: RackClient, bookingId: string): Promise<string> {
  try {
    const { data, error } = await client.rpc('cancel_booking', {
      p_booking_id: bookingId,
    });

    if (error !== null) {
      const code = appErrorCodeOf(error);
      throw new BookingFailed(code, errorMessageKey(code), error);
    }

    const parsed = IdentifiantRéservation.safeParse(data);
    if (!parsed.success) {
      // Même raisonnement que `bookClass()` : un `null` sans erreur afficherait
      // « c'est annulé » sur une place toujours prise.
      throw new BookingFailed(null, UNKNOWN_ERROR_MESSAGE_KEY, data);
    }

    return parsed.data;
  } catch (cause) {
    if (cause instanceof BookingFailed) throw cause;
    throw new BookingFailed(null, UNKNOWN_ERROR_MESSAGE_KEY, cause);
  }
}

// ---------------------------------------------------------------------------
// Liste d'attente — P1-006
// ---------------------------------------------------------------------------

export interface JoinWaitlistInput {
  classId: string;
  membershipId: string;
  /** Générée **au tap** par `uuidV7()`, conservée jusqu'à la réponse (règle 4). */
  idempotencyKey: string;
}

/**
 * Rejoint la liste d'attente d'un cours complet.
 *
 * **Clé d'idempotence, comme `bookClass()`** : rejoindre *crée* une ligne, donc
 * un double tap sur un réseau lent ne doit pas produire deux entrées. La base la
 * fait respecter sous son verrou ; l'écran la génère au tap et la garde jusqu'à
 * la réponse. Les refus (`CLASS_NOT_FULL`, `ALREADY_ON_WAITLIST`,
 * `ALREADY_BOOKED`, `BOOKING_WINDOW_CLOSED`, plafond) remontent traduits.
 *
 * Rend l'identifiant de l'entrée de liste d'attente.
 */
export async function joinWaitlist(client: RackClient, input: JoinWaitlistInput): Promise<string> {
  try {
    const { data, error } = await client.rpc('join_waitlist', {
      p_class_id: input.classId,
      p_membership_id: input.membershipId,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error !== null) {
      const code = appErrorCodeOf(error);
      throw new BookingFailed(code, errorMessageKey(code), error);
    }

    const parsed = IdentifiantRéservation.safeParse(data);
    if (!parsed.success) {
      throw new BookingFailed(null, UNKNOWN_ERROR_MESSAGE_KEY, data);
    }

    return parsed.data;
  } catch (cause) {
    if (cause instanceof BookingFailed) throw cause;
    throw new BookingFailed(null, UNKNOWN_ERROR_MESSAGE_KEY, cause);
  }
}

/**
 * Confirme une place offerte par la promotion.
 *
 * **Pas de clé d'idempotence**, comme `cancelBooking()` : l'identifiant de
 * l'entrée suffit. Rejouer l'appel sur une entrée déjà `ACCEPTED` rend le **même**
 * `booking_id` sans créer de seconde réservation — la base le garantit sous son
 * verrou. Une offre expirée remonte `OFFER_EXPIRED`, traduit.
 *
 * Rend l'identifiant de la réservation créée (ou déjà créée).
 */
export async function confirmPromotion(
  client: RackClient,
  waitlistEntryId: string,
): Promise<string> {
  try {
    const { data, error } = await client.rpc('confirm_promotion', {
      p_waitlist_entry_id: waitlistEntryId,
    });

    if (error !== null) {
      const code = appErrorCodeOf(error);
      throw new BookingFailed(code, errorMessageKey(code), error);
    }

    const parsed = IdentifiantRéservation.safeParse(data);
    if (!parsed.success) {
      throw new BookingFailed(null, UNKNOWN_ERROR_MESSAGE_KEY, data);
    }

    return parsed.data;
  } catch (cause) {
    if (cause instanceof BookingFailed) throw cause;
    throw new BookingFailed(null, UNKNOWN_ERROR_MESSAGE_KEY, cause);
  }
}

/**
 * Quitte la liste d'attente — en attente (`WAITING`) ou en refusant une offre
 * (`OFFERED`), auquel cas le siège tenu cascade vers le suivant, côté base.
 *
 * **Pas de clé d'idempotence** : transition d'une ligne existante, comme
 * `cancelBooking()`. Rejouer sur une entrée déjà terminale est sans effet.
 *
 * Rend l'identifiant de l'entrée quittée.
 */
export async function leaveWaitlist(client: RackClient, waitlistEntryId: string): Promise<string> {
  try {
    const { data, error } = await client.rpc('leave_waitlist', {
      p_waitlist_entry_id: waitlistEntryId,
    });

    if (error !== null) {
      const code = appErrorCodeOf(error);
      throw new BookingFailed(code, errorMessageKey(code), error);
    }

    const parsed = IdentifiantRéservation.safeParse(data);
    if (!parsed.success) {
      throw new BookingFailed(null, UNKNOWN_ERROR_MESSAGE_KEY, data);
    }

    return parsed.data;
  } catch (cause) {
    if (cause instanceof BookingFailed) throw cause;
    throw new BookingFailed(null, UNKNOWN_ERROR_MESSAGE_KEY, cause);
  }
}
