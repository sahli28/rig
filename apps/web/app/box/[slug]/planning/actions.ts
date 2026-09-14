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
  can,
  fetchMe,
  findMembershipBySlug,
  instantLocal,
  isCalendarDate,
  parseWeeklyRrule,
  type RackClient,
  type RruleDay,
  tenantScope,
} from '@rack/core/supabase';
import { errorMessageKeyOf } from '@rack/core';
import { serverClient } from '../../../../lib/supabase/server';
import { HORIZON_DAYS, type ActionState } from './action-state';

const INVALID: ActionState = { status: 'error', key: 'planning.error_invalid' };
const FORBIDDEN: ActionState = { status: 'error', key: 'errors.forbidden_role' };
/**
 * L'hébergé n'a pas répondu à temps (D-032). Rendu comme état, jamais levé :
 * une exception dans une action donnait un 500 nu et perdait la saisie —
 * c'est le défaut observé à la mise en service du 13 septembre 2026.
 */
const INDISPONIBLE: ActionState = { status: 'error', key: 'errors.unknown' };
const OK: ActionState = { status: 'ok' };
/** Effacer une séance demande un geste explicite : voir `saveWorkout`. */
const CONFIRM_DELETE: ActionState = { status: 'error', key: 'workout.confirm_delete' };
/** … et une fois fait, l'écran le dit avec le bon mot — pas « enregistré ». */
const DELETED: ActionState = { status: 'ok', key: 'workout.deleted' };

type Contexte = { client: RackClient; tenantId: string };

/** Résout la box et le rôle depuis la session. Un échec rend l'état à afficher. */
async function contexte(slug: string): Promise<Contexte | ActionState> {
  const client = await serverClient();
  try {
    const me = await fetchMe(client);
    const membership = findMembershipBySlug(me, slug);

    if (membership === null) return FORBIDDEN;
    if (!can(membership.role, 'planning_admin')) return FORBIDDEN;

    return { client, tenantId: membership.tenant_id };
  } catch {
    return INDISPONIBLE;
  }
}

/**
 * Le contexte du **staff qui anime**, coachs compris.
 *
 * `contexte()` s'arrête à OWNER et MANAGER : c'est la garde des gestes
 * d'administration — créer une série, annuler un cours. **Écrire la séance n'en
 * est pas un** : c'est le travail du coach, et il n'administre rien.
 *
 * Sœur exacte de `current_staff_tenant_ids()` en base, et c'est voulu : les deux
 * couches disent la même chose, la policy refuse de toute façon, et celle-ci
 * transforme un refus opaque en phrase.
 */
async function contexteStaff(slug: string): Promise<Contexte | ActionState> {
  const client = await serverClient();
  try {
    const me = await fetchMe(client);
    const membership = findMembershipBySlug(me, slug);

    if (membership === null) return FORBIDDEN;
    if (!can(membership.role, 'workout')) return FORBIDDEN;

    return { client, tenantId: membership.tenant_id };
  } catch {
    return INDISPONIBLE;
  }
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
  if ('status' in ctx) return ctx;

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
  if ('status' in ctx) return ctx;

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
  if ('status' in ctx) return ctx;

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
 * Pose un cours **ponctuel** : une occurrence sans série (P1-026).
 *
 * `schedule_id: null` + `is_override: true` — l'invariant
 * `classes_ponctuel_est_derogatoire` rend le second obligatoire, et c'est lui
 * qui garantit qu'aucun rafraîchissement de série ne balaiera la ligne. La
 * seconde ceinture est structurelle : les refresh joignent `schedule_id = s.id`,
 * un NULL n'y correspond jamais.
 *
 * L'heure saisie est **locale à la box** (règle 9 de CLAUDE.md) ; `ends_at` se
 * calcule avec la durée du type de cours — la même recette que la
 * matérialisation des séries.
 */
export async function createOneOff(
  slug: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await contexte(slug);
  if ('status' in ctx) return ctx;

  const date = texte(form.get('date'));
  const heure = texte(form.get('time'));
  const classTypeId = texte(form.get('class_type_id'));
  const roomId = texte(form.get('room_id'));
  const coachId = texte(form.get('coach_membership_id'));
  const capacity = Number(texte(form.get('capacity')));

  if (
    !isCalendarDate(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(heure) ||
    classTypeId === '' ||
    roomId === '' ||
    coachId === '' ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 999
  ) {
    return INVALID;
  }

  const scope = tenantScope(ctx.client, ctx.tenantId);

  // Le fuseau de la box et la durée du type : les deux ingrédients des instants.
  const tenant = await scope.currentTenant();
  if (tenant.error) return echec(tenant.error);
  if (tenant.data === null) return INVALID;

  const type = await scope
    .select('class_types')
    .eq('id', classTypeId)
    .is('deleted_at', null)
    .maybeSingle();
  if (type.error) return echec(type.error);
  if (type.data === null) return INVALID;

  const startsAt = instantLocal(`${date}T${heure}:00`, tenant.data.timezone);
  const endsAt = new Date(Date.parse(startsAt) + type.data.duration_minutes * 60_000).toISOString();

  // Salle et coach d'une autre box : les FK composites `(id, tenant_id)`
  // refusent — pas besoin de les re-vérifier ici.
  const { error } = await scope.insert('classes', {
    schedule_id: null,
    class_type_id: classTypeId,
    room_id: roomId,
    coach_membership_id: coachId,
    starts_at: startsAt,
    ends_at: endsAt,
    capacity,
    is_override: true,
  });
  if (error) return echec(error);

  revalidatePath(`/box/${slug}/planning`);
  return OK;
}

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
  if ('status' in ctx) return ctx;

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

  // **Les réservations suivent le cours, et c'est nouveau (P1-004).**
  //
  // Jusqu'ici, passer un cours à `CANCELLED` ne touchait rien d'autre : les
  // réservations restaient `CONFIRMED`, `booked_count` restait plein, et la
  // personne voyait toujours sa réservation active dans « Mes réservations ».
  // Vérifié au catalogue — le seul trigger sur `classes` était `set_updated_at`.
  //
  // L'appel vient **après** le changement de statut, pas avant : si le premier
  // échoue, on n'a annulé les réservations de personne. L'inverse laisserait un
  // cours vivant sans inscrits.
  const cascade = await ctx.client.rpc('cancel_class_bookings', { p_class_id: id });
  if (cascade.error) return echec(cascade.error);

  revalidatePath(`/box/${slug}/planning`);
  return OK;
}

/**
 * Change les places d'**une** occurrence — jamais par la série (P1-025).
 *
 * Le cas principal est un cours **déjà réservé** : le refresh ne touche que les
 * occurrences vierges, donc rien d'autre ne peut changer cette capacité-là.
 * `is_override` passe à `true` — le drapeau que les deux refresh respectent
 * déjà — pour qu'une modification de série n'écrase pas la valeur posée à la
 * main. (Annuler puis rétablir la ramènera à la série : c'est la sémantique de
 * `restoreClass`, assumée.)
 *
 * **Deux gardes, un seul message.** La pré-lecture de `booked_count` rend le
 * refus lisible avant d'écrire ; si une réservation gagne la course entre la
 * lecture et l'écriture, la contrainte `classes_booked_within_capacity` lève
 * un `23514` — mappé vers la même clé, jamais une erreur brute (le motif du
 * `23505` du slug, `reglages/actions.ts`).
 */
export async function saveCapacity(
  slug: string,
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await contexte(slug);
  if ('status' in ctx) return ctx;

  const capacity = Number(texte(form.get('capacity')));
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 999) return INVALID;

  const scope = tenantScope(ctx.client, ctx.tenantId);
  const ligne = await scope.select('classes').eq('id', id).maybeSingle();
  if (ligne.error) return echec(ligne.error);
  if (ligne.data === null) return INVALID;
  if (capacity < ligne.data.booked_count) {
    return { status: 'error', key: 'errors.capacity_below_booked' };
  }

  const { error } = await scope.update('classes', { capacity, is_override: true }).eq('id', id);
  if (error?.code === '23514') {
    return { status: 'error', key: 'errors.capacity_below_booked' };
  }
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
  if ('status' in ctx) return ctx;

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

/**
 * Écrit ou remplace la séance d'une occurrence (P1-015).
 *
 * **Une seule séance vivante par occurrence**, garantie par un index unique en
 * base : cette action fait donc un `upsert` sur `class_id`, et non un `insert`
 * qui échouerait au second enregistrement.
 *
 * **Le corps vide efface la séance.** C'est le geste naturel — on vide le champ,
 * on enregistre — et il passe par `deleted_at` : règle 10, pas de suppression
 * physique sur une entité métier. Effacer libère aussi l'occurrence de la
 * troisième protection, qui redevient rafraîchissable comme les autres.
 *
 * **Publier n'est pas enregistrer.** Deux boutons, deux gestes : le coach écrit
 * son brouillon quand il veut, il le publie quand il est prêt. Confondre les
 * deux publierait un texte à moitié tapé au premier enregistrement.
 */
export async function saveWorkout(
  slug: string,
  classId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await contexteStaff(slug);
  if ('status' in ctx) return ctx;

  const titre = texte(form.get('title'));
  const corps = texte(form.get('body'));
  const publier = form.get('publish') === 'on';

  if (titre.length > 120) return INVALID;

  const scope = tenantScope(ctx.client, ctx.tenantId);

  const { data: existante, error: lecture } = await scope
    .select('class_workouts')
    .eq('class_id', classId)
    .is('deleted_at', null)
    .maybeSingle();
  if (lecture) return echec(lecture);

  // **Un corps vide efface une séance : ça se confirme, ça ne se déduit pas.**
  //
  // Le geste qui coûte : le coach sélectionne tout pour retaper, laisse une
  // espace, enregistre — et son WOD disparaît sous un bouton qui dit
  // « Enregistrer ». Le `trim()` ci-dessus fait qu'« une espace » vaut « vide »,
  // et rien ne l'avertissait.
  //
  // Ce lot vient d'ajouter une troisième protection en base pour que la séance
  // survive à une correction de série : laisser la même perte silencieuse dans
  // l'écran contredirait le ticket, sur la seule fonction que la box attend.
  //
  // **La longueur d'une chaîne ne décide donc plus de rien** — c'est le drapeau
  // de confirmation qui décide, et il est vérifié **ici**, pas seulement à
  // l'écran : une action serveur qui fait confiance à son formulaire ne garde
  // rien.
  if (corps.length === 0) {
    if (existante === null) return OK;
    if (form.get('confirm') !== 'on') return CONFIRM_DELETE;

    // Cet `update` a été refusé par la base pendant toute une journée, sans
    // qu'aucun test le voie : `class_workouts_select` masquait les lignes
    // archivées à tout le monde, et PostgreSQL 17 exige que la ligne mise à
    // jour reste visible de qui la met à jour (`database.md`, piège 13). La
    // policy a changé ; le geste, lui, est resté un update nu, et son pgTAP
    // le joue sous l'identité du coach.
    const { error } = await scope
      .update('class_workouts', { deleted_at: new Date().toISOString() })
      .eq('id', existante.id);
    if (error) return echec(error);
    revalidatePath(`/box/${slug}/planning`);
    return DELETED;
  }

  const publishedAt = publier ? (existante?.published_at ?? new Date().toISOString()) : null;

  // Le push part si la séance devient publiée, ou si son texte change alors
  // qu'elle l'est — jamais sur une re-sauvegarde à l'identique (P1-029). C'est
  // ici que vit le « pas deux fois pour rien » : le producteur SQL, lui, ne
  // peut pas savoir si le texte a changé.
  const titreNormalise = titre.length === 0 ? null : titre;
  const texteChange =
    existante === null || existante.body !== corps || existante.title !== titreNormalise;
  const devientPubliee = publier && (existante === null || existante.published_at === null);
  const doitNotifier = publier && (devientPubliee || texteChange);

  if (existante === null) {
    const { error } = await scope.insert('class_workouts', {
      class_id: classId,
      title: titreNormalise,
      body: corps,
      published_at: publishedAt,
    });
    if (error) return echec(error);
  } else {
    const { error } = await scope
      .update('class_workouts', {
        title: titreNormalise,
        body: corps,
        published_at: publishedAt,
      })
      .eq('id', existante.id);
    if (error) return echec(error);
  }

  // **Un effet de bord, jamais une condition** — même règle que l'e-mail
  // d'invitation : un échec d'enfilage ne fait pas échouer la publication. Les
  // quiet hours écartent en silence (le producteur rend 0), et c'est le
  // comportement de toute catégorie non exemptée — mesuré, écrit au ticket.
  if (doitNotifier) {
    const push = await ctx.client.rpc('notify_workout_published', { p_class_id: classId });
    // Journalisé partout, production comprise : c'est la même observabilité
    // que le transport D-032 — un message d'erreur Postgres, aucune donnée
    // personnelle.
    if (push.error) {
      console.warn(`[push] notify_workout_published : ${push.error.message}`);
    }
  }

  revalidatePath(`/box/${slug}/planning`);
  return OK;
}
