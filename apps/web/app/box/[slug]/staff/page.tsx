import {
  DirectoryRowSchema,
  fetchMe,
  findMembershipBySlug,
  tenantScope,
} from '@rack/core/supabase';
import { serverClient } from '../../../../lib/supabase/server';
import { Notice } from '../notice';
import { Directory } from './directory';
import { Invitations } from './invitations';
import styles from './staff.module.css';

/**
 * Staff & Roles — voir qui est là, changer un rôle, inviter, retirer.
 *
 * L'annuaire vient de `member_admin_directory` (D-001), une vue en
 * `security_invoker = false` dont le `WHERE` — `current_admin_tenant_ids()` —
 * est **la seule chose** entre un membre et `public.users` entière. Elle est
 * donc lue comme le reste : à travers `tenantScope`, filtrée sur la box active.
 */
export default async function StaffPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null) return <Notice kind="unknown_box" />;

  const scope = tenantScope(client, membership.tenant_id);

  const [annuaire, invitations] = await Promise.all([
    scope.selectView('member_admin_directory').order('joined_at'),
    scope.select('invitations').order('created_at', { ascending: false }),
  ]);

  // Le schéma Zod dit la forme attendue de la vue : une colonne renommée casse
  // ici, en nommant la colonne, plutôt que trois écrans plus loin.
  const membres = DirectoryRowSchema.array().parse(annuaire.data ?? []);

  return (
    <div className={styles.page}>
      <Directory slug={slug} rows={membres} actorRole={membership.role} />
      <Invitations slug={slug} invitations={invitations.data ?? []} actorRole={membership.role} />
    </div>
  );
}
