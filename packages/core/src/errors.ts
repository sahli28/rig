/**
 * Forme unique des erreurs API (cf. `.claude/rules/api.md`).
 * Le client réagit au `code`, jamais au texte : les messages sont destinés
 * à l'affichage, le code au branchement.
 */

/** Codes métier connus. Réutiliser plutôt qu'en réinventer. */
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

/** Un message porté dans les deux langues du produit. Les deux sont obligatoires. */
export interface LocalizedMessage {
  fr: string;
  en: string;
}

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message_i18n: LocalizedMessage;
    details: Record<string, unknown>;
  };
}

export function apiError(
  code: ApiErrorCode,
  message: LocalizedMessage,
  details: Record<string, unknown> = {},
): ApiError {
  return { error: { code, message_i18n: message, details } };
}
