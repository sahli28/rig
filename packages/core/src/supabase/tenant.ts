/**
 * Rejoindre une box : son profil public avant connexion, puis l'acceptation
 * de l'invitation une fois la session ouverte.
 */

import { z } from 'zod';
import type { RackClient } from './client';

/**
 * Ce qu'une box expose **sans authentification** : sa marque, rien d'autre.
 * Aucun réglage, aucun effectif, aucune donnée personnelle — la fonction SQL
 * est `security definer` et ne rend que ces sept colonnes.
 */
export const TenantPublicProfileSchema = z.object({
  slug: z.string(),
  name: z.string(),
  app_name: z.string(),
  logo_url: z.string().nullable(),
  /**
   * Nuls quand la box n'a pas de ligne dans `themes`. La fonction SQL joint en
   * **externe** exprès : une jointure interne faisait disparaître la box de son
   * propre profil public, et rendait ses invitations « invalides » sans qu'aucun
   * écran ne puisse le dire. `brandFromPublicProfile()` comble avec
   * `DEFAULT_BRAND`.
   */
  primary_color: z.string().nullable(),
  radius: z.number().nullable(),
  font: z.string().nullable(),
});

export type TenantPublicProfile = z.infer<typeof TenantPublicProfileSchema>;

/**
 * Profil public d'une box, par son `slug`.
 *
 * Un slug inconnu rend `null`, exactement comme une box fermée ou supprimée :
 * la fonction SQL ne distingue pas les trois, et l'écran ne doit pas non plus.
 * Confirmer l'existence d'une box à qui tape des slugs au hasard serait déjà
 * une divulgation.
 */
export async function fetchTenantPublicProfile(
  client: RackClient,
  slug: string,
): Promise<TenantPublicProfile | null> {
  const { data, error } = await client.rpc('tenant_public_profile', { p_slug: slug });
  if (error) throw error;

  const first = data?.[0];
  return first === undefined ? null : TenantPublicProfileSchema.parse(first);
}

/**
 * Ce qu'une invitation laisse voir **avant** toute connexion : la marque de la
 * box, le rôle proposé, et l'adresse **masquée** si l'invitation est nominative.
 *
 * Les sept premiers champs ont la forme de `TenantPublicProfileSchema` à
 * dessein : `brandFromPublicProfile()` s'applique aux deux sans conversion.
 */
export const InvitationPreviewSchema = TenantPublicProfileSchema.extend({
  role: z.string(),
  nominative: z.boolean(),
  /** `l***@example.com`. Nul pour un QR mural, qui n'a pas de destinataire. */
  email_masked: z.string().nullable(),
});

export type InvitationPreview = z.infer<typeof InvitationPreviewSchema>;

/**
 * Aperçu d'une invitation, par son jeton.
 *
 * `null` pour un jeton inconnu, expiré, révoqué, déjà consommé, ou d'une box
 * fermée : la fonction SQL ne distingue pas les cinq, et l'écran ne doit pas non
 * plus. Un écran qui dirait « expirée » à qui essaie des jetons au hasard lui
 * confirmerait que le jeton a existé.
 */
export async function fetchInvitationPreview(
  client: RackClient,
  token: string,
): Promise<InvitationPreview | null> {
  const { data, error } = await client.rpc('invitation_preview', { p_token: token });
  if (error) throw error;

  const first = data?.[0];
  return first === undefined ? null : InvitationPreviewSchema.parse(first);
}

/**
 * L'invitation est-elle ouverte à cette adresse ?
 *
 * À appeler **avant** `signInWithOtp` : sans ce contrôle, une adresse qui ne
 * correspond pas reçoit son lien, crée un compte, puis se voit refuser
 * l'invitation — la personne se retrouve avec un compte et sans appartenance.
 */
export async function invitationAcceptsEmail(
  client: RackClient,
  token: string,
  email: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('invitation_accepts_email', {
    p_token: token,
    p_email: email,
  });
  if (error) throw error;
  return data === true;
}

/** Une invitation qui attend l'appelant, sans qu'il détienne de jeton. */
export const PendingInvitationSchema = z.object({
  invitation_id: z.string().uuid(),
  tenant_slug: z.string(),
  tenant_name: z.string(),
  role: z.string(),
  expires_at: z.string(),
});

export type PendingInvitation = z.infer<typeof PendingInvitationSchema>;

/**
 * Les invitations en attente pour l'adresse **vérifiée** de la session.
 *
 * La fonction SQL ne prend **aucun paramètre**, et c'est l'invariant : avec une
 * adresse en argument, elle deviendrait un annuaire d'invitations lisible à
 * travers tous les tenants. Même règle que `current_tenant_ids()`.
 */
export async function fetchPendingInvitations(client: RackClient): Promise<PendingInvitation[]> {
  const { data, error } = await client.rpc('pending_invitations_for_me');
  if (error) throw error;
  return PendingInvitationSchema.array().parse(data ?? []);
}

/**
 * Rejoint une box par une invitation qu'on n'a pas eu à recevoir : c'est la
 * porte des personnes importées par leur box (P1-001d).
 *
 * Les contrôles sont exactement ceux de `acceptInvitation()` — les deux
 * fonctions SQL partagent `claim_invitation()`, précisément pour qu'aucune des
 * deux ne puisse en perdre un en route.
 */
export async function acceptPendingInvitation(
  client: RackClient,
  invitationId: string,
): Promise<string> {
  const { data, error } = await client.rpc('accept_pending_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
  return z.string().uuid().parse(data);
}

/**
 * Accepte une invitation et rend l'identifiant de la box rejointe.
 *
 * Toute la logique — expiration, jeton déjà consommé, adresse non
 * correspondante, box fermée — vit dans la fonction SQL, en une transaction
 * verrouillée. Ici on ne fait que relayer l'erreur, qui porte son code
 * applicatif : `INVITATION_EXPIRED` et `INVITATION_ALREADY_USED` partagent le
 * même SQLSTATE et ne se distinguent que par lui.
 */
export async function acceptInvitation(client: RackClient, token: string): Promise<string> {
  const { data, error } = await client.rpc('accept_invitation', { p_token: token });
  if (error) throw error;
  return z.string().uuid().parse(data);
}
