/**
 * Fabrique de client Supabase, partagée par le mobile et le web.
 *
 * Ce qui est **volontairement absent** : la lecture de `process.env`. Metro et
 * Next remplacent `process.env.EXPO_PUBLIC_X` / `process.env.NEXT_PUBLIC_X` par
 * leur valeur **au texte**, au moment du bundling. Une lecture dynamique depuis
 * un paquet partagé ne serait donc jamais remplacée : elle rendrait `undefined`
 * à l'exécution, sans erreur de build. Chaque app lit ses propres variables,
 * littéralement, et passe la configuration ici.
 */

import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './types.gen';

/** Le client, typé par le schéma généré. Aucun autre type de client ne circule. */
export type RackClient = SupabaseClient<Database>;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const ConfigSchema = z.object({
  url: z.string().url(),
  // La clé `anon` est publique par construction : elle part dans le bundle et
  // ne donne accès qu'à ce que la RLS autorise. Seul son format est vérifié.
  anonKey: z.string().min(20),
});

/**
 * Valide la configuration avant de créer quoi que ce soit. Sans ce contrôle,
 * un `.env.local` absent donne un `Failed to construct URL: undefined` au
 * premier appel réseau, à trois écrans de la cause.
 */
export function readSupabaseConfig(
  // `| undefined` explicite : `process.env.X` vaut `undefined` quand la variable
  // manque, et `exactOptionalPropertyTypes` refuse de le confondre avec « absent ».
  raw: { url?: string | undefined; anonKey?: string | undefined },
  envPrefix: string,
): SupabaseConfig {
  const parsed = ConfigSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  throw new Error(
    `Configuration Supabase absente ou invalide (${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}).\n` +
      `Créer \`.env.local\` à la racine à partir de \`.env.example\`, avec ` +
      `${envPrefix}SUPABASE_URL et ${envPrefix}SUPABASE_ANON_KEY.\n` +
      `Les valeurs locales se lisent avec \`pnpm exec supabase status\`.`,
  );
}

/**
 * Crée le client. Les options d'authentification restent à la charge de
 * l'appelant : le mobile stocke la session dans le trousseau et ne lit jamais
 * l'URL, le web passe par des cookies (`@supabase/ssr`) pour que le rendu
 * serveur connaisse la personne connectée.
 */
export function createRackClient(
  config: SupabaseConfig,
  options?: SupabaseClientOptions<'public'>,
): RackClient {
  return createClient<Database>(config.url, config.anonKey, options);
}
