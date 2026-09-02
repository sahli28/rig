-- Réglages de la box : qui écrit quoi, et ce que la base refuse.
--
-- `rls_leak_test.sql` couvre le **structurel** — RLS activée et forcée, droits
-- qui reflètent les policies — et il le fait tout seul, en itérant sur
-- `information_schema`. Ce fichier couvre le **comportemental** : la paire que
-- D-001 et D-006 ont installée, où le second a rattrapé un faux vert du premier.
--
-- Ce qu'il prouve tient en une phrase : la frontière du back-office se coupe
-- **par table**. L'identité de la box (`tenants`) reste au propriétaire ;
-- l'opérationnel (`tenant_settings`, `opening_hours`, `class_types`) s'ouvre au
-- gestionnaire.

begin;
select plan(33);

-- ---------------------------------------------------------------------------
-- Léa — simple MEMBER de Rueil
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  (select count(*) from public.class_types where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  3::bigint,
  'un MEMBER lit le catalogue de sa box — c''est lui qui peint le planning'
);

select is(
  (select count(*) from public.class_types where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  0::bigint,
  '…et rien du catalogue d''une box où il n''est pas'
);

select is(
  (select count(*) from public.opening_hours where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  7::bigint,
  'un MEMBER lit les horaires de sa box, coupure du midi comprise'
);

select throws_ok(
  $$insert into public.class_types (tenant_id, name_i18n, duration_minutes, default_capacity)
    values ('aaaaaaaa-0000-4000-8000-000000000001', '{"fr":"Forgé"}', 60, 10)$$,
  '42501',
  null,
  'un MEMBER n''ajoute pas un type de cours'
);

select throws_ok(
  $$insert into public.opening_hours (tenant_id, weekday, opens_at, closes_at)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 6, '08:00', '12:00')$$,
  '42501',
  null,
  'un MEMBER n''ouvre pas sa box le dimanche'
);

-- La policy `update` masque la ligne : la commande n'affecte rien et ne lève
-- pas. C'est la valeur inchangée qui prouve la garde.
update public.class_types set default_capacity = 999
where id = 'a4000000-0000-4000-8000-000000000001';

select is(
  (select default_capacity from public.class_types where id = 'a4000000-0000-4000-8000-000000000001'),
  16,
  'un MEMBER n''élargit pas la capacité d''un cours'
);

-- ---------------------------------------------------------------------------
-- Hugo — MANAGER de Rueil, simple MEMBER de Nanterre
--
-- C'est la fixture qui distingue « autorisé quelque part » de « autorisé ici ».
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"77777777-0000-4000-8000-000000000001","role":"authenticated","email":"hugo@rueil.example"}';

select lives_ok(
  $$insert into public.class_types (tenant_id, name_i18n, duration_minutes, default_capacity)
    values ('aaaaaaaa-0000-4000-8000-000000000001', '{"fr":"Gymnastique","en":"Gymnastics"}', 45, 12)$$,
  'un MANAGER ajoute un type de cours dans sa box'
);

update public.class_types set duration_minutes = 75
where id = 'a4000000-0000-4000-8000-000000000001';

select is(
  (select duration_minutes from public.class_types where id = 'a4000000-0000-4000-8000-000000000001'),
  75,
  '…et le modifie'
);

select lives_ok(
  $$insert into public.opening_hours (tenant_id, weekday, opens_at, closes_at)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 6, '09:00', '12:00')$$,
  '…et ouvre le dimanche'
);

select throws_ok(
  $$insert into public.class_types (tenant_id, name_i18n, duration_minutes, default_capacity)
    values ('bbbbbbbb-0000-4000-8000-000000000001', '{"fr":"Intrus"}', 60, 10)$$,
  '42501',
  null,
  'un MANAGER n''écrit pas dans une box où il n''est que membre'
);

select throws_ok(
  $$insert into public.opening_hours (tenant_id, weekday, opens_at, closes_at)
    values ('bbbbbbbb-0000-4000-8000-000000000001', 6, '09:00', '12:00')$$,
  '42501',
  null,
  '…pas davantage ses horaires'
);

update public.tenant_settings set cancel_window_minutes = 120
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select cancel_window_minutes from public.tenant_settings
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  120,
  'un MANAGER règle la fenêtre d''annulation — c''est de l''opérationnel'
);

-- La frontière, dans l'autre sens : l'identité de la box lui échappe.
update public.tenants set name = 'CrossFit Détourné'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select name from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'CrossFit Rueil',
  'un MANAGER ne renomme pas la box : `tenants` est au propriétaire'
);

update public.tenants set default_locale = 'en'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select default_locale from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'fr',
  '…ni la langue par défaut, qui vit sur la même table'
);

-- ---------------------------------------------------------------------------
-- Marc — OWNER de Rueil
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

update public.tenants
set name = 'CrossFit Rueil-Malmaison', timezone = 'Europe/Lisbon', default_locale = 'en'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select name from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'CrossFit Rueil-Malmaison',
  'un OWNER renomme sa box'
);

select is(
  (select timezone from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Europe/Lisbon',
  '…change son fuseau'
);

select is(
  (select default_locale from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'en',
  '…et sa langue par défaut'
);

-- La devise, elle, est figée : le seed porte une écriture comptable pour Rueil.
select throws_ok(
  $$update public.tenants set currency = 'GBP'
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'la devise ne change plus dès qu''une écriture comptable existe'
);

-- Tant que rien n'a été encaissé, elle se corrige. Une box neuve le prouve —
-- aucune ligne du seed n'a de ledger vide.
select lives_ok(
  $$select public.create_tenant('Box neuve', 'box-neuve')$$,
  'une box neuve se crée'
);

update public.tenants set currency = 'CHF' where slug = 'box-neuve';

select is(
  (select currency from public.tenants where slug = 'box-neuve'),
  'CHF'::char(3),
  '…et sa devise se corrige tant qu''elle n''a rien vendu'
);

-- ---------------------------------------------------------------------------
-- Ce que la base refuse, quel que soit le rôle
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.class_types (tenant_id, name_i18n, duration_minutes, default_capacity)
    values ('aaaaaaaa-0000-4000-8000-000000000001', '{"en":"Only english"}', 60, 10)$$,
  '23514',
  null,
  'un nom sans français est refusé — c''est la langue dont la présence est garantie'
);

select throws_ok(
  $$insert into public.class_types (tenant_id, name_i18n, duration_minutes, default_capacity)
    values ('aaaaaaaa-0000-4000-8000-000000000001', '{"fr":"Bon","de":"Gut"}', 60, 10)$$,
  '23514',
  null,
  'une langue non supportée est refusée par la base, pas seulement par Zod'
);

select throws_ok(
  $$insert into public.class_types (tenant_id, name_i18n, duration_minutes, default_capacity)
    values ('aaaaaaaa-0000-4000-8000-000000000001', '{"fr":"Éclair"}', 0, 10)$$,
  '23514',
  null,
  'une durée nulle est une faute de frappe, pas un cours'
);

select throws_ok(
  $$insert into public.class_types (tenant_id, name_i18n, duration_minutes, color, default_capacity)
    values ('aaaaaaaa-0000-4000-8000-000000000001', '{"fr":"Rouge"}', 60, 'rouge', 10)$$,
  '23514',
  null,
  'une couleur qui n''est pas un hexadécimal est refusée'
);

select throws_ok(
  $$insert into public.class_types (tenant_id, name_i18n, duration_minutes, default_capacity)
    values ('aaaaaaaa-0000-4000-8000-000000000001', '{"fr":"Vide"}', 60, 0)$$,
  '23514',
  null,
  'une capacité nulle non plus'
);

select throws_ok(
  $$insert into public.class_types (tenant_id, name_i18n, duration_minutes, default_capacity)
    values ('aaaaaaaa-0000-4000-8000-000000000001', '{"fr":"wod"}', 60, 10)$$,
  '23505',
  null,
  'deux fois le même nom dans une box est une erreur de saisie — la casse ne sauve pas'
);

select throws_ok(
  $$insert into public.opening_hours (tenant_id, weekday, opens_at, closes_at)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 7, '08:00', '12:00')$$,
  '23514',
  null,
  'la semaine a sept jours, numérotés 0 à 6'
);

select throws_ok(
  $$insert into public.opening_hours (tenant_id, weekday, opens_at, closes_at)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 2, '20:00', '08:00')$$,
  '23514',
  null,
  'un créneau qui se ferme avant d''ouvrir est refusé — celui qui passe minuit se saisit en deux lignes'
);

-- Le même nom dans une **autre** box reste légitime : l'unicité est par box.
set local request.jwt.claims = '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"claire@nanterre.example"}';

select lives_ok(
  $$insert into public.class_types (tenant_id, name_i18n, duration_minutes, default_capacity)
    values ('bbbbbbbb-0000-4000-8000-000000000001', '{"fr":"Haltérophilie"}', 90, 8)$$,
  'le même nom dans une autre box est légitime : l''unicité est par box'
);

-- ---------------------------------------------------------------------------
-- Droits de table — la couche sous les policies
-- ---------------------------------------------------------------------------

reset role;

select ok(
  not has_table_privilege('authenticated', 'public.class_types', 'DELETE'),
  'aucun droit de DELETE sur class_types : les entités métier se retirent par deleted_at'
);

select ok(
  not has_table_privilege('authenticated', 'public.opening_hours', 'DELETE'),
  'idem pour opening_hours'
);

select ok(
  not has_table_privilege('authenticated', 'public.class_types', 'TRUNCATE'),
  'aucun droit de TRUNCATE sur class_types — la RLS ne l''intercepterait pas'
);

select ok(
  not has_table_privilege('authenticated', 'public.opening_hours', 'TRUNCATE'),
  'idem pour opening_hours'
);

select * from finish();
rollback;
