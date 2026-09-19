import { can, fetchBoxDashboard, fetchMe, findMembershipBySlug } from '@rack/core/supabase';
import { serverClient } from '../../../lib/supabase/server';
import { Notice } from './notice';
import { DashboardScreen } from './dashboard-screen';

/**
 * Tableau de bord de la box (P2-004) — le premier écran du back-office (§6.2).
 *
 * Tout se lit **ici**, en un rendu serveur : la session, la box (par le slug de
 * l'URL, jamais un contexte), puis le snapshot `box_dashboard`. La présentation
 * descend en props vers un composant client (il porte `t()` et l'interaction du
 * graphe). Même patron que `reglages/page.tsx`.
 */
export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  // Le layout a déjà rendu ces cas ; ici, il ne reste que la course entre son
  // contrôle et le rendu de la page.
  if (membership === null) return <Notice kind="unknown_box" />;
  if (!can(membership.role, 'dashboard')) return <Notice kind="role_forbidden" />;

  const data = await fetchBoxDashboard(client, membership.tenant_id);

  return <DashboardScreen data={data} slug={slug} firstName={me.user.first_name} />;
}
