'use server';

import { z } from 'zod';
import { acceptPendingInvitation } from '@rig/core/supabase';
import { errorMessageKeyOf } from '@rig/core';
import { serverClient } from '../../lib/supabase/server';
import type { JoinState } from './join-state';

/**
 * Rejoint une box par une invitation qui attend l'adresse de la session.
 *
 * **Une action, pas un `GET`** : un rafraîchissement ne doit pas rejouer une
 * acceptation, et la seconde tentative échouerait en `ALREADY_MEMBER` — une
 * erreur affichée à quelqu'un qui vient pourtant de réussir.
 */
export async function joinFromPending(
  invitationId: string,
  slug: string,
  _prev: JoinState,
  _form: FormData,
): Promise<JoinState> {
  const parsed = z.string().uuid().safeParse(invitationId);
  if (!parsed.success) return { status: 'error', key: 'errors.invitation_not_found' };

  const supabase = await serverClient();

  try {
    await acceptPendingInvitation(supabase, parsed.data);
  } catch (error) {
    return { status: 'error', key: errorMessageKeyOf(error) };
  }

  // **Pas de `revalidatePath` ici.** Revalider remplacerait la liste par sa
  // version à jour — désormais vide — avant que la personne ait lu « Bienvenue
  // chez … ». Elle lirait « aucune invitation en attente » juste après avoir
  // réussi, ce qui se lit comme un échec. La ligne porte son propre état.
  return { status: 'joined', slug };
}
