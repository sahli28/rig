'use server';

/**
 * L'écriture de l'import.
 *
 * **Le fichier n'arrive jamais ici** : il est décodé, analysé et mappé dans le
 * navigateur, et seules les lignes retenues traversent le réseau — sans les
 * colonnes qu'on n'importe pas. Un CSV d'effectif est un fichier de données
 * personnelles ; ne pas le recevoir, c'est ne jamais avoir à le stocker, le
 * journaliser, ni l'oublier dans un répertoire temporaire
 * (`.claude/rules/privacy.md`).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fetchMe, findMembershipBySlug, importMembers } from '@rig/core/supabase';
import { ImportRowSchema, MAX_IMPORT_ROWS, errorMessageKeyOf } from '@rig/core';
import { serverClient } from '../../../../lib/supabase/server';
import type { ImportState } from './import-state';

const RowsSchema = z.array(ImportRowSchema).min(1).max(MAX_IMPORT_ROWS);

export async function runImport(
  slug: string,
  _prev: ImportState,
  form: FormData,
): Promise<ImportState> {
  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null || (membership.role !== 'OWNER' && membership.role !== 'MANAGER')) {
    return { status: 'error', key: 'errors.forbidden_role' };
  }

  // Les lignes arrivent en JSON, revalidées ici : l'analyse du navigateur sert
  // l'écran, elle ne fait pas autorité. La base les revalide une troisième fois.
  const brut = form.get('rows');
  let parsed;
  try {
    parsed = RowsSchema.safeParse(JSON.parse(typeof brut === 'string' ? brut : '[]'));
  } catch {
    return { status: 'error', key: 'errors.import_invalid_row' };
  }
  if (!parsed.success) return { status: 'error', key: 'errors.import_invalid_row' };

  try {
    const result = await importMembers(client, membership.tenant_id, parsed.data);
    revalidatePath(`/box/${slug}/membres`);
    revalidatePath(`/box/${slug}/staff`);
    return { status: 'done', result };
  } catch (error) {
    return { status: 'error', key: errorMessageKeyOf(error) };
  }
}
