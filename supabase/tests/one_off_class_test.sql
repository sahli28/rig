-- P1-026 — le cours ponctuel : sans série, dérogatoire par construction.
--
-- Quatre choses à prouver, et la quatrième est celle qui compte pour un
-- membre : ① l'invariant refuse le cas dangereux (NULL sans drapeau),
-- ② un admin pose un ponctuel par le vrai chemin (RLS + grants, pas un
-- superutilisateur), ③ un balayage GLOBAL de matérialisation — le chemin du
-- job nocturne — ne le touche ni ne le duplique, ④ un membre le réserve par
-- `book_class()` comme n'importe quel cours : la réservation ne lit pas la
-- série.

begin;
select plan(9);

-- Le repère temporel, calculé une fois : demain, à une heure ronde — dans la
-- fenêtre de réservation par défaut (open_days_before) pour que ④ exerce le
-- cas nominal.
create temp table repere as
  select (date_trunc('hour', now()) + interval '26 hours') as starts_at;
grant select on repere to authenticated;

-- ---------------------------------------------------------------------------
-- ① L'invariant : schedule_id NULL sans is_override est refusé par la base
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.classes
      (tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
       starts_at, ends_at, capacity, is_override)
    values
      ('aaaaaaaa-0000-4000-8000-000000000001', null,
       'a4000000-0000-4000-8000-000000000001',
       'a2000000-0000-4000-8000-000000000001',
       'a3000000-0000-4000-8000-000000000003',
       (select starts_at from repere), (select starts_at from repere) + interval '1 hour',
       10, false)$$,
  '23514',
  null,
  'schedule_id NULL sans is_override viole classes_ponctuel_est_derogatoire — le cas qui échapperait aux refresh ne peut pas exister'
);

-- ---------------------------------------------------------------------------
-- ② Marc (OWNER de Rueil) pose un ponctuel par le vrai chemin
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select lives_ok(
  $$insert into public.classes
      (tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
       starts_at, ends_at, capacity, is_override)
    values
      ('aaaaaaaa-0000-4000-8000-000000000001', null,
       'a4000000-0000-4000-8000-000000000001',
       'a2000000-0000-4000-8000-000000000001',
       'a3000000-0000-4000-8000-000000000003',
       (select starts_at from repere), (select starts_at from repere) + interval '1 hour',
       10, true)$$,
  'un OWNER insère un cours ponctuel sous authenticated — policy, grants et FK composites d''accord'
);

select is(
  (select count(*)::int from public.classes
   where schedule_id is null
     and starts_at = (select starts_at from repere)),
  1,
  'le ponctuel existe, sans série'
);

-- ---------------------------------------------------------------------------
-- ③ Le balayage global du job nocturne ne le touche ni ne le duplique
-- ---------------------------------------------------------------------------

reset role;

create temp table avant as
  select id, updated_at, capacity from public.classes
  where schedule_id is null and starts_at = (select starts_at from repere);
grant select on avant to authenticated;

select lives_ok(
  $$select public.materialize_class_occurrences(
      current_date, (current_date + 30)::date, null)$$,
  'le balayage global (chemin du job nocturne, toutes séries) s''exécute'
);

select is(
  (select count(*)::int from public.classes
   where starts_at = (select starts_at from repere)
     and room_id = 'a2000000-0000-4000-8000-000000000001'
     and deleted_at is null),
  1,
  'après balayage : une seule ligne à cet horaire dans cette salle — pas de doublon'
);

select is(
  (select c.updated_at from public.classes c join avant a on a.id = c.id),
  (select updated_at from avant),
  'après balayage : le ponctuel n''a pas été réécrit (updated_at intact)'
);

-- ---------------------------------------------------------------------------
-- ④ Léa (MEMBER) le réserve par book_class() — la réservation ne lit pas la série
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select lives_ok(
  $$select public.book_class(
      (select id from avant),
      'a3000000-0000-4000-8000-000000000002',
      'p1-026-ponctuel-idem-1')$$,
  'un membre réserve le ponctuel comme n''importe quel cours'
);

select is(
  (select status::text from public.bookings
   where class_id = (select id from avant)
     and membership_id = 'a3000000-0000-4000-8000-000000000002'),
  'CONFIRMED',
  'la réservation est CONFIRMED'
);

select is(
  (select booked_count from public.classes where id = (select id from avant)),
  1,
  'booked_count suit — le compteur vit sur l''occurrence, pas sur la série'
);

select * from finish();
rollback;
