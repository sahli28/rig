/**
 * La couche d'accès de l'émetteur d'invitations (P1-018) : réserver un lot, puis
 * marquer chaque envoi. Le POST Brevo lui-même vit côté serveur web (`apps/web`),
 * pas ici : `packages/core` ne fait aucun HTTP externe, et la clé Brevo n'y entre
 * jamais.
 */

import { z } from 'zod';
import type { RackClient } from './client';

const ClaimedInvitationSchema = z.object({
  delivery_id: z.string().uuid(),
  invitation_id: z.string().uuid(),
  email: z.string(),
  first_name: z.string().nullable(),
});

export type ClaimedInvitation = z.infer<typeof ClaimedInvitationSchema>;

export type EmailDeliveryOutcome =
  { status: 'sent'; providerMessageId: string | null } | { status: 'failed'; error: string };

/**
 * Réserve un lot d'invitations PENDING **nominatives et vives** à mailer, sans
 * envoi récent (fenêtre `withinHours`) — ce qui unifie envoi initial, relance et
 * vagues. La base insère une ligne `sending` par retenue (l'idempotence qui tient
 * « jamais deux fois » sur une coupure) et la rend. `security definer`, autorise
 * OWNER/MANAGER.
 */
export async function claimInvitationsToEmail(
  client: RackClient,
  tenantId: string,
  { limit = 40, withinHours = 24 }: { limit?: number; withinHours?: number } = {},
): Promise<ClaimedInvitation[]> {
  const { data, error } = await client.rpc('claim_invitations_to_email', {
    p_tenant_id: tenantId,
    p_limit: limit,
    p_within: `${withinHours} hours`,
  });
  if (error) throw error;
  return ClaimedInvitationSchema.array().parse(data ?? []);
}

/**
 * Marque une ligne `sending` en `sent` | `failed` après l'appel Brevo. Idempotent
 * côté base (garde `status = sending`) : un second marquage ne réécrit rien.
 */
export async function markEmailDelivery(
  client: RackClient,
  deliveryId: string,
  outcome: EmailDeliveryOutcome,
): Promise<void> {
  // `exactOptionalPropertyTypes` : on **omet** les clés absentes (la base retombe
  // sur leur `default null`), on ne les pose jamais à `undefined`.
  const { error } = await client.rpc('mark_email_delivery', {
    p_delivery_id: deliveryId,
    p_status: outcome.status,
    ...(outcome.status === 'sent' && outcome.providerMessageId !== null
      ? { p_provider_message_id: outcome.providerMessageId }
      : {}),
    ...(outcome.status === 'failed' ? { p_error: outcome.error } : {}),
  });
  if (error) throw error;
}
