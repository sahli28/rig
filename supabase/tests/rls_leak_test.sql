-- Test anti-fuite **structurel**.
--
-- Il ne teste pas des lignes mais la forme du schéma : toute table métier de
-- `public` doit porter `tenant_id`, avoir la RLS activée ET forcée, et au moins
-- une policy. Il parcourt le catalogue, donc **toute table ajoutée plus tard est
-- couverte automatiquement** — c'est tout l'intérêt par rapport à une liste
-- écrite à la main, qu'on oublierait de tenir à jour.
--
-- Les exceptions sont explicites et justifiées. Y ajouter une table doit être un
-- geste conscient, visible en revue de code.

begin;

-- Tables sans `tenant_id`, et pourquoi.
create temporary table tenant_id_exempt (table_name text primary key, reason text);
insert into tenant_id_exempt values
  ('tenants',                  'elle EST le tenant : le filtre porte sur id'),
  ('users',                    'la personne est globale, une identité pour N boxes'),
  ('devices',                  'un appareil appartient à la personne, pas à la box'),
  ('processed_webhook_events', 'déduplication Stripe globale, table d''infrastructure');

-- Tables sans policy, et pourquoi.
create temporary table policy_exempt (table_name text primary key, reason text);
insert into policy_exempt values
  ('processed_webhook_events', 'RLS forcée sans policy = invisible à authenticated, voulu');

create temporary table business_tables as
select c.relname::text as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname not like 'pg_%';

-- Les vues (`relkind = 'v'`), que les quatre contrôles ci-dessous ne voient pas.
--
-- Ce n'est pas un détail de complétude. Une vue **ne peut pas** porter de policy
-- RLS : sa protection est son propre `WHERE`, et rien dans le catalogue ne dit
-- si ce `WHERE` existe. Comme le parcours ci-dessus est restreint à `relkind =
-- 'r'`, une vue posée sans filtre de tenant ne ferait pas rougir ce test et
-- n'atterrirait dans aucune liste d'exceptions — elle serait simplement
-- invisible. C'est pire qu'une exception : une exception se relit.
create temporary table business_views as
select c.relname::text as view_name, pg_get_viewdef(c.oid) as definition
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and c.relname not like 'pg_%';

select plan(6);

-- 1. tenant_id
select is(
  (select coalesce(string_agg(b.table_name, ', ' order by b.table_name), '')
   from business_tables b
   where b.table_name not in (select table_name from tenant_id_exempt)
     and not exists (
       select 1 from information_schema.columns col
       where col.table_schema = 'public'
         and col.table_name = b.table_name
         and col.column_name = 'tenant_id'
     )),
  '',
  'toute table métier porte tenant_id (hors exceptions justifiées)'
);

-- 2. RLS activée
select is(
  (select coalesce(string_agg(c.relname::text, ', ' order by c.relname), '')
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   join business_tables b on b.table_name = c.relname
   where n.nspname = 'public' and c.relrowsecurity = false),
  '',
  'la RLS est activée sur toutes les tables'
);

-- 3. RLS forcée — sans `force`, le propriétaire de la table y échappe.
select is(
  (select coalesce(string_agg(c.relname::text, ', ' order by c.relname), '')
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   join business_tables b on b.table_name = c.relname
   where n.nspname = 'public' and c.relforcerowsecurity = false),
  '',
  'la RLS est forcée sur toutes les tables'
);

-- 4. Au moins une policy
select is(
  (select coalesce(string_agg(b.table_name, ', ' order by b.table_name), '')
   from business_tables b
   where b.table_name not in (select table_name from policy_exempt)
     and not exists (
       select 1 from pg_policies p
       where p.schemaname = 'public' and p.tablename = b.table_name
     )),
  '',
  'toute table a au moins une policy (hors exceptions justifiées)'
);

-- 5. Toute vue porte un prédicat de tenant.
--
-- Contrôle grossier — il cherche l'appel dans la définition, pas sa correction —
-- mais il attrape le cas qui compte : une vue posée sans **aucun** filtre de
-- tenant. Comme le parcours porte sur le catalogue, toute vue ajoutée plus tard
-- est couverte sans qu'on ait à tenir une liste.
select is(
  (select coalesce(string_agg(v.view_name, ', ' order by v.view_name), '')
   from business_views v
   where v.definition not like '%current_tenant_ids%'
     and v.definition not like '%current_admin_tenant_ids%'),
  '',
  'toute vue dérive son tenant d''auth.uid(), jamais d''un paramètre'
);

-- 6. Une vue qui expose une colonne sensible porte un prédicat de **rôle**.
--
-- Un filtre de tenant dit « c'est bien ta box ». Il ne dit pas « tu as le droit
-- d'y voir les adresses e-mail de tout le monde ». La minimisation vaut aussi à
-- l'intérieur d'une box (`.claude/rules/privacy.md`) : les colonnes qui
-- identifient une personne au-delà de son prénom exigent le rôle, pas seulement
-- l'appartenance.
select is(
  (select coalesce(string_agg(v.view_name, ', ' order by v.view_name), '')
   from business_views v
   join information_schema.columns col
     on col.table_schema = 'public' and col.table_name = v.view_name
   where col.column_name in ('email', 'birthdate', 'gender')
     and v.definition not like '%current_admin_tenant_ids%'),
  '',
  'une vue exposant e-mail, date de naissance ou sexe exige un rôle d''administration'
);

select * from finish();
rollback;
