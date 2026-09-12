import { redirect } from 'next/navigation';
import { serverClient } from '../../lib/supabase/server';
import { NewBoxForm } from './new-box-form';

/**
 * Créer sa box (P1-020).
 *
 * Hors de `/box/**`, donc **hors du garde du middleware** : on vérifie la session
 * ici, et on renvoie vers `/login` (avec `next`) si personne n'est connecté —
 * sinon `create_tenant` échouerait sur `auth.uid()` nul, sans rien dire.
 *
 * Le point d'entrée depuis l'accueil vient avec `P1-022` (l'accueil qui mène
 * quelque part) ; d'ici là, la page est atteignable par son URL.
 */
export default async function NewBoxPage() {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (user === null) redirect('/login?next=/creer-une-box');

  return <NewBoxForm />;
}
