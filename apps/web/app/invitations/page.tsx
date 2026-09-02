import { redirect } from 'next/navigation';
import { fetchPendingInvitations } from '@rig/core/supabase';
import { serverClient } from '../../lib/supabase/server';
import { supabaseConfigured } from '../../lib/supabase/config';
import { Notice } from '../box/[slug]/notice';
import { PendingList } from './pending-list';

/**
 * « Ma box m'a inscrit·e » — la porte des personnes importées.
 *
 * C'est **l'URL qu'une box peut imprimer et envoyer en masse** : elle ne porte
 * aucun jeton, donc rien de secret. La personne se connecte avec l'adresse que
 * sa box a importée, et retrouve ici l'invitation qui l'attend.
 *
 * Sans cette page, un import de deux cents lignes obligerait à distribuer deux
 * cents jetons vivants — ce que D-005 a consacré un ticket entier à empêcher.
 */
export default async function InvitationsPage() {
  if (!supabaseConfigured) return <Notice kind="not_configured" />;

  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sans session, il n'y a rien à montrer : l'invitation se résout sur l'adresse
  // **vérifiée**, pas sur une adresse saisie.
  //
  // `inscription=1` parce qu'une personne qu'une box vient d'importer n'a pas
  // encore de compte : sans ça, elle arrive sur « utilisateur inconnu » et le
  // parcours s'arrête là. C'est le même geste que la page d'invitation par
  // jeton, sans le jeton.
  if (user === null) redirect('/login?next=%2Finvitations&inscription=1');

  const invitations = await fetchPendingInvitations(supabase);

  return <PendingList invitations={invitations} email={user.email ?? ''} />;
}
