/**
 * Le jeton push de cet appareil, mémorisé localement pour pouvoir l'oublier à la
 * déconnexion.
 *
 * **Volontairement séparé de `push.ts`** : ce module n'importe pas
 * `expo-notifications`. `session.tsx` appelle `forgetPushToken` dans `signOut`,
 * et on ne veut pas y traîner le module natif de notifications — la déconnexion
 * ne doit dépendre que de `SecureStore` et d'un `delete` en base.
 */

import * as SecureStore from 'expo-secure-store';
import { forgetDevice, type RackClient } from '@rack/core/supabase';

const PUSH_TOKEN_KEY = 'rack.push_token';

/** Retient le jeton qu'on vient d'enregistrer, pour le retrouver au `signOut`. */
export async function rememberPushToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
}

/**
 * Oublie le jeton de cet appareil, à la déconnexion — **avant** `auth.signOut()`,
 * tant que la RLS reconnaît encore l'appelant (le `delete` est borné par
 * `user_id = auth.uid()`).
 *
 * Best-effort : une déconnexion ne doit pas échouer parce que le réseau manque.
 * Le pire cas est un jeton qui survit en base — et il est rattrapé de deux côtés :
 * l'occupant suivant du téléphone le réassigne via `register_device`, et
 * l'émetteur le révoque au premier `DeviceNotRegistered`. La clé locale part
 * dans tous les cas : la reconnexion réenregistre de toute façon.
 */
export async function forgetPushToken(client: RackClient): Promise<void> {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (token === null) return;
  try {
    await forgetDevice(client, token);
  } catch {
    // avalé — voir la doc ci-dessus
  }
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}
