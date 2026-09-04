'use client';

/**
 * Client navigateur. La session vit dans des **cookies**, pas dans
 * `localStorage` : c'est ce qui permet au rendu serveur de savoir qui est
 * connecté, et donc de rendre une page de box sans clignotement d'écran vide.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database, RackClient } from '@rack/core/supabase';
import { webSupabaseConfig } from './config';

let client: RackClient | null = null;

/** Un seul client par onglet : deux instances se disputeraient le rafraîchissement du jeton. */
export function browserClient(): RackClient {
  if (client === null) {
    const { url, anonKey } = webSupabaseConfig();
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}
