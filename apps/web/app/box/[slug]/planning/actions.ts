'use server';

/**
 * Les écritures du planning.
 *
 * Ce fichier est **l'appelant que `refresh_class_schedule()` attendait**. La
 * migration l'a livrée sans personne pour l'appeler ; la règle 7 de `CLAUDE.md`
 * dit qu'une fonction dans cet état n'est pas « faite », elle est en attente.
 * Elle ne l'est plus.
 *
 * Comme ailleurs dans le back-office, deux choses que chaque action refait :
 *
 * - le `tenant_id` est **redérivé de la session** à partir du slug de l'URL,
 *   jamais accepté d'un champ de formulaire (règle 2 de `CLAUDE.md`) ;
 * - la garde de rôle est réaffirmée. Elle reste de l'ergonomie — les policies
 *   et `refresh_class_schedule()` refusent déjà — mais un refus de la base
 *   remonte en erreur opaque là où un refus ici remonte une phrase.
 */

import { revalidatePath } from 'next/cache';
import {
  ClassSchedulePatchSchema,
  buildWeeklyRrule,
  fetchMe,
  findMembershipBySlug,
  parseWeeklyRrule,
  type RigClient,
  type RruleDay,
  tenantScope,
} from '@rig/core/supabase';
import { errorMessageKeyOf } from '@rig/core';
import { serverClient } from '../../../../lib/supabase/server';
import { HORIZON_DAYS, type ActionState } from './action-state';

const INVALID: ActionState = { status: 'error', key: 'planning.error_invalid' };
const FORBIDDEN: ActionState = { status: 'error', key: 'errors.forbidden_role' };
const OK: ActionState = { status: 'ok' };

type Contexte = { client: RigClient; tenantId: string };

/** Résout la box et le rôle depuis la session. `null` = ni box, ni droit. */
async function contexte(slug: string): Promise<Contexte | null> {
  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null) return null;
  if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') return null;

  return { client, tenantId: membership.tenant_id };
}

function echec(error: unknown): ActionState {
  return { status: 'error', key: errorMessageKeyOf(error) };
}

function texte(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** `YYYY-MM-DD` d'aujourd'hui et de la fin d'horizon, en UTC. */
function horizon(): { from: string; until: string } {
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + HORIZON_DAYS);
  return { from, until: end.toISOString().slice(0, 10) };
}

/**
 * Matérialise, ou re-matérialise, les occurrences d'**une** série.
 *
 * Toujours par cet appel, jamais par `materialize_class_occurrences()` en
 * direct : celle-ci est révoquée à `authenticated` précisément parce qu'elle
 * accepte un horizon sans borne de série. `refresh_class_schedule()` porte la
 * garde de rôle **et** la portée.
 */
async function rafraichir(ctx: Contexte, scheduleId: string) {
  const { from, until } = horizon();
  return ctx.client.rpc('refresh_class_schedule', {
    p_schedule_id: scheduleId,
    p_from: from,
    p_until: until,
  });
}

/** Lit une série depuis le formulaire, sous la forme canonique de la RRULE. */
function serieDepuis(form: FormData) {
  const days = form.getAll('days').filter((d): d is string => typeof d === 'string') as RruleDay[];
  const until = texte(form.get('until'));

  if (days.length === 0) return null;

  const rrule = buildWeeklyRrule({
    days,
    interval: Number(texte(form.get('interval')) || '1'),
    until: until.length === 0 ? null : until,
  });

  return ClassSchedulePatchSchema.safeParse({
    class_type_id: texte(form.get('class_type_id')),
    room_id: texte(form.get('room_id')),
    coach_membership_id: texte(form.get('coach_membership_id')),
    starts_on: texte(form.get('starts_on')),
    starts_at_local: texte(form.get('starts_at_local')),
    rrule,
    capacity: Number(texte(form.get('capacity'))),
  });
}

// ---------------------------------------------------------------------------
// Séries
// ---------------------------------------------------------------------------

export async function createSchedule(slug: string, _prev: ActionState, form: FormData) {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const parsed = serieDepuis(form);
  if (parsed === null || !parsed.success) return INVALID;

  const { data, error } = await tenantScope(ctx.client, ctx.tenantId)
    .insert('class_schedules', parsed.data)
    .select('id')
    .single();

  if (error) return echec(error);

  // Peupler tout de suite. Sans ça, une série créée à 9 h n'apparaîtrait qu'au
  // job de 00h05 le lendemain, et l'écran paraîtrait cassé.
  const refresh = await rafraichir(ctx, data.id);
  if (refresh.error) return echec(refresh.error);

  revalidatePath(`/box/${slug}/planning`);
  return OK;
}

export async function updateSchedule(slug: string, id: string, _prev: ActionState, form: FormData) {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const parsed = serieDepuis(form);
  if (parsed === null || !parsed.success) return INVALID;

  const { error } = await tenantScope(ctx.client, ctx.tenantId)
    .update('class_schedules', parsed.data)
    .eq('id', id);

  if (error) return echec(error);

  // La réconciliation est **dans la base**, en une transaction : elle archive
  // les occurrences futures encore modifiables et recrée depuis la règle
  // courante, sans toucher aux cours réservés ni aux exceptions. La refaire en
  // TypeScript violerait la règle 3 de `CLAUDE.md`, et une seule branche
  // oubliée laisserait une occurrence qui ne correspond plus à sa série.
  const refresh = await rafraichir(ctx, id);
  if (refresh.error) return echec(refresh.error);

  revalidatePath(`/box/${slug}/planning`);
  return OK;
}

/**
 * Archive une série. Les occurrences déjà réservées **restent** : elles sont
 * l'historique de la box, et quelqu'un les a réservées.
 *
 * Le nettoyage des occurrences futures non réservées est laissé à
 * `refresh_class_schedule()`, qui sait exactement lesquelles sont modifiables —
 * la série archivée ne produit plus rien, donc il ne recrée rien.
 */
export async function archiveSchedule(slug: string, id: string): Promise<ActionState> {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const { error } = await tenantScope(ctx.client, ctx.tenantId)
    .update('class_schedules', { deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return echec(error);

  const refresh = await rafraichir(ctx, id);
  if (refresh.error) return echec(refresh.error);

  revalidatePath(`/box/${slug}/planning`);
  return OK;
}

// ---------------------------------------------------------------------------
// Occurrences — les exceptions à la série
// ---------------------------------------------------------------------------

/**
 * Annule **une** occurrence sans toucher à la série.
 *
 * `is_override` passe à `true` : c'est ce drapeau qui protège la ligne d'être
 * réécrite au prochain rafraîchissement. Sans lui, modifier la série
 * ressusciterait le cours annulé.
 *
 * **Aucun membre n'est prévenu.** Le ticket demande « annulation avec
 * notification » ; le canal n'existe pas — le push est P1-007, l'e-mail
 * P2-015. L'écran le dit à qui annule plutôt que de laisser croire le
 * contraire, et le critère d'acceptation reste ouvert dans le ticket.
 */
export async function cancelClass(
  slug: string,
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const raison = texte(form.get('reason'));
  if (raison.length === 0 || raison.length > 280) return INVALID;

  const { error } = await tenantScope(ctx.client, ctx.tenantId)
    .update('classes', {
      status: 'CANCELLED',
      is_override: true,
      cancellation_reason: raison,
    })
    .eq('id', id);

  if (error) return echec(error);

  revalidatePath(`/box/${slug}/planning`);
  return OK;
}

/**
 * Rétablit une occurrence annulée.
 *
 * `is_override` repasse à `false`, et ce n'est pas un détail : annuler puis
 * rétablir ramène la séance à ce que la série dit. La laisser marquée comme
 * exception la figerait pour toujours — un changement de salle sur la série ne
 * l'atteindrait plus jamais, sans que rien ne l'explique.
 */
export async function restoreClass(slug: string, id: string): Promise<ActionState> {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const { error } = await tenantScope(ctx.client, ctx.tenantId)
    .update('classes', {
      status: 'SCHEDULED',
      is_override: false,
      cancellation_reason: null,
    })
    .eq('id', id);

  if (error) return echec(error);

  revalidatePath(`/box/${slug}/planning`);
  return OK;
}

/** Relit une série pour pré-remplir le formulaire d'édition. */
export async function readRecurrence(rrule: string) {
  return parseWeeklyRrule(rrule);
}
