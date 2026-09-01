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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Aiguillage, ajouté par P1-001a. Deux règles, pas une de plus : le
  // back-office exige une session, et l'écran de connexion n'a rien à dire à
  // quelqu'un qui en a déjà une.
  //
  // Ce n'est **pas** la garde d'autorisation : les policies et
  // `current_admin_tenant_ids()` refusent déjà tout à qui n'a rien à y faire.
  // C'est de l'ergonomie — éviter une page vide là où une redirection est plus
  // claire.
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/box') && user === null) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    login.searchParams.set('next', `${pathname}${search}`);

    // « Session expirée » seulement si elle a existé. Un cookie `sb-…` présent
    // mais refusé par `getUser()`, c'est une session périmée ; aucun cookie,
    // c'est une première visite — lui annoncer une expiration serait faux, et
    // ce genre de message faux use la confiance dans tous les autres.
    if (request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'))) {
      login.searchParams.set('erreur', 'session');
    }
    return NextResponse.redirect(login);
  }

  if (pathname === '/login' && user !== null) {
    const home = request.nextUrl.clone();
    home.pathname = '/';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  // Tout sauf les fichiers statiques et les images : rafraîchir un cookie pour
  // servir une favicon coûterait un aller-retour par ressource.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
