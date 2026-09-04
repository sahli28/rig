import { readSupabaseConfig, type SupabaseConfig } from '@rack/core/supabase';

/**
 * Variables lues **littéralement** : Next remplace le texte
 * `process.env.NEXT_PUBLIC_…` au build. Une lecture indirecte ne serait jamais
 * remplacée et vaudrait `undefined` côté navigateur.
 */
const raw = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

/**
 * Le web sait vivre sans Supabase. Les écrans d'authentification sont sur le
 * mobile (P0-005a) ; ici, seule la session en cookies est branchée. Un
 * `.env.local` absent ne doit donc pas mettre en erreur la page publique ni la
 * galerie du système de design — il désactive la session, et le dit.
 */
export const supabaseConfigured = Boolean(raw.url && raw.anonKey);

/** Lève, avec un message qui nomme le fichier à créer, si on l'appelle sans configuration. */
export function webSupabaseConfig(): SupabaseConfig {
  return readSupabaseConfig(raw, 'NEXT_PUBLIC_');
}
