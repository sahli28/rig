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
import type { PluralKey, TranslationKey } from '../i18n/types';
import { tenantScope } from './active-tenant';
import type { RackClient } from './client';
import { localizedText } from './box-settings';
import { CoachRowSchema, coachDisplayName } from './planning';

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

export interface AffordanceInput {
  klass: AffordanceClass;
  rules: AffordanceRules;
  /** Injecté : un écran qui lit l'heure lui-même n'est pas testable aux bornes. */
  now: Date;
  alreadyBooked: boolean;
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
  | { kind: 'full' };

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
  const { klass, rules, now, alreadyBooked, upcomingCount, online, origin } = input;

  if (!online || origin === 'cache') return { kind: 'offline' };
  if (klass.status !== 'SCHEDULED') return { kind: 'cancelled' };
  if (alreadyBooked) return { kind: 'already_booked' };

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
  }
}

/** La phrase sous le bouton, et le nombre qu'elle contient. `null` si tout va bien. */
export function affordanceHint(
  affordance: BookingAffordance,
): { key: TranslationKey | PluralKey; count?: number } | null {
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
    // Pas de promesse : ni « reviens plus tard » — rien ne se libère avant
    // P1-004 — ni « demande à ta box », qui ne peut placer personne. Une porte
    // de sortie à la place, et l'écran la fournit.
    case 'full':
      return { key: 'booking.full_hint' };
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
  /** La réservation de la personne sur ce cours, si elle existe. */
  myBookingId: string | null;
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

  const [classes, types, rooms, coaches, bookings] = await Promise.all([
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
  ]);

  if (classes.error !== null) throw classes.error;

  const row = (classes.data ?? [])[0];
  if (row === undefined) return null;

  const type = (types.data ?? []).find((t) => t.id === row.class_type_id);
  const room = (rooms.data ?? []).find((r) => r.id === row.room_id);
  const coach = CoachRowSchema.array()
    .parse(coaches.data ?? [])
    .find((c) => c.membership_id === row.coach_membership_id);

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
    myBookingId: bookings.data?.id ?? null,
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
