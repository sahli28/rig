/**
 * Rejoindre une box : son profil public avant connexion, puis l'acceptation
 * de l'invitation une fois la session ouverte.
 */

import { z } from 'zod';
import type { RigClient } from './client';

/**
 * Ce qu'une box expose **sans authentification** : sa marque, rien d'autre.
 * Aucun réglage, aucun effectif, aucune donnée personnelle — la fonction SQL
 * est `security definer` et ne rend que ces sept colonnes.
 */
export const TenantPublicProfileSchema = z.object({
  slug: z.string(),
  name: z.string(),
  app_name: z.string(),
  logo_url: z.string().nullable(),
  primary_color: z.string(),
  radius: z.number(),
  font: z.string(),
});

export type TenantPublicProfile = z.infer<typeof TenantPublicProfileSchema>;

/**
 * Profil public d'une box, par son `slug`.
 *
 * Un slug inconnu rend `null`, exactement comme une box fermée ou supprimée :
 * la fonction SQL ne distingue pas les trois, et l'écran ne doit pas non plus.
 * Confirmer l'existence d'une box à qui tape des slugs au hasard serait déjà
 * une divulgation.
 */
export async function fetchTenantPublicProfile(
  client: RigClient,
  slug: string,
): Promise<TenantPublicProfile | null> {
  const { data, error } = await client.rpc('tenant_public_profile', { p_slug: slug });
  if (error) throw error;

  const first = data?.[0];
  return first === undefined ? null : TenantPublicProfileSchema.parse(first);
}

/**
 * Accepte une invitation et rend l'identifiant de la box rejointe.
 *
 * Toute la logique — expiration, jeton déjà consommé, adresse non
 * correspondante, box fermée — vit dans la fonction SQL, en une transaction
 * verrouillée. Ici on ne fait que relayer l'erreur, qui porte son code
 * applicatif : `INVITATION_EXPIRED` et `INVITATION_ALREADY_USED` partagent le
 * même SQLSTATE et ne se distinguent que par lui.
 */
export async function acceptInvitation(client: RigClient, token: string): Promise<string> {
  const { data, error } = await client.rpc('accept_invitation', { p_token: token });
  if (error) throw error;
  return z.string().uuid().parse(data);
}
