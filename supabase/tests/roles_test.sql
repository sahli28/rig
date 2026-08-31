-- Le rôle applicatif ne doit jamais pouvoir contourner la RLS.

begin;
select plan(5);

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

-- Dépendance implicite du modèle, jusqu'ici assertée nulle part : les fonctions
-- `security definer` ne brisent la récursion et ne voient `memberships` que
-- parce que **leur propriétaire** contourne la RLS. Si ce n'était plus le cas,
-- `current_tenant_ids()` retournerait un ensemble vide et toutes les policies
-- refuseraient tout.
--
-- L'échec serait fermé, donc sans risque de fuite — mais le produit cesserait de
-- fonctionner sans que rien n'explique pourquoi. Autant que ce soit un test qui
-- le dise.
select is(
  (select r.rolbypassrls
   from pg_proc p
   join pg_roles r on r.oid = p.proowner
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'current_tenant_ids'),
  true,
  'le propriétaire des fonctions security definer contourne bien la RLS'
);

select * from finish();
rollback;
