'use server';

/**
 * Les deux écritures du parcours d'invitation.
 *
 * Toutes deux sur le serveur, pour la même raison : le contrôle d'adresse doit
 * précéder l'envoi du lien, et rien de ce qui suit ne doit dépendre d'un état
 * conservé dans le navigateur — la personne le quitte pour aller lire son
 * e-mail.
 */

import { headers } from 'next/headers';
import { z } from 'zod';
import { acceptInvitation, invitationAcceptsEmail } from '@rig/core/supabase';
import { errorMessageKeyOf } from '@rig/core';
import { serverClient } from '../../../lib/supabase/server';
import type { ActionState } from './action-state';

const EmailSchema = z.string().trim().email();

/**
 * Origine de la requête, pour construire l'URL de retour du lien magique.
 *
 * Lue dans les en-têtes plutôt que configurée : le pilote tournera sur un
 * domaine qu'on ne connaît pas encore, et une variable d'environnement de plus
 * est une variable de plus à oublier au déploiement.
 */
async function origine(): Promise<string> {
  const entetes = await headers();
  const direct = entetes.get('origin');
  if (direct !== null && direct.length > 0) return direct;

  const host = entetes.get('x-forwarded-host') ?? entetes.get('host') ?? 'localhost:3000';
  const proto =
    entetes.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Envoie le lien de connexion, **après** avoir vérifié que l'invitation vaut
 * pour cette adresse.
 *
 * L'ordre est tout : sans ce contrôle, une adresse qui ne correspond pas reçoit
 * son lien, **crée un compte** — `shouldCreateUser` est nécessairement vrai ici,
 * l'invité n'a pas encore de compte — puis se voit refuser l'invitation par
 * `accept_invitation()`. Elle repart avec un compte et sans appartenance, sans
 * comprendre ce qui s'est passé.
 */
export async function sendInvitationLink(
  token: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const brut = form.get('email');
  const parsed = EmailSchema.safeParse(typeof brut === 'string' ? brut : '');
  if (!parsed.success) return { status: 'error', key: 'auth.email_invalid' };

  const supabase = await serverClient();

  const accepte = await invitationAcceptsEmail(supabase, token, parsed.data);
  if (!accepte) return { status: 'error', key: 'invitation.email_mismatch' };

  const redirection = new URL('/auth/callback', await origine());
  redirection.searchParams.set('next', `/invitation/${token}`);

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: redirection.toString(), shouldCreateUser: true },
  });

  if (error) {
    return {
      status: 'error',
      key:
        (error as { status?: number }).status === 429
          ? 'auth.too_many_requests'
          : errorMessageKeyOf(error),
    };
  }

  return { status: 'sent', email: parsed.data };
}

/**
 * Consomme l'invitation. **Une action, pas un `GET`** : rafraîchir la page ne
 * doit pas rejouer une acceptation, et `accept_invitation()` est à usage unique
 * — la seconde tentative échouerait en `INVITATION_ALREADY_USED`, ce qui
 * afficherait une erreur à quelqu'un qui vient pourtant de réussir.
 */
export async function joinBox(
  token: string,
  _prev: ActionState,
  _form: FormData,
): Promise<ActionState> {
  const supabase = await serverClient();

  try {
    await acceptInvitation(supabase, token);
    return { status: 'joined' };
  } catch (error) {
    return { status: 'error', key: errorMessageKeyOf(error) };
  }
}
