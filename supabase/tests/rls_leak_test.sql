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
-- `relkind in ('v', 'm')` : les vues **et** les vues matérialisées. Un cache de
-- leaderboard en `matview` est très plausible en P1 ou P3, et c'est le pire cas
-- de tous — voir le test 7.
create temporary table business_views as
select c.relname::text as view_name,
       c.relkind,
       pg_get_viewdef(c.oid) as definition
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('v', 'm')
  and c.relname not like 'pg_%';

-- Les contrôles 8 et 9 interrogent cette table sous les rôles `authenticated` et
-- `anon`, qui n'ont aucun droit sur un objet temporaire créé par `postgres`.
grant select on business_views to authenticated, anon;

-- Vues rendant des lignes hors des boxes de l'appelant. Le prédicat est le même
-- pour toutes, donc le contrôle vaut pour les vues futures sans rien à écrire.
-- Une erreur de privilège compte comme une absence de fuite : c'est le résultat
-- recherché, pas un échec.
create or replace function pg_temp.views_leaking_foreign()
returns text
language plpgsql
as $$
declare
  v record;
  n integer;
  leaks text[] := array[]::text[];
begin
  for v in select view_name from business_views loop
    begin
      execute format(
        'select count(*) from public.%I where tenant_id is not null
           and tenant_id not in (select public.current_tenant_ids())', v.view_name
      ) into n;
      if n > 0 then leaks := array_append(leaks, v.view_name); end if;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
  return array_to_string(leaks, ', ');
end;
$$;

-- Idem pour `anon`, qui n'a aucune box : toute ligne visible est une ligne de trop.
-- On compte tout plutôt que de passer par `current_tenant_ids()`, dont l'exécution
-- lui est révoquée — sans quoi le test se contenterait de constater ce refus-là.
create or replace function pg_temp.views_visible_to_anon()
returns text
language plpgsql
as $$
declare
  v record;
  n integer;
  leaks text[] := array[]::text[];
begin
  for v in select view_name from business_views loop
    begin
      execute format('select count(*) from public.%I', v.view_name) into n;
      if n > 0 then leaks := array_append(leaks, v.view_name); end if;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
  return array_to_string(leaks, ', ');
end;
$$;

-- Droits de table et policies : deux couches qui doivent dire la même chose.
--
-- Ce contrôle est né de D-006, où `anon` et `authenticated` détenaient `arwdDxtm`
-- sur les treize tables — dont `truncate`, **que la RLS n'intercepte pas** et que
-- le trigger append-only ne voit pas non plus. Un simple MEMBER pouvait vider la
-- comptabilité et le journal d'audit des deux boxes.
--
-- L'invariant est symétrique, et c'est ce qui le rend auto-entretenu :
--   - un droit **sans** policy est un trou en attente. `truncate`, `references`,
--     `trigger` et `maintain` n'ont jamais de policy : ils ne peuvent donc
--     jamais être accordés ;
--   - une policy **sans** droit est du code mort, qui échouera en
--     « permission denied » le jour où un écran l'appellera.
create or replace function pg_temp.grant_policy_mismatches()
returns text
language plpgsql
as $$
declare
  t record;
  p text;
  granted boolean;
  policied boolean;
  bad text[] := array[]::text[];
begin
  for t in select table_name from business_tables loop
    foreach p in array array['SELECT','INSERT','UPDATE','DELETE',
                             'TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
      granted := has_table_privilege('authenticated', format('public.%I', t.table_name), p);

      -- Les droits de **colonne** ne remontent pas dans `has_table_privilege` :
      -- `users` n'accorde `update` que sur six colonnes nommées, et serait
      -- signalée à tort sans ce repli.
      if not granted and p in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES') then
        granted := exists (
          select 1 from information_schema.column_privileges
          where table_schema = 'public' and table_name = t.table_name
            and grantee = 'authenticated' and privilege_type = p
        );
      end if;

      if p in ('SELECT', 'INSERT', 'UPDATE', 'DELETE') then
        policied := exists (
          select 1 from pg_policies
          where schemaname = 'public' and tablename = t.table_name
            and cmd in (p, 'ALL')
        );
      else
        -- `truncate`, `references`, `trigger` et `maintain` ne sont gouvernés
        -- par **aucune** policy, jamais — et une policy `for all` ne les couvre
        -- pas davantage : son « all » désigne les quatre opérations sur les
        -- lignes, pas tous les privilèges. C'est précisément ce qui rend
        -- `truncate` dangereux, et la raison d'être de ce contrôle.
        policied := false;
      end if;

      if granted <> policied then
        bad := array_append(bad, format('%s.%s (droit=%s, policy=%s)',
                                        t.table_name, p, granted, policied));
      end if;
    end loop;
  end loop;
  return array_to_string(bad, ' | ');
end;
$$;

select plan(12);

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

-- 7. Aucune vue matérialisée.
--
-- Une `matview` est un instantané : **la RLS ne s'y applique pas du tout**, et le
-- contrôle 5 y serait trompeur — une définition contenant `current_tenant_ids()`
-- signifierait qu'on a matérialisé la vue *d'une seule personne* et qu'on la sert
-- à tout le monde. Le jour où un cache de leaderboard en réclame une, ce test
-- oblige à en décider explicitement plutôt qu'à la poser en passant.
select is(
  (select coalesce(string_agg(v.view_name, ', ' order by v.view_name), '')
   from business_views v where v.relkind = 'm'),
  '',
  'aucune vue matérialisée : la RLS ne s''y applique pas, c''est une décision à prendre'
);

-- ---------------------------------------------------------------------------
-- 8 et 9 — le comportement, pas seulement la forme
-- ---------------------------------------------------------------------------
--
-- Les contrôles 5 et 6 cherchent une chaîne dans `pg_get_viewdef()`. C'est un
-- grep : la chaîne peut figurer dans un sous-select qui ne contraint pas la
-- requête externe, et le test passerait au vert. Les deux contrôles suivants
-- interrogent réellement chaque vue, sous deux sessions qui ne doivent rien
-- voir — même paire structurel/comportemental que pour les tables, et même
-- couverture automatique des vues futures.

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-0000-4000-8000-000000000001","role":"authenticated","email":"thomas@example.com"}';

select is(
  pg_temp.views_leaking_foreign(),
  '',
  'aucune vue ne rend à un membre une ligne appartenant à une box qui n''est pas la sienne'
);

set local role anon;

select is(
  pg_temp.views_visible_to_anon(),
  '',
  'aucune vue ne rend quoi que ce soit à une session non authentifiée'
);

reset role;

-- ---------------------------------------------------------------------------
-- 10 à 12 — la couche des droits, muette jusqu'à D-006
-- ---------------------------------------------------------------------------

select is(
  pg_temp.grant_policy_mismatches(),
  '',
  'sur chaque table, les droits accordés à authenticated correspondent exactement à ses policies'
);

-- `anon` n'a aucun besoin d'accès direct : le profil public d'une box passe par
-- `tenant_public_profile()`, qui est `security definer`. Tout droit qu'il
-- détiendrait serait donc, par construction, un droit dont personne ne se sert.
select is(
  (select coalesce(string_agg(distinct b.table_name, ', ' order by b.table_name), '')
   from business_tables b
   join information_schema.table_privileges p
     on p.table_schema = 'public' and p.table_name = b.table_name and p.grantee = 'anon'),
  '',
  'anon ne détient aucun droit sur une table métier'
);

-- Sans ce dernier contrôle, les deux précédents seraient vrais aujourd'hui et
-- faux à la prochaine table : les privilèges par défaut du schéma accordaient
-- `arwdDxtm` à `anon` et `authenticated` sur tout ce qui s'y crée. C'est la
-- source du problème, pas seulement son symptôme.
select is(
  (select coalesce(string_agg(pg_get_userbyid(d.defaclrole)::text, ', '), '')
   from pg_default_acl d
   join pg_namespace n on n.oid = d.defaclnamespace
   where n.nspname = 'public'
     and d.defaclobjtype = 'r'
     and pg_get_userbyid(d.defaclrole) = 'postgres'
     and (array_to_string(d.defaclacl, ',') like '%anon=%'
       or array_to_string(d.defaclacl, ',') like '%authenticated=%')),
  '',
  'aucun privilège par défaut n''accordera de droits à anon ou authenticated sur une table future'
);

select * from finish();
rollback;
