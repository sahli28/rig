import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@rig/core/supabase';
import { supabaseConfigured, webSupabaseConfig } from './lib/supabase/config';

/**
 * Rafraîchit la session à chaque requête.
 *
 * Sans ce passage, le jeton d'accès expire au bout de quinze minutes et les
 * Server Components voient un visiteur anonyme alors que le navigateur, lui, se
 * croit connecté. Le rafraîchissement ne peut pas se faire dans un Server
 * Component : il doit écrire des cookies, ce que Next n'autorise que dans un
 * middleware ou un Route Handler.
 */
export async function middleware(request: NextRequest) {
  // Pas de configuration Supabase : le web reste consultable (page publique,
  // galerie du système de design) sans session. Voir `lib/supabase/config.ts`.
  if (!supabaseConfigured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const { url, anonKey } = webSupabaseConfig();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // `getUser()` et pas `getSession()` : seul le premier revalide le jeton
  // auprès du serveur d'authentification. `getSession()` se contente de relire
  // le cookie, qu'un client peut avoir écrit lui-même.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Tout sauf les fichiers statiques et les images : rafraîchir un cookie pour
  // servir une favicon coûterait un aller-retour par ressource.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
