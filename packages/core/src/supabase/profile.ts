/**
 * Fin d'inscription : compléter son profil, poser ses consentements.
 *
 * Les deux écritures passent par la RLS, sans fonction SQL : `users` a une
 * policy `id = auth.uid()` doublée de droits **au niveau colonne**, et
 * `consents` une policy d'insertion sur ses propres lignes. Ajouter une
 * fonction ici ne déplacerait aucune décision d'autorisation vers la base —
 * elles y sont déjà.
 */

import { z } from 'zod';
import type { Locale } from '../i18n/types';
import type { RackClient } from './client';
import { Constants, type Database } from './types.gen';

/** Colonnes du profil que `grant update (…) on public.users` autorise réellement. */
export const ProfilePatchSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().max(80).nullable().optional(),
  locale: z.enum(['fr', 'en']).optional(),
  avatar_url: z.string().url().nullable().optional(),
});

export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

/**
 * Met à jour son propre profil. `userId` sert de filtre explicite : la policy
 * l'imposerait de toute façon, mais un `update` sans `where` s'écrit trop
 * facilement, et l'habitude vaut mieux que la confiance dans le filet.
 */
export async function updateProfile(
  client: RackClient,
  userId: string,
  patch: ProfilePatch,
): Promise<void> {
  const parsed = ProfilePatchSchema.parse(patch);

  // Construit à la main plutôt que passé tel quel : `exactOptionalPropertyTypes`
  // distingue « clé absente » de « clé à `undefined` », et PostgREST écrirait
  // un `null` là où l'intention était de ne pas toucher à la colonne.
  const values: Database['public']['Tables']['users']['Update'] = {
    first_name: parsed.first_name,
  };
  if (parsed.last_name !== undefined) values.last_name = parsed.last_name;
  if (parsed.locale !== undefined) values.locale = parsed.locale;
  if (parsed.avatar_url !== undefined) values.avatar_url = parsed.avatar_url;

  const { error } = await client.from('users').update(values).eq('id', userId);
  if (error) throw error;
}

/**
 * Écrit **la seule langue** du compte (D-004, rang 2).
 *
 * Distincte d'`updateProfile`, qui exige un prénom : réconcilier `users.locale`
 * ne doit ni supposer que le reste du profil est connu, ni risquer de le
 * réécrire. Passer par `updateProfile` obligerait à relire un prénom pour
 * changer une langue, et à le renvoyer — une écriture de plus, sur des colonnes
 * que personne n'a touchées.
 *
 * `locale` fait bien partie du `grant update (…) on public.users` : la policy
 * `id = auth.uid()` et les droits de colonne suffisent, aucune fonction SQL
 * n'est nécessaire.
 */
export async function updateLocale(
  client: RackClient,
  userId: string,
  locale: Locale,
): Promise<void> {
  const { error } = await client.from('users').update({ locale }).eq('id', userId);
  if (error) throw error;
}

/** Repris des types générés : la liste des finalités fait foi en base. */
export const CONSENT_PURPOSES = Constants.public.Enums.consent_purpose;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/**
 * Consentements de **plateforme** : ils engagent Rack, pas la box, et s'écrivent
 * donc avec `tenant_id` nul (`.claude/rules/privacy.md`). Tous les autres
 * portent l'identifiant de la box, qui devient responsable de traitement et
 * doit pouvoir en administrer la preuve.
 */
export const PLATFORM_CONSENT_PURPOSES: readonly ConsentPurpose[] = ['TERMS', 'PRIVACY'];

export function isPlatformConsent(purpose: ConsentPurpose): boolean {
  return PLATFORM_CONSENT_PURPOSES.includes(purpose);
}

export interface ConsentChoice {
  purpose: ConsentPurpose;
  granted: boolean;
}

export interface RecordConsentsInput {
  userId: string;
  /** Box active. Obligatoire dès qu'un consentement de box figure dans les choix. */
  tenantId?: string | null;
  policyVersion: string;
  choices: readonly ConsentChoice[];
}

/**
 * Version courante des documents contractuels, lue **en base**. La dupliquer
 * côté client la ferait diverger le jour d'une mise à jour des CGU, et
 * `me()` réclamerait alors indéfiniment un consentement déjà donné.
 */
export async function fetchPolicyVersion(client: RackClient): Promise<string> {
  const { data, error } = await client.rpc('current_policy_version');
  if (error) throw error;
  return z.string().min(1).parse(data);
}

/**
 * Écrit les consentements. `consents` est append-only : un refus est une ligne
 * à `granted = false`, une rétractation une ligne plus récente. Rien n'est
 * jamais modifié ni supprimé, et c'est ce qui rend la preuve opposable.
 *
 * Ce helper ne passe pas par `tenantScope` : il écrit délibérément des lignes
 * **hors box** (`tenant_id` nul) à côté de lignes de box, ce que le filtre de
 * tenant actif interdit par construction.
 */
export async function recordConsents(
  client: RackClient,
  { userId, tenantId, policyVersion, choices }: RecordConsentsInput,
): Promise<void> {
  if (choices.length === 0) return;

  const needsTenant = choices.some((choice) => !isPlatformConsent(choice.purpose));
  if (needsTenant && !tenantId) {
    throw new Error(
      'Un consentement de box exige la box active : sans elle, la preuve serait ' +
        'écrite sans responsable de traitement.',
    );
  }

  const rows = choices.map((choice) => ({
    user_id: userId,
    tenant_id: isPlatformConsent(choice.purpose) ? null : (tenantId ?? null),
    purpose: choice.purpose,
    granted: choice.granted,
    policy_version: policyVersion,
  }));

  const { error } = await client.from('consents').insert(rows);
  if (error) throw error;
}

/**
 * L'opposition à figurer dans la feuille d'inscrits de sa box (P1-003c).
 *
 * **Ce n'est pas un consentement**, et c'est pour ça que ça ne passe pas par
 * `recordConsents()` : `consents` prouve un accord donné, avec sa version de
 * politique et son horodatage. Ici la base juridique est l'intérêt légitime, et
 * ce qui s'exerce est un **droit d'opposition** — une préférence portée par
 * l'appartenance, donc par box. La trace vit dans `audit_logs`, écrite par la
 * fonction SQL.
 *
 * `hidden` et non `visible` : la valeur par défaut d'une colonne booléenne est
 * `false`, et le défaut du produit est **visible**. Nommer la colonne par son
 * exception évite une double négation en base.
 */
export async function setRosterVisibility(
  client: RackClient,
  { tenantId, hidden }: { tenantId: string; hidden: boolean },
): Promise<void> {
  const { error } = await client.rpc('set_roster_visibility', {
    p_tenant_id: tenantId,
    p_hidden: hidden,
  });
  if (error) throw error;
}

/** Ce que l'écran de préférences affiche, et qui vient de deux endroits. */
export interface MyPreferences {
  /** Opposition à la feuille d'inscrits, portée par l'appartenance. */
  hiddenFromRoster: boolean;
  /** Consentements de box, `null` tant que la personne n'a rien dit. */
  push: boolean | null;
  leaderboard: boolean | null;
}

/**
 * Relit les préférences de la box active.
 *
 * **Deux sources, et elles ne se confondent pas** : l'opposition vit sur
 * l'appartenance (intérêt légitime, P1-003c), les consentements dans `consents`
 * (append-only, donc c'est la ligne **la plus récente** qui fait foi). Les
 * mélanger dans une seule table aurait effacé cette différence, qui est
 * exactement ce qu'un contrôle RGPD regarde.
 */
export async function fetchMyPreferences(
  client: RackClient,
  { tenantId, userId }: { tenantId: string; userId: string },
): Promise<MyPreferences> {
  const [visibilite, consents] = await Promise.all([
    // **Une RPC et non une lecture de `memberships`.** La colonne est hors du
    // grant de lecture de la table depuis P1-003c : un `select *` y échoue en
    // `42501`, et c'est voulu — sans ce grant de colonne, n'importe quel membre
    // de la box lisait l'opposition de tous les autres. `get_roster_visibility()`
    // ne rend que la sienne.
    client.rpc('get_roster_visibility', { p_tenant_id: tenantId }),
    client
      .from('consents')
      .select('purpose, granted, granted_at')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .order('granted_at', { ascending: false }),
  ]);

  if (visibilite.error !== null) throw visibilite.error;
  if (consents.error !== null) throw consents.error;

  // Le premier trouvé est le plus récent : la table est append-only, un refus
  // est une ligne de plus, et c'est la dernière qui vaut.
  const dernier = (purpose: string): boolean | null =>
    (consents.data ?? []).find((row) => row.purpose === purpose)?.granted ?? null;

  return {
    hiddenFromRoster: visibilite.data ?? false,
    push: dernier('PUSH'),
    leaderboard: dernier('LEADERBOARD'),
  };
}
