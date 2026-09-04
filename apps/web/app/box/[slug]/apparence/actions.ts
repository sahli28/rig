'use server';

/**
 * L'écriture du branding — **propriétaire uniquement**.
 *
 * La policy `themes_update` réserve déjà la table à l'OWNER : le contrôle
 * ci-dessous est de l'ergonomie, pas de la sécurité. Sans lui, un gestionnaire
 * qui forcerait l'URL recevrait un refus muet de la RLS (zéro ligne affectée)
 * plutôt qu'une phrase.
 */

import { revalidatePath } from 'next/cache';
import {
  BoxAppearanceSchema,
  fetchMe,
  findMembershipBySlug,
  tenantScope,
  type RackClient,
} from '@rack/core/supabase';
import { errorMessageKeyOf } from '@rack/core';
import { serverClient } from '../../../../lib/supabase/server';
import type { ActionState } from './action-state';

const FORBIDDEN: ActionState = { status: 'error', key: 'errors.forbidden_role' };
const INVALID: ActionState = { status: 'error', key: 'settings.error_invalid' };

async function contexteProprietaire(
  slug: string,
): Promise<{ client: RackClient; tenantId: string } | null> {
  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null || membership.role !== 'OWNER') return null;
  return { client, tenantId: membership.tenant_id };
}

function texte(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function saveAppearance(
  slug: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await contexteProprietaire(slug);
  if (ctx === null) return FORBIDDEN;

  const parsed = BoxAppearanceSchema.safeParse({
    app_name: texte(form.get('app_name')),
    primary_color: texte(form.get('primary_color')),
    radius: Number(texte(form.get('radius'))),
    font: texte(form.get('font')),
  });
  if (!parsed.success) return INVALID;

  // La couleur part **telle qu'elle a été saisie**. La correction de contraste
  // appartient à l'affichage (`buildTheme`) : l'écrire corrigée en base ferait
  // perdre le choix de la box, et l'aperçu n'aurait plus rien à expliquer.
  const { error } = await tenantScope(ctx.client, ctx.tenantId).update('themes', parsed.data);
  if (error) return { status: 'error', key: errorMessageKeyOf(error) };

  // Toute la coquille est repeinte par le layout de la box : c'est elle qu'il
  // faut revalider, pas seulement cette page.
  revalidatePath(`/box/${slug}`, 'layout');
  return { status: 'ok' };
}
