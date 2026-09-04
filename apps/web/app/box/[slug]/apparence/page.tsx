import {
  UNCONFIGURED_BOX_PRIMARY,
  fetchMe,
  findMembershipBySlug,
  tenantScope,
} from '@rack/core/supabase';
import { serverClient } from '../../../../lib/supabase/server';
import { Notice } from '../notice';
import { AppearanceForm } from './appearance-form';

/**
 * Apparence de la box — le seul écran qui écrit `themes`.
 *
 * Jusqu'ici, `create_tenant()` posait une couleur et plus personne n'y touchait :
 * le produit dont l'argument numéro un est « votre app, à vos couleurs » ne
 * savait pas les changer.
 *
 * **Propriétaire uniquement** (spec §5.2 : le gestionnaire est exclu du
 * white-label). La policy `themes_update` le dit déjà ; ceci évite qu'un
 * gestionnaire tombe sur un formulaire qui refuse en silence.
 */
export default async function AppearancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const client = await serverClient();
  const me = await fetchMe(client);
  const membership = findMembershipBySlug(me, slug);

  if (membership === null) return <Notice kind="unknown_box" />;
  if (membership.role !== 'OWNER') return <Notice kind="owner_only" />;

  const scope = tenantScope(client, membership.tenant_id);
  const [theme, tenant] = await Promise.all([
    scope.select('themes').maybeSingle(),
    scope.currentTenant(),
  ]);

  // Une box sans ligne de branding reste utilisable — c'est la leçon de la
  // jointure interne corrigée en P1-001c. Le formulaire part alors du nom de la
  // box et des valeurs par défaut de la table.
  const depart = theme.data ?? {
    app_name: tenant.data?.name ?? '',
    primary_color: UNCONFIGURED_BOX_PRIMARY,
    radius: 16,
    font: 'Inter',
  };

  return <AppearanceForm slug={slug} appearance={depart} />;
}
