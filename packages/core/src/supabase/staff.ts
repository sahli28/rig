/**
 * Staff & Roles — l'annuaire administratif d'une box et ses mutations.
 *
 * Les trois mutations passent par des fonctions SQL `security definer` : la
 * matrice de rôles de la spec §5.2 vit **dans la base**, pas dans l'écran
 * (`.claude/rules/database.md` — `memberships` n'a aucune policy d'écriture).
 * Ce fichier ne fait que nommer les portes au même endroit.
 */

import { z } from 'zod';
import type { RigClient } from './client';
import { MEMBERSHIP_ROLES, MEMBERSHIP_STATUSES } from './me';

/** Une ligne de `member_admin_directory` (D-001), telle que l'écran la lit. */
export const DirectoryRowSchema = z.object({
  membership_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(MEMBERSHIP_ROLES),
  status: z.enum(MEMBERSHIP_STATUSES),
  email: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  joined_at: z.string(),
});

export type DirectoryRow = z.infer<typeof DirectoryRowSchema>;

export type DirectoryFilter = {
  q?: string;
  role?: string;
  status?: string;
};

/**
 * Recherche et filtres de l'annuaire, **en mémoire**.
 *
 * Une box compte des centaines de membres, pas des millions : filtrer côté
 * client évite un aller-retour par frappe, et le jour où ça ne suffira plus, la
 * réponse sera une recherche plein texte en base, pas un `ilike` par-dessus.
 *
 * La recherche porte sur le nom **et** l'e-mail : c'est un annuaire
 * administratif, la box est responsable de traitement de ses membres
 * (`.claude/rules/privacy.md`), et retrouver quelqu'un par son adresse est le
 * cas d'usage réel — un homonyme se distingue par là.
 */
export function filterDirectory(
  rows: readonly DirectoryRow[],
  filtre: DirectoryFilter = {},
): DirectoryRow[] {
  const q = (filtre.q ?? '').trim().toLocaleLowerCase();

  return rows.filter((row) => {
    if (filtre.role !== undefined && filtre.role !== '' && row.role !== filtre.role) return false;
    if (filtre.status !== undefined && filtre.status !== '' && row.status !== filtre.status) {
      return false;
    }
    if (q === '') return true;

    const champs = [row.first_name ?? '', row.last_name ?? '', row.email];
    return champs.some((champ) => champ.toLocaleLowerCase().includes(q));
  });
}

/** Nom affichable d'une ligne d'annuaire. L'e-mail quand la fiche est vide. */
export function displayName(row: DirectoryRow): string {
  const nom = [row.first_name, row.last_name]
    .filter((part) => part !== null)
    .join(' ')
    .trim();
  return nom.length > 0 ? nom : row.email;
}

/**
 * État réel d'une invitation.
 *
 * `PENDING` ne veut pas dire « en cours » : la base ne bascule le statut à
 * `EXPIRED` qu'à la **tentative d'usage** (`accept_invitation`), donc une
 * invitation périmée reste `PENDING` en base, parfois pendant des mois. L'écran
 * qui afficherait le statut brut mentirait.
 */
export const INVITATION_STATES = ['PENDING', 'EXPIRED', 'ACCEPTED', 'REVOKED'] as const;
export type InvitationState = (typeof INVITATION_STATES)[number];

export function invitationState(
  invitation: { status: string; expires_at: string },
  now: Date = new Date(),
): InvitationState {
  if (invitation.status === 'ACCEPTED') return 'ACCEPTED';
  if (invitation.status === 'REVOKED') return 'REVOKED';
  if (invitation.status === 'EXPIRED') return 'EXPIRED';
  return new Date(invitation.expires_at).getTime() <= now.getTime() ? 'EXPIRED' : 'PENDING';
}

/**
 * Rôles qu'un acteur peut attribuer ou inviter.
 *
 * **Miroir** de la matrice portée par `create_invitation()` et
 * `set_member_role()`, qui lèvent `MANAGER_CANNOT_GRANT_ROLE`. L'écran masque
 * l'option, la base la refuse — deux couches, et c'est la base qui fait foi.
 */
export function grantableRoles(actorRole: string): readonly string[] {
  return actorRole === 'OWNER' ? MEMBERSHIP_ROLES : ['MEMBER', 'COACH'];
}

/** Change le rôle d'une appartenance. Jamais un `update` : la base l'interdit. */
export async function setMemberRole(
  client: RigClient,
  membershipId: string,
  role: (typeof MEMBERSHIP_ROLES)[number],
): Promise<void> {
  const { error } = await client.rpc('set_member_role', {
    p_membership_id: membershipId,
    p_role: role,
  });
  if (error) throw error;
}

/** Exclut un membre. Distinct d'un départ volontaire — cf. `membership_status`. */
export async function removeMember(client: RigClient, membershipId: string): Promise<void> {
  const { error } = await client.rpc('remove_member', { p_membership_id: membershipId });
  if (error) throw error;
}

/**
 * Émet une invitation et rend le jeton **en clair, une seule fois** (D-005).
 *
 * La base n'en garde que l'empreinte SHA-256 : ce retour est le seul moment de
 * son existence. L'écran doit l'afficher immédiatement et le dire — il n'y a pas
 * de « réafficher », seulement « régénérer ».
 */
export async function createInvitation(
  client: RigClient,
  input: { tenantId: string; email?: string | null; role: (typeof MEMBERSHIP_ROLES)[number] },
): Promise<string> {
  // Construit à la main : `exactOptionalPropertyTypes` distingue « clé absente »
  // de « clé à `undefined` », et une invitation sans e-mail — le QR mural — doit
  // omettre le paramètre, pas l'envoyer nul.
  const args: { p_tenant_id: string; p_role: (typeof MEMBERSHIP_ROLES)[number]; p_email?: string } =
    { p_tenant_id: input.tenantId, p_role: input.role };
  const email = input.email?.trim();
  if (email !== undefined && email.length > 0) args.p_email = email;

  const { data, error } = await client.rpc('create_invitation', args);
  if (error) throw error;
  return z.string().parse(data);
}
