import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@rack/core/supabase';
import { supabaseConfigured, webSupabaseConfig } from '../../../lib/supabase/config';

/**
 * Point d'atterrissage du lien magique.
 *
 * Un **Route Handler**, et pas une page : l'échange du code contre une session
 * écrit des cookies, ce que Next n'autorise que dans un middleware ou un
 * gestionnaire de route. C'est la même raison qui fait que
 * `lib/supabase/server.ts` avale silencieusement ses écritures.
 *
 * Le même e-mail sert les deux plateformes : le mobile saisit le code à six
 * chiffres, le web suit le lien. Deux chemins d'authentification, et celui-ci
 * n'avait jamais été exercé faute d'écran pour le recevoir.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // `next` vient de notre propre écran de connexion. On ne garde que le chemin :
  // une URL absolue transformerait la redirection en tremplin vers un domaine
  // tiers, avec la session fraîchement posée.
  const requested = searchParams.get('next') ?? '/';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';

  if (!supabaseConfigured || code === null) {
    return NextResponse.redirect(`${origin}/login?erreur=lien`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  const { url, anonKey } = webSupabaseConfig();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Lien déjà consommé, expiré, ou ouvert dans un autre navigateur que celui
    // qui a demandé le code — le vérificateur PKCE est propre à l'appareil.
    return NextResponse.redirect(`${origin}/login?erreur=lien`);
  }

  return response;
}
