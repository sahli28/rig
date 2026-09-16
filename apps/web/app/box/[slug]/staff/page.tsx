import {
  DirectoryRowSchema,
  accessUntil,
  can,
  fetchMe,
  fetchMemberSubscriptions,
  findMembershipBySlug,
  localDay,
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
  if (!can(membership.role, 'staff')) return <Notice kind="role_forbidden" />;

  const scope = tenantScope(client, membership.tenant_id);

  const [annuaire, invitations, abonnements, scoped] = await Promise.all([
    scope.selectView('member_admin_directory').order('joined_at'),
    scope.select('invitations').order('created_at', { ascending: false }),
    // La RLS borne : OWNER/MANAGER lisent toute la box (P2-018).
    fetchMemberSubscriptions(client, membership.tenant_id),
    // Le fuseau de la box : « aujourd'hui » se juge chez elle, pas sur le serveur.
    fetchMe(client, membership.tenant_id),
  ]);

  // Le schéma Zod dit la forme attendue de la vue : une colonne renommée casse
  // ici, en nommant la colonne, plutôt que trois écrans plus loin.
  const membres = DirectoryRowSchema.array().parse(annuaire.data ?? []);

  const timezone = scoped.current_tenant?.timezone ?? 'Europe/Paris';
  const aujourdhui = localDay(new Date().toISOString(), timezone);
  const accessByMembership: Record<string, string> = {};
  for (const row of membres) {
    const until = accessUntil(
      abonnements.filter((s) => s.membership_id === row.membership_id),
      aujourdhui,
    );
    if (until !== null) accessByMembership[row.membership_id] = until;
  }

  return (
    <div className={styles.page}>
      <Directory
        slug={slug}
        rows={membres}
        actorRole={membership.role}
        accessByMembership={accessByMembership}
      />
      <Invitations slug={slug} invitations={invitations.data ?? []} actorRole={membership.role} />
    </div>
  );
}
