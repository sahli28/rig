/**
 * Réglages de la box — les schémas que l'écran, la base et le futur mobile
 * partagent, et les quelques fonctions pures qui vont avec.
 *
 * Rien n'écrit ici : les mutations passent par `tenantScope()`, sous la RLS.
 * Ce qui vit dans ce fichier est **la forme** des données et ce que la base ne
 * peut pas contrôler à un prix raisonnable.
 */

import { timeZoneExists } from '../i18n/intl';
import { z } from 'zod';
import { LOCALES } from '../i18n/types';

// ---------------------------------------------------------------------------
// Texte multilingue
// ---------------------------------------------------------------------------

/**
 * Miroir exact des deux contraintes de `class_types` : le français est
 * obligatoire, et **aucune autre langue que `fr` et `en`** n'est acceptée
 * (`name_i18n - array['fr','en'] = '{}'`). `.strict()` n'est donc pas de la
 * coquetterie : sans lui, Zod laisserait passer une clé que la base refusera,
 * et l'erreur remonterait en 400 opaque au lieu d'un message de champ.
 */
export const LocalizedTextSchema = z
  .object({
    fr: z.string().trim().min(1).max(120),
    en: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

/**
 * Lit un texte multilingue venu de la base, où il est typé `Json` — donc
 * `unknown` en pratique.
 *
 * Repli `fr` → `en` → chaîne vide. Le français d'abord parce que c'est la seule
 * langue dont la base garantit la présence ; la chaîne vide plutôt qu'une
 * exception parce qu'un catalogue mal saisi doit rendre un écran fade, pas un
 * écran blanc.
 */
export function localizedText(value: unknown, locale: string): string {
  if (typeof value !== 'object' || value === null) return '';
  const dict = value as Record<string, unknown>;
  const wanted = dict[locale];
  if (typeof wanted === 'string' && wanted.trim().length > 0) return wanted;
  for (const fallback of LOCALES) {
    const candidate = dict[fallback];
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Identité de la box — `tenants`, réservée à l'OWNER
// ---------------------------------------------------------------------------

/**
 * `slug` : même expression que la contrainte `tenants_slug_format`. Le changer
 * change l'URL du back-office et casse les liens partagés — l'écran le dit, et
 * l'action redirige vers la nouvelle adresse.
 */
export const BoxIdentitySchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  timezone: z.string().refine(isSupportedTimeZone, { message: 'timezone_unsupported' }),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/),
  default_locale: z.enum(LOCALES),
});

export type BoxIdentity = z.infer<typeof BoxIdentitySchema>;

/**
 * Un fuseau valide est un fuseau qu'`Intl` sait charger. Passer par un essai
 * plutôt que par une liste : la base de fuseaux se met à jour avec le système,
 * une liste écrite à la main vieillit en silence.
 */
export function isSupportedTimeZone(timeZone: string): boolean {
  return timeZoneExists(timeZone);
}

/**
 * Fuseaux proposés dans le formulaire. Le marché est la France et l'UE : offrir
 * les ~450 fuseaux du monde dans un `<select>` rendu côté serveur coûte plus
 * qu'il ne sert.
 *
 * `current` est toujours inclus, même hors liste — sinon une box réglée
 * autrement verrait son fuseau disparaître au premier enregistrement, ce qui
 * est la pire façon de perdre une donnée : silencieusement, en la regardant.
 *
 * Les outre-mer français sont là parce qu'une box à Saint-Denis de La Réunion
 * est un client, pas un cas limite.
 */
export const TIME_ZONE_OPTIONS = [
  'Europe/Paris',
  'Europe/Brussels',
  'Europe/Luxembourg',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Lisbon',
  'Europe/Rome',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Dublin',
  'Europe/London',
  'Europe/Athens',
  'Europe/Warsaw',
  'Europe/Bucharest',
  'Atlantic/Canary',
  'America/Guadeloupe',
  'America/Martinique',
  'America/Cayenne',
  'Indian/Reunion',
  'Pacific/Noumea',
  'Pacific/Tahiti',
] as const;

export function timeZoneOptions(current: string): string[] {
  const options = [...TIME_ZONE_OPTIONS];
  return options.includes(current as (typeof TIME_ZONE_OPTIONS)[number])
    ? options
    : [current, ...options];
}

// ---------------------------------------------------------------------------
// Règles de réservation — `tenant_settings`, ouvertes au MANAGER
// ---------------------------------------------------------------------------

/** Miroir de `tenant_settings_windows_positive`. */
export const BookingRulesPatchSchema = z.object({
  open_days_before: z.number().int().min(0).max(365),
  close_minutes_before: z.number().int().min(0).max(10080),
  cancel_window_minutes: z.number().int().min(0).max(10080),
  max_upcoming_bookings: z.number().int().min(1).max(100),
  default_visitor_capacity: z.number().int().min(0).max(500),
});

export type BookingRulesPatch = z.infer<typeof BookingRulesPatchSchema>;

// ---------------------------------------------------------------------------
// Catalogue — `class_types`
// ---------------------------------------------------------------------------

/**
 * Couleur proposée à la création d'un type de cours.
 *
 * Ce n'est **pas** un token de thème : c'est une **donnée** de départ, que la box
 * remplace en trois secondes. Elle vit ici plutôt que dans le composant pour que
 * la règle « aucune couleur littérale dans un composant » reste vraie à la
 * lecture, sans exception à expliquer.
 */
export const DEFAULT_CLASS_TYPE_COLOR = '#4C956C';

export const ClassTypePatchSchema = z.object({
  name_i18n: LocalizedTextSchema,
  description_i18n: LocalizedTextSchema.nullable(),
  duration_minutes: z.number().int().min(5).max(480),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  default_capacity: z.number().int().min(1).max(500),
});

export type ClassTypePatch = z.infer<typeof ClassTypePatchSchema>;

// ---------------------------------------------------------------------------
// Adresses et salles — `locations`, `rooms`
// ---------------------------------------------------------------------------

export const LocationPatchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().max(160).nullable(),
  city: z.string().trim().max(80).nullable(),
  postal_code: z.string().trim().max(16).nullable(),
});

export const RoomPatchSchema = z.object({
  location_id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  capacity: z.number().int().min(1).max(500),
});

export type LocationPatch = z.infer<typeof LocationPatchSchema>;
export type RoomPatch = z.infer<typeof RoomPatchSchema>;

// ---------------------------------------------------------------------------
// Horaires d'ouverture — `opening_hours`
// ---------------------------------------------------------------------------

/** 0 = lundi … 6 = dimanche, comme la colonne `weekday`. */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/**
 * `HH:MM`. La base rend `HH:MM:SS` : `normalizeTime` ramène les deux formes à
 * la même, pour qu'un aller-retour formulaire → base → formulaire ne fasse pas
 * apparaître de faux changement.
 */
const TimeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  .transform(normalizeTime);

export function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

export const OpeningHourSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    opens_at: TimeString,
    closes_at: TimeString,
  })
  .refine((slot) => slot.closes_at > slot.opens_at, {
    message: 'closes_before_opens',
    path: ['closes_at'],
  });

export type OpeningHour = z.infer<typeof OpeningHourSchema>;

/**
 * Les créneaux qui en chevauchent un autre le même jour.
 *
 * **C'est le seul endroit où cette règle existe.** La base ne la porte pas : il
 * faudrait `btree_gist` et un type intervalle sur des `time` que PostgreSQL ne
 * fournit pas, soit un type maison pour une box qui a deux lignes par jour. La
 * migration le dit noir sur blanc ; ne pas croire, en lisant `opening_hours`,
 * qu'un `insert` direct serait filtré.
 *
 * Rend les **index** des créneaux fautifs, pour que le formulaire puisse
 * surligner les deux lignes en cause plutôt qu'afficher un message flottant.
 * Les comparaisons de chaînes `HH:MM` suffisent : à format fixe, l'ordre
 * lexicographique est l'ordre chronologique.
 */
export function overlappingSlots(
  slots: readonly { weekday: number; opens_at: string; closes_at: string }[],
): number[] {
  const fautifs = new Set<number>();

  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i];
      const b = slots[j];
      if (a === undefined || b === undefined) continue;
      if (a.weekday !== b.weekday) continue;
      // Bornes ouvertes : 12:00–13:00 et 13:00–14:00 se touchent sans se
      // chevaucher. Une box qui ferme et rouvre à la même minute est ouverte
      // en continu, pas en conflit.
      if (
        normalizeTime(a.opens_at) < normalizeTime(b.closes_at) &&
        normalizeTime(b.opens_at) < normalizeTime(a.closes_at)
      ) {
        fautifs.add(i);
        fautifs.add(j);
      }
    }
  }

  return [...fautifs].sort((x, y) => x - y);
}
