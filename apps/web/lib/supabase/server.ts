/**
 * Client des Server Components et des Route Handlers.
 *
 * Il lit la session dans les cookies de la requête. L'écriture, elle, échoue
 * silencieusement dans un Server Component — Next l'interdit une fois la
 * réponse commencée — et c'est le middleware qui s'en charge à chaque requête.
 *
 * Pas de `import 'server-only'` : `next/headers` lève déjà si ce module est
 * importé depuis un composant client, et le paquet n'est pas une dépendance
 * déclarée de l'app.
 */

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { resilientFetch, type Database, type RackClient } from '@rack/core/supabase';
import { webSupabaseConfig } from './config';

export async function serverClient(): Promise<RackClient> {
  const store = await cookies();
  const { url, anonKey } = webSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
    // Le transport résilient de D-032 : délai par requête, rejeu borné aux
    // lectures GET/HEAD, journal des requêtes lentes (chemin seul, jamais la
    // query string). Les `Gateway Timeout` intermittents de l'hébergé gratuit
    // remontaient sinon en 500 nu — voir le ticket.
    global: { fetch: resilientFetch(fetch) },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : le rafraîchissement du jeton
          // est déjà fait par le middleware, il n'y a rien à rattraper ici.
        }
      },
    },
  });
}
