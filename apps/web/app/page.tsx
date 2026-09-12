import { redirect } from 'next/navigation';
import { fetchMe } from '@rack/core/supabase';
import { serverClient } from '../lib/supabase/server';
import { HomeScreen } from './home-screen';

/**
 * L'accueil **aiguille** (P1-022). C'est la page que désigne la Site URL de
 * Supabase, donc la porte d'arrivée après **chaque** connexion : elle ne doit
 * pas être un cul-de-sac. Résolue **côté serveur** pour rediriger avant tout
 * rendu — pas de placeholder « le back-office arrive en P1 ».
 *
 * - connecté à **une** box → droit dans `/box/[slug]` ;
 * - connecté à **plusieurs** → un choix (même besoin que `P1-009` côté mobile) ;
 * - connecté **sans** box → créer une box (`P1-020`) ou rejoindre par invitation ;
 * - **non** connecté → « Se connecter ».
 */
export default async function HomePage() {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (user === null) return <HomeScreen variant="public" boxes={[]} />;

  const me = await fetchMe(client);
  const boxes = me.memberships
    .filter((membership) => membership.status === 'ACTIVE')
    .map((membership) => ({ slug: membership.tenant_slug, name: membership.tenant_name }));

  const [only] = boxes;
  if (boxes.length === 1 && only) redirect(`/box/${only.slug}`);

  return <HomeScreen variant="signed-in" boxes={boxes} />;
}
