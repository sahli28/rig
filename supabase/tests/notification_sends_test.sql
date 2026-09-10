-- P1-007 — Le journal d'envoi : append-only, tenant-scopé, non écrivable par un
-- membre.

begin;
select plan(11);

select has_table('public', 'notification_sends', 'le journal existe');
select has_column('public', 'notification_sends', 'membership_id',
  'compté par appartenance, pas par personne (Julie a deux compteurs)');
select has_column('public', 'notification_sends', 'category', 'la catégorie porte la dimension du plafond');

-- Décor : deux envois, un à Rueil (Léa), un à Nanterre (Thomas), posés par
-- l'émetteur — c'est-à-dire sous `postgres` (service_role bypass RLS).
insert into public.notification_sends (tenant_id, membership_id, category) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'WAITLIST_PROMOTION'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000002', 'CLASS_REMINDER');

-- ---------------------------------------------------------------------------
-- Append-only — UPDATE interdit, DELETE fermé par l'absence de grant
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.notification_sends set category = 'MARKETING' where category = 'WAITLIST_PROMOTION'$$,
  '23001', null,
  'UPDATE lève : le journal est append-only (forbid_mutation)'
);

-- Léa, MEMBER : elle voit sa ligne, mais ne peut ni la modifier ni la supprimer.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  (select count(*) from public.notification_sends)::int,
  1,
  'Léa voit **son** envoi, et seulement le sien'
);
select is(
  (select tenant_id from public.notification_sends limit 1),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'et c''est bien celui de Rueil'
);

select throws_ok(
  $$update public.notification_sends set channel = 'email' where true$$,
  '42501', null,
  'un membre ne réécrit pas le journal — aucun grant d''update'
);
select throws_ok(
  $$delete from public.notification_sends where true$$,
  '42501', null,
  'ni ne le supprime — aucun grant de delete'
);

-- Thomas, MEMBER de Nanterre : le cloisonnement joue dans les deux sens.
set local request.jwt.claims =
  '{"sub":"55555555-0000-4000-8000-000000000001","role":"authenticated","email":"thomas@example.com"}';
select is(
  (select tenant_id from public.notification_sends limit 1),
  'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
  'Thomas ne voit que Nanterre'
);

reset role;

-- ---------------------------------------------------------------------------
-- Le compteur de plafond ne voit que le marketing
-- ---------------------------------------------------------------------------

insert into public.notification_sends (tenant_id, membership_id, category) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'MARKETING');

select is(
  public.notification_marketing_count_7d('a3000000-0000-4000-8000-000000000002'),
  1,
  'le compteur voit le marketing, pas la promotion transactionnelle déjà posée'
);

select is(
  has_column_privilege('authenticated', 'public.notification_sends', 'category', 'INSERT'),
  false,
  'et personne côté client ne peut insérer une ligne de journal'
);

select * from finish();
rollback;
