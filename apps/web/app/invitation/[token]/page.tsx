import { cache } from 'react';
import type { Metadata } from 'next';
import { brandFromPublicProfile } from '@rack/ui/theme';
import { fetchInvitationPreview, invitationAcceptsEmail } from '@rack/core/supabase';
import { ThemeStyle } from '../../theme-style';
import { serverClient } from '../../../lib/supabase/server';
import { supabaseConfigured } from '../../../lib/supabase/config';
import { Notice } from '../../box/[slug]/notice';
import { JoinCard } from './join-card';

/**
 * Une seule résolution du jeton par requête, partagée entre la page et ses
 * métadonnées : `generateMetadata` et le rendu s'exécutent séparément, et sans
 * ce `cache()` l'aperçu serait relu deux fois.
 */
const previewOf = cache(async (token: string) => {
  if (!supabaseConfigured) return null;
  const supabase = await serverClient();
  return fetchInvitationPreview(supabase, token);
});

/**
 * L'onglet du navigateur au nom de la box (P2-017). Le layout racine titre
 * « Rack » — correct pour le back-office, pas pour la seule page web qu'un
 * membre voit avec sa box : c'est chez elle qu'il croit arriver, et l'onglet
 * ne doit pas dire le contraire. Invitation invalide → pas de box à nommer,
 * le titre racine reste.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const preview = await previewOf(token);
  return preview === null ? {} : { title: preview.app_name };
}

/**
 * Rejoindre une box, depuis un lien ou un QR mural.
 *
 * **Cette page sort D-008 du chemin critique.** Jusqu'ici, le seul consommateur
 * d'invitation était l'app mobile via un deep link — donc un domaine et un
 * compte Apple. Une page web ne dépend de rien, et surtout : un QR encode une
 * URL, pas un jeton hexadécimal de 48 caractères. Sans elle, le QR d'affiliation
 * auquel D-005 a consacré tout un arbitrage était infabricable.
 *
 * Le jeton voyage dans l'URL, donc dans l'historique du navigateur et dans la
 * boîte mail. C'est inhérent à une invitation par lien — et c'est exactement
 * pour ça qu'elle est à usage unique et expirante.
 */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!supabaseConfigured) return <Notice kind="not_configured" />;

  const supabase = await serverClient();
  const preview = await previewOf(token);

  // Inconnue, expirée, révoquée, déjà consommée, ou box fermée : la fonction SQL
  // ne distingue pas les cinq, et cet écran non plus. Dire « expirée » à qui
  // essaie des jetons au hasard lui confirmerait que le jeton a existé.
  if (preview === null) return <Notice kind="invalid_invitation" />;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Une session déjà ouverte n'est pas forcément la bonne. Une invitation
  // nominative acceptée sous une autre adresse échoue en
  // `INVITATION_EMAIL_MISMATCH` **après coup**, et la personne se retrouve dans
  // un état d'où elle ne peut ni avancer ni revenir — le cul-de-sac que
  // « espace réservé au staff » vient de perdre. On tranche donc **avant**
  // d'afficher le bouton, et on offre la sortie.
  const session =
    user === null
      ? null
      : {
          email: user.email ?? '',
          matches: await invitationAcceptsEmail(supabase, token, user.email ?? ''),
        };

  return (
    <>
      {/* Aux couleurs de la box **avant** toute connexion : c'est chez elle que
          la personne croit arriver, pas chez Rack. */}
      <ThemeStyle brand={brandFromPublicProfile(preview)} />
      <JoinCard token={token} preview={preview} session={session} />
    </>
  );
}
