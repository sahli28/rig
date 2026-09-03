/**
 * Erreurs : un code, un message traduit, une seule table de correspondance.
 *
 * Le client réagit au **code**, jamais au texte (`.claude/rules/api.md`). Deux
 * sources produisent ces codes :
 *
 * - les **fonctions Postgres** appelées en RPC (ADR 0004 : pas de couche API
 *   avant P1-003). Elles portent leur code applicatif dans le champ `detail`
 *   de l'exception, que PostgREST expose sous `details` ;
 * - la **future couche API**, qui rendra la forme `{ error: { code, ... } }`.
 *
 * Les deux listes se rejoignent ici parce que l'écran, lui, n'en fait qu'une
 * chose : afficher un message. Aucun message n'est écrit en dur — la table
 * pointe vers une clé i18n, et `pnpm i18n:check` vérifie que la clé existe
 * dans les deux langues.
 */

import { translate } from './i18n/translate';
import type { TranslationKey } from './i18n/types';

/**
 * Codes levés par les fonctions SQL, via `public.app_error()`.
 * Doivent rester alignés sur `supabase/migrations/*_app_error_codes.sql` :
 * `errors.test.ts` relit les migrations et échoue si la base en ajoute un
 * que cette liste ignore.
 *
 * Six codes de réservation y sont entrés avec P1-003, et le passage mérite
 * d'être compris : ils vivaient dans `API_ERROR_CODES` — le catalogue de ce
 * que la **couche API** rendra — parce qu'aucune fonction SQL ne les levait
 * encore. `book_class()` les lève désormais, donc leur source a changé, donc
 * leur liste aussi. Ils restent dans les deux, comme `FORBIDDEN_ROLE` : la base
 * les lève **et** l'API les rendra. Les deux listes ne disent pas la même
 * chose — l'une dit « d'où ça vient », l'autre « ce qu'on peut réutiliser ».
 */
export const APP_ERROR_CODES = [
  'ALREADY_BOOKED',
  'ALREADY_MEMBER',
  'APPEND_ONLY',
  'AUTH_REQUIRED',
  'BOOKING_WINDOW_CLOSED',
  'CLASS_FULL',
  'CURRENCY_LOCKED',
  'EMAIL_ALREADY_REGISTERED',
  'EMAIL_IMMUTABLE',
  'FORBIDDEN_ROLE',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IMPORT_EMPTY',
  'IMPORT_INVALID_ROW',
  'IMPORT_TOO_LARGE',
  'INVITATION_ALREADY_PENDING',
  'INVITATION_ALREADY_USED',
  'INVITATION_EMAIL_MISMATCH',
  'INVITATION_EXPIRED',
  'INVITATION_NOT_FOUND',
  'LAST_OWNER',
  'MANAGER_CANNOT_GRANT_ROLE',
  'MANAGER_CANNOT_MODIFY_ADMIN',
  'MAX_UPCOMING_BOOKINGS_REACHED',
  'MEMBERSHIP_NOT_FOUND',
  'MEMBERSHIP_REVOKED',
  'MEMBERSHIP_SUSPENDED',
  'NOT_TENANT_MEMBER',
  'NO_VALID_ENTITLEMENT',
  'PROFILE_NOT_FOUND',
  'TENANT_CLOSED',
  'TENANT_NAME_REQUIRED',
  'TENANT_QUOTA_REACHED',
  'TENANT_SLUG_INVALID',
  'TENANT_SLUG_TAKEN',
  'TENANT_WOULD_BE_ORPHANED',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

/** Codes métier de la couche API. Réutiliser plutôt qu'en réinventer. */
export const API_ERROR_CODES = [
  'CLASS_FULL',
  'NO_VALID_ENTITLEMENT',
  'BOOKING_WINDOW_CLOSED',
  'CANCEL_WINDOW_PASSED',
  'ALREADY_BOOKED',
  'MAX_UPCOMING_BOOKINGS_REACHED',
  'QUOTA_EXCEEDED',
  'TENANT_NOT_FOUND',
  'FORBIDDEN_ROLE',
  'IDEMPOTENCY_KEY_REQUIRED',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Tout code qu'un écran peut avoir à traduire, quelle qu'en soit la source. */
export type ErrorCode = AppErrorCode | ApiErrorCode;

/** Repli : code inconnu, erreur réseau, ou panne qui ne vient pas de `app_error()`. */
export const UNKNOWN_ERROR_MESSAGE_KEY: TranslationKey = 'errors.unknown';

/**
 * Code → clé i18n. La seule table à tenir à jour quand la base gagne un code.
 * Les clés sont écrites littéralement : `pnpm i18n:check` les cherche dans le
 * source, une clé construite dynamiquement passerait pour orpheline.
 */
export const ERROR_MESSAGE_KEYS: Record<ErrorCode, TranslationKey> = {
  // Compte et session
  AUTH_REQUIRED: 'errors.auth_required',
  PROFILE_NOT_FOUND: 'errors.profile_not_found',
  EMAIL_ALREADY_REGISTERED: 'errors.email_already_registered',
  EMAIL_IMMUTABLE: 'errors.email_immutable',

  // Invitation
  INVITATION_NOT_FOUND: 'errors.invitation_not_found',
  INVITATION_EXPIRED: 'errors.invitation_expired',
  INVITATION_ALREADY_USED: 'errors.invitation_already_used',
  INVITATION_ALREADY_PENDING: 'errors.invitation_already_pending',
  INVITATION_EMAIL_MISMATCH: 'errors.invitation_email_mismatch',

  // Appartenance et rôles
  ALREADY_MEMBER: 'errors.already_member',
  MEMBERSHIP_NOT_FOUND: 'errors.membership_not_found',
  MEMBERSHIP_SUSPENDED: 'errors.membership_suspended',
  MEMBERSHIP_REVOKED: 'errors.membership_revoked',
  NOT_TENANT_MEMBER: 'errors.not_tenant_member',
  FORBIDDEN_ROLE: 'errors.forbidden_role',
  MANAGER_CANNOT_GRANT_ROLE: 'errors.manager_cannot_grant_role',
  MANAGER_CANNOT_MODIFY_ADMIN: 'errors.manager_cannot_modify_admin',
  LAST_OWNER: 'errors.last_owner',

  // Box
  TENANT_NOT_FOUND: 'errors.tenant_not_found',
  TENANT_CLOSED: 'errors.tenant_closed',
  TENANT_NAME_REQUIRED: 'errors.tenant_name_required',
  TENANT_SLUG_INVALID: 'errors.tenant_slug_invalid',
  TENANT_SLUG_TAKEN: 'errors.tenant_slug_taken',
  TENANT_QUOTA_REACHED: 'errors.tenant_quota_reached',
  CURRENCY_LOCKED: 'errors.currency_locked',
  TENANT_WOULD_BE_ORPHANED: 'errors.tenant_would_be_orphaned',

  // Import d'effectif (P1-001d)
  IMPORT_EMPTY: 'errors.import_empty',
  IMPORT_INVALID_ROW: 'errors.import_invalid_row',
  IMPORT_TOO_LARGE: 'errors.import_too_large',

  // Réservation — `book_class()` les lève depuis P1-003, l'API les rendra aussi
  CLASS_FULL: 'errors.class_full',
  ALREADY_BOOKED: 'errors.already_booked',
  BOOKING_WINDOW_CLOSED: 'errors.booking_window_closed',
  CANCEL_WINDOW_PASSED: 'errors.cancel_window_passed',
  NO_VALID_ENTITLEMENT: 'errors.no_valid_entitlement',
  MAX_UPCOMING_BOOKINGS_REACHED: 'errors.max_upcoming_bookings_reached',
  QUOTA_EXCEEDED: 'errors.quota_exceeded',

  // Garde-fous techniques
  APPEND_ONLY: 'errors.append_only',
  IDEMPOTENCY_KEY_REQUIRED: 'errors.idempotency_key_required',
};

const APP_CODES: ReadonlySet<string> = new Set<string>(APP_ERROR_CODES);
const MESSAGE_KEYS: Readonly<Record<string, TranslationKey>> = ERROR_MESSAGE_KEYS;

export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === 'string' && APP_CODES.has(value);
}

/**
 * Ce que PostgREST rend quand une fonction SQL lève une exception. Décrit
 * structurellement plutôt qu'importé de `@supabase/supabase-js` : `packages/core`
 * n'a pas à dépendre du SDK pour savoir lire une erreur.
 */
export interface PostgrestErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

/**
 * Extrait le code applicatif d'une erreur PostgREST. `details` porte le JSON
 * construit par `public.app_error()` — mais toute autre erreur Postgres y met
 * du texte libre, donc rien n'est supposé de sa forme.
 *
 * Retourne `null` dès que l'erreur ne vient pas d'`app_error()` : l'appelant
 * affiche alors le message de repli, jamais l'erreur brute.
 */
export function appErrorCodeOf(error: unknown): AppErrorCode | null {
  if (typeof error !== 'object' || error === null) return null;

  const { details } = error as PostgrestErrorLike;
  if (typeof details !== 'string') return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(details);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const { code } = parsed as { code?: unknown };
  return isAppErrorCode(code) ? code : null;
}

/** Clé i18n d'un code. Un code inconnu ne casse pas l'écran : il retombe sur le repli. */
export function errorMessageKey(code: string | null | undefined): TranslationKey {
  if (code === null || code === undefined) return UNKNOWN_ERROR_MESSAGE_KEY;
  // `hasOwn` et pas un simple accès : `MESSAGE_KEYS['constructor']` rendrait
  // une fonction héritée d'`Object`, pas `undefined`, et le repli sauterait.
  const key = Object.hasOwn(MESSAGE_KEYS, code) ? MESSAGE_KEYS[code] : undefined;
  return key ?? UNKNOWN_ERROR_MESSAGE_KEY;
}

/**
 * Raccourci des écrans : une erreur inconnue entre, une clé traduisible sort.
 * `t(errorMessageKeyOf(error))` est la seule façon correcte d'afficher un échec.
 */
export function errorMessageKeyOf(error: unknown): TranslationKey {
  return errorMessageKey(appErrorCodeOf(error));
}

/** Un message porté dans les deux langues du produit. Les deux sont obligatoires. */
export interface LocalizedMessage {
  fr: string;
  en: string;
}

export interface ApiError {
  error: {
    code: ErrorCode;
    message_i18n: LocalizedMessage;
    details: Record<string, unknown>;
  };
}

/**
 * Forme unique des erreurs rendues par l'API (`.claude/rules/api.md`).
 * Le message n'est pas un paramètre : il se déduit du code, sinon deux routes
 * finiraient par formuler différemment la même erreur.
 */
export function apiError(code: ErrorCode, details: Record<string, unknown> = {}): ApiError {
  const key = ERROR_MESSAGE_KEYS[code];
  return {
    error: {
      code,
      message_i18n: { fr: translate('fr', key), en: translate('en', key) },
      details,
    },
  };
}
