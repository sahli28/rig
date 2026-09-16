import { z } from 'zod';
import type { RackClient } from './client';
import { tenantScope } from './active-tenant';

/**
 * Abonnements à durée fixe, attribués à la main (P2-018, RM2.8).
 *
 * Le paiement se fait hors app (P2-019) : ici il n'y a ni prix ni catalogue —
 * une durée est un choix du staff, pas un produit tarifé. La garde de
 * réservation vit en SQL (`member_has_booking_right()`, appelée par
 * `book_class()` et `join_waitlist()`) ; ce module ne porte que l'attribution
 * et l'affichage.
 */

/** Les durées que la base accepte — le CHECK de `member_subscriptions` est la jumelle SQL. */
export const SUBSCRIPTION_DURATIONS = [1, 2, 3, 6, 12] as const;
export type SubscriptionDuration = (typeof SUBSCRIPTION_DURATIONS)[number];

/**
 * La forme attendue d'une ligne. `starts_on` / `ends_on` sont des dates
 * **locales de la box** (`YYYY-MM-DD`), bornes incluses — jamais des instants.
 */
export const MemberSubscriptionSchema = z.object({
  id: z.string().uuid(),
  membership_id: z.string().uuid(),
  duration_months: z.number().int(),
  starts_on: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  ends_on: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
});

export type MemberSubscription = z.infer<typeof MemberSubscriptionSchema>;

/**
 * Attribue un accès de durée fixe. OWNER/MANAGER seulement — la fonction SQL
 * refuse elle-même ce que l'écran a masqué (deux couches, comme
 * `setMemberRole`). Début = aujourd'hui en date locale de la box, journal
 * d'audit dans la même transaction. Rend la ligne écrite, dont `ends_on`.
 */
export async function grantMemberSubscription(
  client: RackClient,
  membershipId: string,
  durationMonths: SubscriptionDuration,
): Promise<MemberSubscription> {
  const { data, error } = await client.rpc('grant_member_subscription', {
    p_membership_id: membershipId,
    p_duration_months: durationMonths,
  });
  if (error) throw error;
  return MemberSubscriptionSchema.parse(data);
}

/**
 * Les abonnements lisibles par la session dans la box active : les siens pour
 * un membre, toute la box pour OWNER/MANAGER — c'est la RLS qui borne, pas un
 * paramètre. Les lignes archivées sont filtrées **ici** (piège 13 de
 * database.md : les lectures filtrent explicitement).
 */
export async function fetchMemberSubscriptions(
  client: RackClient,
  tenantId: string,
): Promise<MemberSubscription[]> {
  const { data, error } = await tenantScope(client, tenantId)
    .select('member_subscriptions')
    .is('deleted_at', null);
  if (error) throw error;
  return MemberSubscriptionSchema.array().parse(data ?? []);
}

/**
 * L'échéance de l'accès courant : le plus lointain `ends_on` des lignes qui
 * couvrent `todayLocal` (date locale de la box, `YYYY-MM-DD` — voir
 * `localDay`), ou `null` si rien ne couvre. Même frontière que l'oracle SQL :
 * bornes incluses, le lendemain d'`ends_on` ne couvre plus. Un renouvellement
 * anticipé (lignes qui se chevauchent) affiche donc la fin la plus lointaine.
 * Les `YYYY-MM-DD` se comparent lexicographiquement, aucun objet Date en jeu.
 */
export function accessUntil(
  rows: readonly Pick<MemberSubscription, 'starts_on' | 'ends_on'>[],
  todayLocal: string,
): string | null {
  let until: string | null = null;
  for (const row of rows) {
    if (row.starts_on <= todayLocal && todayLocal <= row.ends_on) {
      if (until === null || row.ends_on > until) until = row.ends_on;
    }
  }
  return until;
}
