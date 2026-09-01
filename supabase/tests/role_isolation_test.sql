-- Isolation **par rôle à l'intérieur d'un tenant**.
--
-- Toute la suite existante teste la box A contre la box B. Elle ne peut donc pas
-- voir une élévation de privilège entre un MEMBER et un OWNER de la **même** box
-- — c'est exactement là que s'était logée la policy `tenants_member_update`, qui
-- laissait n'importe quel adhérent changer le fuseau horaire de sa box, donc la
-- fenêtre d'annulation de tout le monde.

begin;
select plan(28);

-- ---------------------------------------------------------------------------
-- Session de Léa — simple MEMBER de la box A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

-- Les policies masquent la ligne : l'UPDATE n'affecte rien et ne lève pas.
-- C'est la valeur inchangée qui prouve la garde.

update public.tenants set timezone = 'Pacific/Auckland'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select timezone from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Europe/Paris',
  'un MEMBER ne change pas le fuseau de sa box — il gouverne la fenêtre d''annulation'
);

update public.tenants set slug = 'detourne'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select slug from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'crossfit-rueil',
  'un MEMBER ne change pas le slug — il porte le QR, les invitations et le profil public'
);

update public.tenants set status = 'CLOSED', deleted_at = now()
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select status::text from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'ACTIVE',
  'un MEMBER ne ferme pas sa box'
);

update public.tenant_settings set cancel_window_minutes = 1
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select cancel_window_minutes from public.tenant_settings
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  240,
  'un MEMBER n''élargit pas sa propre fenêtre d''annulation'
);

update public.themes set primary_color = '#000000'
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select primary_color from public.themes
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '#E4572E',
  'un MEMBER ne repeint pas la box'
);

update public.rooms set capacity = 999
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select capacity from public.rooms
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  16,
  'un MEMBER ne change pas la capacité des salles'
);

-- Mais il lit tout ça : ce sont les règles que son app affiche et applique.
select is(
  (select count(*) from public.tenant_settings)::int,
  1,
  'un MEMBER lit bien les réglages de sa box'
);

reset role;

-- ---------------------------------------------------------------------------
-- Session de Marc — OWNER de la box A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

update public.tenants set timezone = 'Europe/Brussels'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select timezone from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Europe/Brussels',
  'un OWNER change bien le fuseau de sa box'
);

update public.themes set primary_color = '#123456'
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select primary_color from public.themes
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '#123456',
  'un OWNER repeint bien sa box'
);

reset role;

-- ---------------------------------------------------------------------------
-- Session de Sarah, promue MANAGER — le branding lui reste fermé (spec §5.2)
-- ---------------------------------------------------------------------------

update public.memberships set role = 'MANAGER'
where id = 'a3000000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

update public.themes set primary_color = '#abcdef'
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select primary_color from public.themes
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '#123456',
  'un MANAGER ne touche pas au branding, réservé au propriétaire'
);

-- `tenants` est réservée au propriétaire. La RLS étant **row-level**, donner
-- l'écriture au gestionnaire lui donnerait aussi `status` et `deleted_at`,
-- c'est-à-dire la fermeture de la box — que la spec §5.2 lui interdit.
update public.tenants set status = 'CLOSED', deleted_at = now()
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select status::text from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'ACTIVE',
  'un MANAGER ne ferme pas la box'
);

update public.tenants set timezone = 'Pacific/Auckland'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select timezone from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Europe/Brussels',
  'un MANAGER ne touche pas non plus au fuseau : tenants est réservée au propriétaire'
);

-- En revanche il gère le quotidien, dans `tenant_settings`.
update public.tenant_settings set cancel_window_minutes = 120
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select cancel_window_minutes from public.tenant_settings
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  120,
  'un MANAGER règle bien la fenêtre d''annulation'
);

reset role;

reset role;

-- ---------------------------------------------------------------------------
-- Colonnes de gouvernance : la policy dit quelles lignes, le grant quelles colonnes
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

-- `deleted_at` est le drapeau du parcours RGPD de P0-005 : le poser ou l'effacer
-- soi-même déclencherait ou annulerait sa propre anonymisation. Ici l'écriture
-- est refusée au niveau **colonne**, donc elle lève, contrairement à un refus
-- par policy qui se contente de n'affecter aucune ligne.
select throws_ok(
  $$update public.users set deleted_at = now()
    where id = '33333333-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'un utilisateur ne pose pas lui-même son propre deleted_at'
);

select throws_ok(
  $$update public.users set created_at = '2000-01-01'
    where id = '33333333-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'un utilisateur ne réécrit pas created_at, qui porte les échéances de rétention'
);

-- En revanche il édite bien son profil.
select lives_ok(
  $$update public.users set first_name = 'Léa-Marie'
    where id = '33333333-0000-4000-8000-000000000001'$$,
  'un utilisateur édite bien son propre profil'
);

reset role;

-- ---------------------------------------------------------------------------
-- Un MANAGER ne révoque pas une invitation OWNER
-- ---------------------------------------------------------------------------

insert into public.invitations (tenant_id, email, role, token_hash, expires_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'futur.proprio@example.com', 'OWNER',
   encode(extensions.digest('inv-owner-a','sha256'),'hex'), now() + interval '7 days');

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

delete from public.invitations where token_hash = encode(extensions.digest('inv-owner-a','sha256'),'hex');

select is(
  (select count(*) from public.invitations where token_hash = encode(extensions.digest('inv-owner-a','sha256'),'hex'))::int,
  1,
  'un MANAGER ne supprime pas une invitation OWNER'
);

update public.invitations set role = 'MEMBER' where token_hash = encode(extensions.digest('inv-owner-a','sha256'),'hex');

select is(
  (select role::text from public.invitations where token_hash = encode(extensions.digest('inv-owner-a','sha256'),'hex')),
  'OWNER',
  'un MANAGER ne rétrograde pas une invitation OWNER'
);

-- ---------------------------------------------------------------------------
-- Journal d'audit et comptabilité — deux tables protégées au niveau du tenant
-- seulement, dans un système où le rôle compte
-- ---------------------------------------------------------------------------
--
-- Même motif que `tenants_member_update` plus haut, et troisième occurrence de
-- la même erreur : `tenant_id in (select current_tenant_ids())` sans garde de
-- rôle. Un simple MEMBER lisait donc tout le journal de sa box — `diff jsonb`
-- compris, soit les changements de rôle et les exclusions d'autres membres — et
-- toutes les écritures comptables, dont la somme est le chiffre d'affaires.
--
-- Aucun test ne pouvait le voir : la suite d'isolation compare la box A à la
-- box B, et ici la fuite est **à l'intérieur** d'une box.

reset role;

-- La section précédente a promu Sarah MANAGER pour éprouver le branding.
-- On la remet COACH : c'est en tant que coach qu'elle nous intéresse ici.
update public.memberships set role = 'COACH'
where user_id = '44444444-0000-4000-8000-000000000001';

set local role authenticated;

-- Léa — MEMBER
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  (select count(*) from public.audit_logs)::int,
  0,
  'un MEMBER ne lit pas le journal d''audit de sa box (spec §5.2)'
);

select is(
  (select count(*) from public.ledger_entries)::int,
  0,
  'un MEMBER ne lit pas la comptabilité de sa box — leur somme est le CA'
);

-- Sarah — COACH
set local request.jwt.claims = '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select is(
  (select count(*) from public.audit_logs)::int,
  0,
  'un COACH non plus'
);

select is(
  (select count(*) from public.ledger_entries)::int,
  0,
  'un COACH non plus pour la comptabilité'
);

-- Hugo — MANAGER. La spec §5.2 le traite différemment sur les deux tables, et
-- c'est précisément ce que ces deux assertions figent.
set local request.jwt.claims = '{"sub":"77777777-0000-4000-8000-000000000001","role":"authenticated","email":"hugo@rueil.example"}';

select is(
  (select count(*) from public.audit_logs)::int,
  0,
  'un MANAGER ne lit pas le journal d''audit : « Consulter le journal » est ❌ pour lui'
);

select is(
  (select count(*) from public.ledger_entries)::int,
  1,
  'mais il lit la comptabilité : « Voir le CA » est 👁 pour lui'
);

-- Marc — OWNER
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select is(
  (select count(*) from public.audit_logs)::int,
  1,
  'un OWNER lit le journal d''audit de sa box'
);

select is(
  (select count(*) from public.ledger_entries)::int,
  1,
  'et sa comptabilité'
);

-- ---------------------------------------------------------------------------
-- TRUNCATE — l'ordre que la RLS ne voit pas
-- ---------------------------------------------------------------------------
--
-- `TRUNCATE` n'est pas une opération ligne à ligne : il n'y a pas de ligne à
-- filtrer, donc **aucune policy ne s'applique**. Et `forbid_mutation`, qui rend
-- `ledger_entries` et `audit_logs` append-only, est un `before update or delete`
-- qui ne se déclenche pas davantage. Les deux protections sur lesquelles
-- reposent la comptabilité et le journal d'audit sont contournées d'un seul
-- ordre — pour peu que le rôle en ait le droit.
--
-- Il l'avait. Avant D-006, cette fonction rendait les treize tables.
-- La contrepartie exacte de la sonde qui a servi à établir le problème.

reset role;

create or replace function pg_temp.tables_tronquables()
returns text
language plpgsql
as $$
declare
  t record;
  passees text[] := array[]::text[];
begin
  for t in select c.relname from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
           order by c.relname loop
    begin
      execute format('truncate public.%I cascade', t.relname);
      passees := array_append(passees, t.relname);
    exception when others then
      null;
    end;
  end loop;
  return array_to_string(passees, ', ');
end;
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  pg_temp.tables_tronquables(),
  '',
  'un MEMBER ne peut tronquer aucune table — la RLS ne l''aurait pas arrêté'
);

set local role anon;

select is(
  pg_temp.tables_tronquables(),
  '',
  'une session non authentifiée non plus'
);

reset role;

select * from finish();
rollback;
