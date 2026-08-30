-- Le rôle applicatif ne doit jamais pouvoir contourner la RLS.

begin;
select plan(4);

select is(
  (select rolbypassrls from pg_roles where rolname = 'authenticated'),
  false,
  'authenticated n''a pas bypassrls'
);

select is(
  (select rolsuper from pg_roles where rolname = 'authenticated'),
  false,
  'authenticated n''est pas superuser'
);

select is(
  (select rolbypassrls from pg_roles where rolname = 'anon'),
  false,
  'anon n''a pas bypassrls'
);

-- Constat délibérément inscrit dans les tests plutôt que dans un commentaire :
-- `service_role` contourne l'intégralité des policies. Ce n'est pas un défaut à
-- corriger, c'est une propriété de Supabase — mais toute requête émise avec la
-- clé de service échappe à l'isolation. L'API applicative agit sous le JWT de
-- l'utilisateur. Si cette assertion casse un jour, c'est que Supabase a changé
-- son modèle, et le code qui s'appuie dessus doit être relu.
select is(
  (select rolbypassrls from pg_roles where rolname = 'service_role'),
  true,
  'service_role contourne la RLS — propriété connue, à ne jamais utiliser côté client'
);

select * from finish();
rollback;
