'use server';

/**
 * Les écritures de l'écran Staff & Roles.
 *
 * Aucune ne touche `memberships` directement : la table n'a **aucune policy
 * d'écriture** (`.claude/rules/database.md`, piège 2), et toute la matrice de
 * rôles de la spec §5.2 vit dans `set_member_role()` et `remove_member()`. Ces
 * actions ne font que redériver la box de la session et relayer.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  MEMBERSHIP_ROLES,
  createInvitation,
  fetchMe,
  findMembershipBySlug,
  removeMember,
  setMemberRole,
  tenantScope,
  type RigClient,
} from '@rig/core/supabase';
import { errorMessageKeyOf } from '@rig/core';
import { serverClient } from '../../../../lib/supabase/server';
import type { ActionState } from './action-state';

const FORBIDDEN: ActionState = { status: 'error', key: 'errors.forbidden_role' };
const INVALID: ActionState = { status: 'error', key: 'settings.error_invalid' };

const RoleSchema = z.enum(MEMBERSHIP_ROLES);
const IdSchema = z.string().uuid();
const EmailSchema = z.string().trim().email();

type Contexte = { client: RigClient; tenantId: string; role: string };

/** Box et rôle redérivés de la session, jamais reçus du formulaire. */
async function contexte(slug: string): Promise<Contexte | null> {
  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null) return null;
  if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') return null;

  return { client, tenantId: membership.tenant_id, role: membership.role };
}

function echec(error: unknown): ActionState {
  return { status: 'error', key: errorMessageKeyOf(error) };
}

function texte(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function changeRole(
  slug: string,
  membershipId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const cible = IdSchema.safeParse(membershipId);
  const role = RoleSchema.safeParse(texte(form.get('role')));
  if (!cible.success || !role.success) return INVALID;

  try {
    // La fonction refuse elle-même ce que l'écran a masqué : un MANAGER qui
    // forgerait `OWNER` reçoit `MANAGER_CANNOT_GRANT_ROLE`. Deux couches.
    await setMemberRole(ctx.client, cible.data, role.data);
  } catch (error) {
    return echec(error);
  }

  revalidatePath(`/box/${slug}/staff`);
  return { status: 'ok' };
}

export async function excludeMember(
  slug: string,
  membershipId: string,
  _prev: ActionState,
): Promise<ActionState> {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const cible = IdSchema.safeParse(membershipId);
  if (!cible.success) return INVALID;

  try {
    await removeMember(ctx.client, cible.data);
  } catch (error) {
    return echec(error);
  }

  revalidatePath(`/box/${slug}/staff`);
  return { status: 'ok' };
}

/**
 * Émet une invitation et **rend le jeton en clair** à l'écran, une seule fois.
 *
 * Le motif est celui des clés d'API : la base n'en garde que l'empreinte, il n'y
 * a pas de « réafficher », seulement « régénérer » — qui invalide le précédent
 * (D-005). C'est aussi pourquoi ce retour ne passe par aucun journal.
 */
export async function issueInvitation(
  slug: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const role = RoleSchema.safeParse(texte(form.get('role')));
  if (!role.success) return INVALID;

  // Une invitation sans e-mail est légitime : c'est le QR mural, réutilisable
  // jusqu'à révocation.
  const brut = texte(form.get('email'));
  let email: string | null = null;
  if (brut.length > 0) {
    const parsed = EmailSchema.safeParse(brut);
    if (!parsed.success) return { status: 'error', key: 'auth.email_invalid' };
    email = parsed.data;
  }

  try {
    const token = await createInvitation(ctx.client, {
      tenantId: ctx.tenantId,
      email,
      role: role.data,
    });
    revalidatePath(`/box/${slug}/staff`);
    return { status: 'issued', token };
  } catch (error) {
    return echec(error);
  }
}

/**
 * Révoque une invitation. C'est un `update status`, pas une suppression : une
 * invitation révoquée reste une trace de ce qui a été proposé à qui.
 */
export async function revokeInvitation(
  slug: string,
  invitationId: string,
  _prev: ActionState,
): Promise<ActionState> {
  const ctx = await contexte(slug);
  if (ctx === null) return FORBIDDEN;

  const cible = IdSchema.safeParse(invitationId);
  if (!cible.success) return INVALID;

  const { error } = await tenantScope(ctx.client, ctx.tenantId)
    .update('invitations', { status: 'REVOKED' })
    .eq('id', cible.data);
  if (error) return echec(error);

  revalidatePath(`/box/${slug}/staff`);
  return { status: 'ok' };
}
