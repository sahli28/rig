'use server';

/**
 * Les écritures de l'écran Réglages.
 *
 * **Server Actions plutôt qu'un appel depuis le navigateur** : la session vient
 * du cookie, la RLS s'applique, Zod valide côté serveur, et rien ne dépend du
 * JavaScript client.
 *
 * Deux choses que chaque action refait, et qui ne sont pas de la paranoïa :
 *
 * - le `tenant_id` est **redérivé de la session** à partir du slug de l'URL,
 *   jamais accepté d'un champ de formulaire. Un `tenant_id` envoyé par le
 *   client n'accorde aucun droit (règle 2 de CLAUDE.md) ;
 * - la garde de rôle est réaffirmée ici. Elle reste de l'**ergonomie** : les
 *   policies refusent déjà, mais un refus de la base remonte en erreur opaque
 *   là où un refus ici remonte une phrase.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  BookingRulesPatchSchema,
  BoxIdentitySchema,
  ClassTypePatchSchema,
  LocationPatchSchema,
  OpeningHourSchema,
  RoomPatchSchema,
  fetchMe,
  findMembershipBySlug,
  overlappingSlots,
  tenantScope,
  type RackClient,
} from '@rack/core/supabase';
import { errorMessageKey, errorMessageKeyOf } from '@rack/core';
import { serverClient } from '../../../../lib/supabase/server';
import type { ActionState } from './action-state';

const INVALID: ActionState = { status: 'error', key: 'settings.error_invalid' };
const FORBIDDEN: ActionState = { status: 'error', key: 'errors.forbidden_role' };

type Contexte = { client: RackClient; tenantId: string; role: string };

/** Résout la box et le rôle depuis la session. `null` = ni box, ni droit. */
async function contexte(slug: string): Promise<Contexte | null> {
  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null) return null;
  if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') return null;

  return { client, tenantId: membership.tenant_id, role: membership.role };
}

function echec(error: unknown): ActionState {
  return { status: 'error', key: errorMessageKeyOf(error) };
}

function nombre(value: FormDataEntryValue | null): number {
  return Number(typeof value === 'string' ? value.trim() : Number.NaN);
}

function texte(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Champ optionnel : vide veut dire « pas de valeur », donc `null`. */
function texteOuNul(value: FormDataEntryValue | null): string | null {
  const brut = texte(value);
  return brut.length === 0 ? null : brut;
}

// ---------------------------------------------------------------------------
// Identité — `tenants`, OWNER seul
// ---------------------------------------------------------------------------

/**
 * La frontière du back-office se coupe **par table** : l'identité de la box est
 * au propriétaire, l'opérationnel s'ouvre au gestionnaire. Le raisonnement
 * complet est dans `docs/backlog/P1-001b-reglages-box.md`.
 */
export async function saveIdentity(slug: string, _prev: ActionState, form: FormData) {
  const ctx = await contexte(slug);
  if (ctx === null || ctx.role !== 'OWNER') return FORBIDDEN;

  const parsed = BoxIdentitySchema.safeParse({
    name: texte(form.get('name')),
    slug: texte(form.get('slug')),
    timezone: texte(form.get('timezone')),
    currency: texte(form.get('currency')),
    default_locale: texte(form.get('default_locale')),
  });
  if (!parsed.success) return INVALID;

  const { error } = await tenantScope(ctx.client, ctx.tenantId).updateCurrentTenant(parsed.data);

  // Le slug déjà pris ressort en violation d'unicité, sans code applicatif :
  // c'est un index, pas une fonction `app_error()`. Sans cette ligne, la personne
  // lirait « une erreur est survenue » là où le vrai message existe déjà.
  if (error?.code === '23505') {
    return { status: 'error', key: errorMessageKey('TENANT_SLUG_TAKEN') } as const;
  }
  if (error) return echec(error);

  // Changer le slug change l'URL. Rediriger plutôt que rafraîchir : sans ça,
  // la page suivante rendrait une box « inconnue » sous l'ancienne adresse.
  if (parsed.data.slug !== slug) redirect(`/box/${parsed.data.slug}/reglages`);

  revalidatePath(`/box/${slug}/reglages`);
  return { status: 'ok' } as const;
}

// ---------------------------------------------------------------------------
// Règles de réservation — `tenant_settings`
// ---------------------------------------------------------------------------

export async function saveBookingRules(slug: string, _prev: ActionState, form: FormData) {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const parsed = BookingRulesPatchSchema.safeParse({
    open_days_before: nombre(form.get('open_days_before')),
    close_minutes_before: nombre(form.get('close_minutes_before')),
    cancel_window_minutes: nombre(form.get('cancel_window_minutes')),
    max_upcoming_bookings: nombre(form.get('max_upcoming_bookings')),
    default_visitor_capacity: nombre(form.get('default_visitor_capacity')),
  });
  if (!parsed.success) return INVALID;

  const { error } = await tenantScope(ctx.client, ctx.tenantId).update(
    'tenant_settings',
    parsed.data,
  );
  if (error) return echec(error);

  revalidatePath(`/box/${slug}/reglages`);
  return { status: 'ok' } as const;
}

// ---------------------------------------------------------------------------
// Horaires d'ouverture — `opening_hours`
// ---------------------------------------------------------------------------

export async function addOpeningHour(slug: string, _prev: ActionState, form: FormData) {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const parsed = OpeningHourSchema.safeParse({
    weekday: nombre(form.get('weekday')),
    opens_at: texte(form.get('opens_at')),
    closes_at: texte(form.get('closes_at')),
  });
  if (!parsed.success) return INVALID;

  const scope = tenantScope(ctx.client, ctx.tenantId);

  // Le chevauchement n'est **pas** garanti par la base : l'interdire y
  // demanderait un type intervalle sur des `time` que PostgreSQL ne fournit
  // pas (cf. la migration). C'est donc ici, et nulle part ailleurs, que la
  // règle existe — d'où la relecture des créneaux du jour avant d'écrire.
  const { data: existants, error: erreurLecture } = await scope
    .select('opening_hours')
    .is('deleted_at', null)
    .eq('weekday', parsed.data.weekday);
  if (erreurLecture) return echec(erreurLecture);

  if (overlappingSlots([...(existants ?? []), parsed.data]).length > 0) {
    return { status: 'error', key: 'settings.error_overlap' } as const;
  }

  const { error } = await scope.insert('opening_hours', parsed.data);
  if (error) return echec(error);

  revalidatePath(`/box/${slug}/reglages`);
  return { status: 'ok' } as const;
}

/** Retrait par `deleted_at` : pas de suppression physique (règle 10). */
export async function removeOpeningHour(slug: string, id: string) {
  const ctx = await contexte(slug);
  if (ctx === null) return;

  await tenantScope(ctx.client, ctx.tenantId)
    .update('opening_hours', { deleted_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath(`/box/${slug}/reglages`);
}

// ---------------------------------------------------------------------------
// Adresses et salles — `locations`, `rooms`
// ---------------------------------------------------------------------------

export async function addLocation(slug: string, _prev: ActionState, form: FormData) {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const parsed = LocationPatchSchema.safeParse({
    name: texte(form.get('name')),
    address: texteOuNul(form.get('address')),
    city: texteOuNul(form.get('city')),
    postal_code: texteOuNul(form.get('postal_code')),
  });
  if (!parsed.success) return INVALID;

  const { error } = await tenantScope(ctx.client, ctx.tenantId).insert('locations', parsed.data);
  if (error) return echec(error);

  revalidatePath(`/box/${slug}/reglages`);
  return { status: 'ok' } as const;
}

export async function addRoom(slug: string, _prev: ActionState, form: FormData) {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const parsed = RoomPatchSchema.safeParse({
    location_id: texte(form.get('location_id')),
    name: texte(form.get('name')),
    capacity: nombre(form.get('capacity')),
  });
  if (!parsed.success) return INVALID;

  const { error } = await tenantScope(ctx.client, ctx.tenantId).insert('rooms', parsed.data);
  if (error) return echec(error);

  revalidatePath(`/box/${slug}/reglages`);
  return { status: 'ok' } as const;
}

export async function archiveRoom(slug: string, id: string) {
  const ctx = await contexte(slug);
  if (ctx === null) return;

  await tenantScope(ctx.client, ctx.tenantId)
    .update('rooms', { deleted_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath(`/box/${slug}/reglages`);
}

// ---------------------------------------------------------------------------
// Types de cours — `class_types`
// ---------------------------------------------------------------------------

function typeDeCoursDepuis(form: FormData) {
  const en = texte(form.get('name_en'));
  const descriptionFr = texte(form.get('description_fr'));

  return ClassTypePatchSchema.safeParse({
    name_i18n:
      en.length > 0 ? { fr: texte(form.get('name_fr')), en } : { fr: texte(form.get('name_fr')) },
    description_i18n: descriptionFr.length > 0 ? { fr: descriptionFr } : null,
    duration_minutes: nombre(form.get('duration_minutes')),
    color: texte(form.get('color')),
    default_capacity: nombre(form.get('default_capacity')),
  });
}

export async function addClassType(slug: string, _prev: ActionState, form: FormData) {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const parsed = typeDeCoursDepuis(form);
  if (!parsed.success) return INVALID;

  const { error } = await tenantScope(ctx.client, ctx.tenantId).insert('class_types', parsed.data);
  if (error) return echec(error);

  revalidatePath(`/box/${slug}/reglages`);
  return { status: 'ok' } as const;
}

export async function saveClassType(slug: string, id: string, _prev: ActionState, form: FormData) {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const parsed = typeDeCoursDepuis(form);
  if (!parsed.success) return INVALID;

  const { error } = await tenantScope(ctx.client, ctx.tenantId)
    .update('class_types', parsed.data)
    .eq('id', id);
  if (error) return echec(error);

  revalidatePath(`/box/${slug}/reglages`);
  return { status: 'ok' } as const;
}

export async function archiveClassType(slug: string, id: string) {
  const ctx = await contexte(slug);
  if (ctx === null) return;

  await tenantScope(ctx.client, ctx.tenantId)
    .update('class_types', { deleted_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath(`/box/${slug}/reglages`);
}
