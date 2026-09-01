import { LoginForm } from './login-form';

/**
 * Page serveur : elle ne fait que lire les paramètres d'URL et les passer au
 * formulaire. Next 15 les fournit en promesse, et les lire ici évite un
 * `useSearchParams()` côté client, qui imposerait une frontière `<Suspense>`
 * au prérendu.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erreur?: string }>;
}) {
  const { next, erreur } = await searchParams;

  return <LoginForm next={next ?? '/'} erreur={erreur ?? null} />;
}
