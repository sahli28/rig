/**
 * Les jetons d'appareil — l'enregistrement côté membre.
 *
 * `devices` suit la **personne**, pas la box (elle est dans les exceptions
 * `tenant_id` de `database.md`) : un membre inscrit dans deux boxes a un seul
 * appareil, un seul jeton. D'où l'accès direct `from('devices')` plutôt que par
 * `tenantScope` — la règle ESLint exclut d'ailleurs `devices` de son filtre de
 * box, pour cette raison.
 */

import type { RackClient } from './client';

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface DeviceRegistration {
  pushToken: string;
  platform: DevicePlatform;
  appVersion?: string | null;
}

/**
 * Enregistre le jeton de l'appareil courant, **via la RPC** et non un `upsert`
 * client nu.
 *
 * La raison est le téléphone partagé : le jeton est un identifiant d'appareil, pas
 * de personne. Si l'occupant précédent l'a enregistré, un `upsert` direct bute sur
 * l'index unique de `push_token` — la RLS masque la ligne de l'autre, donc le
 * `on conflict` ne la voit pas et l'insert lève `23505`. `register_device`
 * (`security definer`) réassigne `user_id` à l'appelant sur conflit. Voir
 * `20260911100500_push_emitter_rpcs.sql`.
 */
export async function registerDevice(
  client: RackClient,
  { pushToken, platform, appVersion }: DeviceRegistration,
): Promise<void> {
  // `exactOptionalPropertyTypes` : on **omet** p_app_version quand il est absent,
  // on ne passe pas `undefined` explicitement.
  const { error } = await client.rpc('register_device', {
    p_push_token: pushToken,
    p_platform: platform,
    ...(appVersion != null ? { p_app_version: appVersion } : {}),
  });
  if (error) throw error;
}

/**
 * Oublie le jeton de cet appareil — à la déconnexion.
 *
 * `delete` direct, borné par la policy `devices_self_write` (`user_id =
 * auth.uid()`) : on ne supprime que le sien. **Pas** `revoke_device`, qui est
 * réservé à l'émetteur (`service_role`) pour les jetons morts et supprimerait
 * n'importe quel jeton par sa valeur.
 */
export async function forgetDevice(client: RackClient, pushToken: string): Promise<void> {
  const { error } = await client.from('devices').delete().eq('push_token', pushToken);
  if (error) throw error;
}
