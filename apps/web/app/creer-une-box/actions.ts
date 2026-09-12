'use server';

/**
 * Créer sa box — l'**appelant minimal** de `create_tenant` (P1-020, règle 7).
 * Pas le self-onboarding complet (`P2-004`) : le strict nécessaire pour que la
 * box pilote naisse sans SQL de prod. L'appelant devient OWNER.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createTenant, NewBoxSchema } from '@rack/core/supabase';
import { errorMessageKeyOf } from '@rack/core';
import { serverClient } from '../../lib/supabase/server';
import type { NewBoxState } from './new-box-state';

export async function createBox(_prev: NewBoxState, form: FormData): Promise<NewBoxState> {
  const client = await serverClient();

  // La session fait foi (create_tenant lit auth.uid()). On le vérifie ici pour un
  // message clair plutôt qu'un `insufficient_privilege` brut ; la page redirige
  // déjà vers /login si personne n'est connecté.
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user === null) return { status: 'error', key: 'errors.forbidden_role' };

  const parsed = NewBoxSchema.safeParse({ name: form.get('name'), slug: form.get('slug') });
  if (!parsed.success) return { status: 'error', key: 'box_new.invalid' };

  try {
    await createTenant(client, parsed.data);
  } catch (error) {
    // Un slug déjà pris remonte en unique_violation, pas en app_error : la
    // contrainte `tenants_slug_key` tranche, sans course.
    if ((error as { code?: string }).code === '23505') {
      return { status: 'error', key: 'box_new.slug_taken' };
    }
    return { status: 'error', key: errorMessageKeyOf(error) };
  }

  // `redirect` hors du try : il lève un signal Next que le catch ne doit pas voir.
  revalidatePath('/');
  redirect(`/box/${parsed.data.slug}`);
}
