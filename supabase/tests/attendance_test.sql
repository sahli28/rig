-- P1-008a — Pointage manuel de présence + no-show.
--
-- Écrit **avant** la migration. Doit d'abord échouer parce que les fonctions et
-- colonnes n'existent pas, pas parce qu'une assertion est fausse.
--
-- Ce que ce fichier prouve, et que rien d'autre ne peut voir : que le pointage
-- passe par le staff **et** par la fenêtre ; qu'un membre et un staff d'une
-- autre box sont refusés ; que la présence n'est pas écrivable à la main ; et
-- que le job ne marque en no-show que ce qui le mérite. Les motifs (identités
-- par claims JWT, `pg_temp.code_of` pour discriminer un `23514`) viennent de
-- `booking_test.sql` / `cancellation_test.sql`.

begin;
select plan(27);

-- ---------------------------------------------------------------------------
-- 1. La forme
-- ---------------------------------------------------------------------------

select has_column('public', 'bookings', 'attended_at', 'la présence est stockée sur bookings');
select has_column('public', 'bookings', 'no_show_at', 'le no-show est un fait daté, pas un dérivé');

select is(
  has_column_privilege('authenticated', 'public.bookings', 'attended_at', 'UPDATE'),
  false,
  'la présence ne s''écrit pas à la main — seulement par set_attendance()'
);
select is(
  has_column_privilege('authenticated', 'public.bookings', 'no_show_at', 'UPDATE'),
  false,
  'le no-show ne s''écrit pas à la main — seulement par le job'
);

select has_column('public', 'tenant_settings', 'checkin_window_before_minutes', 'la fenêtre de pointage : avant');
select has_column('public', 'tenant_settings', 'checkin_window_after_minutes', 'la fenêtre de pointage : après');

select has_view('public', 'class_attendance_sheet', 'la feuille du coach existe — class_roster est « pair », inutilisable ici');

select has_function(
  'public', 'set_attendance', array['uuid', 'boolean'],
  'set_attendance(réservation, présent) — pointer et dépointer'
);
select has_function(
  'public', 'mark_no_shows', array[]::text[],
  'mark_no_shows() — le job de fond'
);

-- ---------------------------------------------------------------------------
-- 2. Le décor — deux cours de Rueil, un de Nanterre
-- ---------------------------------------------------------------------------
-- Séries jetables (une par box) puis des occurrences aux instants qu'on choisit.
-- Sarah (a3…003) est COACH de Rueil ; Léa (a3…002) MEMBER de Rueil ; Claire
-- (b3…001) OWNER de Nanterre.

insert into public.class_schedules (
  id, tenant_id, class_type_id, room_id, coach_membership_id,
  starts_on, starts_at_local, rrule, capacity
) values
  ('f1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003', current_date, '18:30', 'FREQ=WEEKLY;BYDAY=MO', 20),
  ('f2000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'b4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
   'b3000000-0000-4000-8000-000000000001', current_date, '18:30', 'FREQ=WEEKLY;BYDAY=MO', 20);

-- Rueil, **dans la fenêtre** : commence maintenant (30 avant / 15 après englobe now()).
insert into public.classes (
  id, tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
  starts_at, ends_at, capacity, booked_count
) values
  ('f1c00000-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003',
   now(), now() + interval '1 hour', 20, 1),
  -- Rueil, **hors fenêtre** : dans deux jours.
  ('f1c00000-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003',
   now() + interval '2 days', now() + interval '2 days' + interval '1 hour', 20, 1),
  -- Rueil, **terminé** : pour le job de no-show.
  ('f1c00000-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003',
   now() - interval '2 hours', now() - interval '1 hour', 20, 3),
  -- Nanterre, dans la fenêtre : pour le cloisonnement inter-box.
  ('f2c00000-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-000000000001',
   'f2000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001',
   'b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001',
   now(), now() + interval '1 hour', 20, 1);

-- Les réservations, insérées en postgres (bookings n'a pas de policy d'écriture ;
-- book_class() refuserait ces instants). Léa dans les trois cours de Rueil,
-- un membre de Nanterre dans le sien.
insert into public.bookings (id, tenant_id, class_id, membership_id, status, idempotency_key) values
  ('b0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1c00000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000002', 'CONFIRMED', 'att-in'),
  ('b0000000-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1c00000-0000-4000-8000-00000000000b', 'a3000000-0000-4000-8000-000000000002', 'CONFIRMED', 'att-out'),
  -- Cours terminé : une confirmée non pointée (→ no-show), une déjà pointée
  -- (→ épargnée), une annulée (→ jamais un no-show). Trois membres de Rueil.
  ('b0000000-0000-4000-8000-00000000000c', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1c00000-0000-4000-8000-00000000000c', 'a3000000-0000-4000-8000-000000000002', 'CONFIRMED', 'ns-absent'),
  ('b0000000-0000-4000-8000-00000000000d', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1c00000-0000-4000-8000-00000000000c', 'a3000000-0000-4000-8000-000000000004', 'CONFIRMED', 'ns-present'),
  ('b0000000-0000-4000-8000-00000000000e', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1c00000-0000-4000-8000-00000000000c', 'a3000000-0000-4000-8000-000000000001', 'CANCELLED', 'ns-cancelled'),
  ('b0000000-0000-4000-8000-00000000000f', 'bbbbbbbb-0000-4000-8000-000000000001',
   'f2c00000-0000-4000-8000-00000000000a', 'b3000000-0000-4000-8000-000000000002', 'CONFIRMED', 'att-nanterre');

-- La présente d'avance (le membre du cours terminé qui est venu).
update public.bookings set attended_at = now() - interval '90 minutes'
where id = 'b0000000-0000-4000-8000-00000000000d';

-- Discriminer un `23514` (le SQLSTATE ne suffit pas — cf. cancellation_test).
create function pg_temp.code_of(p_sql text) returns text language plpgsql as $$
declare v_detail text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return (v_detail::jsonb) ->> 'code';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Le coach pointe — et dépointe
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select lives_ok(
  $$select public.set_attendance('b0000000-0000-4000-8000-00000000000a', true)$$,
  'un COACH pointe une présence dans la fenêtre'
);

select isnt(
  (select attended_at from public.class_attendance_sheet
   where booking_id = 'b0000000-0000-4000-8000-00000000000a'),
  null,
  'et la feuille la montre présente'
);

select lives_ok(
  $$select public.set_attendance('b0000000-0000-4000-8000-00000000000a', false)$$,
  'dépointer retire la présence — geste réversible'
);

select is(
  (select attended_at from public.class_attendance_sheet
   where booking_id = 'b0000000-0000-4000-8000-00000000000a'),
  null,
  'et la feuille la remontre non pointée'
);

-- ---------------------------------------------------------------------------
-- 4. Les refus
-- ---------------------------------------------------------------------------

select is(
  pg_temp.code_of(
    $$select public.set_attendance('b0000000-0000-4000-8000-00000000000b', true)$$),
  'ATTENDANCE_WINDOW_CLOSED',
  'hors fenêtre, la base refuse — pas seulement l''écran'
);

select throws_ok(
  $$select public.set_attendance('b0000000-0000-4000-8000-00000000000f', true)$$,
  '42501', null,
  'un coach de Rueil ne pointe rien à Nanterre — même réponse qu''une réservation inconnue'
);

-- Léa, MEMBER de Rueil : membre n'est pas staff.
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select throws_ok(
  $$select public.set_attendance('b0000000-0000-4000-8000-00000000000a', true)$$,
  '42501', null,
  'un MEMBER ne pointe personne, même dans sa propre box'
);

-- ---------------------------------------------------------------------------
-- 5. La feuille est cloisonnée
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from public.class_attendance_sheet)::int,
  0,
  'un MEMBER ne lit aucune feuille — la vue est réservée au staff'
);

set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select is(
  (select count(distinct tenant_id) from public.class_attendance_sheet)::int,
  1,
  'le coach de Rueil ne voit que les feuilles de Rueil'
);

select is(
  (select tenant_id from public.class_attendance_sheet limit 1),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'et c''est bien Rueil, jamais Nanterre'
);

-- Claire, OWNER de Nanterre : le cloisonnement joue dans les deux sens.
set local request.jwt.claims =
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"claire@nanterre.example"}';

select is(
  (select tenant_id from public.class_attendance_sheet limit 1),
  'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
  'l''OWNER de Nanterre ne voit que Nanterre'
);

-- ---------------------------------------------------------------------------
-- 6. Le job de no-show
-- ---------------------------------------------------------------------------

reset role;

-- Avant le job : aucune des trois réservations du cours terminé n'est marquée.
select is(
  (select count(*) from public.bookings
   where class_id = 'f1c00000-0000-4000-8000-00000000000c' and no_show_at is not null)::int,
  0,
  'avant le job, aucun no-show'
);

select is(public.mark_no_shows(), 1, 'le job marque **une** absence sur le cours terminé');

select isnt(
  (select no_show_at from public.bookings where id = 'b0000000-0000-4000-8000-00000000000c'),
  null,
  'la confirmée non pointée est un no-show'
);
select is(
  (select no_show_at from public.bookings where id = 'b0000000-0000-4000-8000-00000000000d'),
  null,
  'la présente n''est pas un no-show'
);
select is(
  (select no_show_at from public.bookings where id = 'b0000000-0000-4000-8000-00000000000e'),
  null,
  'une réservation **annulée** n''est jamais un no-show'
);

-- Le cours de tout à l'heure (dans la fenêtre, non terminé) n'est pas touché.
select is(
  (select no_show_at from public.bookings where id = 'b0000000-0000-4000-8000-00000000000a'),
  null,
  'un cours non terminé n''a pas d''absents, seulement des retardataires'
);

select is(public.mark_no_shows(), 0, 'le job est idempotent : rien de neuf au second passage');

select * from finish();
rollback;
