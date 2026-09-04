import {
  DirectoryRowSchema,
  fetchMe,
  findMembershipBySlug,
  tenantScope,
} from '@rack/core/supabase';
import { serverClient } from '../../../../lib/supabase/server';
import { Notice } from '../notice';
import { ImportScreen } from './import-screen';

/**
 * Import d'un effectif.
 *
 * **Sans lui, aucune box existante ne migre** (spec §19, R3) : c'est ce ticket
 * qui décide si le produit est achetable par une box déjà ouverte, ou seulement
 * par une box qui ouvre.
 *
 * Les adresses déjà connues descendent ici pour que la prévisualisation puisse
 * annoncer « déjà membre » et « déjà invitée » **avant** l'écriture, comme le
 * demande le ticket — et sur la même règle de normalisation que la base.
 *
 * *À noter, pas à corriger ici* : le partage entre « Équipe » et « Membres »
 * restera arbitraire tant que la Members List de la spec §6.2 — recherche,
 * filtres, actions groupées, fiche membre — n'existera pas.
 */
export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null) return <Notice kind="unknown_box" />;

  const scope = tenantScope(client, membership.tenant_id);
  const [annuaire, invitations] = await Promise.all([
    scope.selectView('member_admin_directory'),
    scope.select('invitations').eq('status', 'PENDING'),
  ]);

  const membres = DirectoryRowSchema.array().parse(annuaire.data ?? []);

  return (
    <ImportScreen
      slug={slug}
      existingEmails={membres.filter((m) => m.status === 'ACTIVE').map((m) => m.email)}
      pendingEmails={(invitations.data ?? [])
        .map((invitation) => invitation.email)
        .filter((email): email is string => email !== null)}
    />
  );
}
