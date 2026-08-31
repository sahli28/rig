-- Isolation **par rôle à l'intérieur d'un tenant**.
--
-- Toute la suite existante teste la box A contre la box B. Elle ne peut donc pas
-- voir une élévation de privilège entre un MEMBER et un OWNER de la **même** box
-- — c'est exactement là que s'était logée la policy `tenants_member_update`, qui
-- laissait n'importe quel adhérent changer le fuseau horaire de sa box, donc la
-- fenêtre d'annulation de tout le monde.

begin;
select plan(11);

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

-- En revanche il gère le quotidien.
update public.tenant_settings set cancel_window_minutes = 120
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select cancel_window_minutes from public.tenant_settings
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  120,
  'un MANAGER règle bien la fenêtre d''annulation'
);

reset role;

select * from finish();
rollback;
