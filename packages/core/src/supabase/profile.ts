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
import type { RigClient } from './client';
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
  client: RigClient,
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

/** Repris des types générés : la liste des finalités fait foi en base. */
export const CONSENT_PURPOSES = Constants.public.Enums.consent_purpose;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/**
 * Consentements de **plateforme** : ils engagent RIG, pas la box, et s'écrivent
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
export async function fetchPolicyVersion(client: RigClient): Promise<string> {
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
  client: RigClient,
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
