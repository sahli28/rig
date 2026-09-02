-- Planning récurrent : le calendrier est un fait métier tenant-scopé, pas une
-- projection construite côté client. Ces tests précèdent la migration P1-002.

begin;
select plan(24);

select has_table('public', 'class_schedules', 'la série récurrente existe');
select has_table('public', 'classes', 'les occurrences matérialisées existent');
select has_function(
  'public',
  'pilot_weekly_rrule_valid',
  array['text'],
  'la validation RRULE pilote vit aussi en base'
);
select has_function(
  'public',
  'materialize_class_occurrences',
  array['date', 'date', 'uuid'],
  'le job de matérialisation est testable hors pg_cron, et bornable à une série'
);
select has_function(
  'public',
  'refresh_class_schedule',
  array['uuid', 'date', 'date'],
  'une modification de série réconcilie les seules occurrences modifiables'
);

-- Parité de grammaire avec le TypeScript.
--
-- Ces deux listes sont **mot pour mot** celles de
-- `packages/core/src/supabase/class-schedules.test.ts`. La grammaire du pilote
-- est écrite à deux endroits — elle doit l'être, la base ne peut pas exécuter de
-- TypeScript et un écran ne peut pas se reposer sur un code d'erreur — donc la
-- seule façon honnête de la tenir est que les deux suites échouent ensemble le
-- jour où l'une dérive.
--
-- En une assertion par sens plutôt qu'une par chaîne : ce qu'on veut lire dans
-- un échec, c'est **laquelle** a dérivé, et `string_agg` le dit.
select is(
  (select coalesce(string_agg(candidate, ', ' order by candidate), '')
   from (values
     ('FREQ=WEEKLY;BYDAY=MO'),
     ('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'),
     ('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;UNTIL=20261231'),
     ('FREQ=WEEKLY;INTERVAL=52;BYDAY=SU'),
     ('FREQ=WEEKLY;BYDAY=SA,SU;UNTIL=20270101')
   ) as acceptees(candidate)
   where not public.pilot_weekly_rrule_valid(candidate)),
  '',
  'toute RRULE du sous-ensemble pilote est acceptée'
);

select is(
  (select coalesce(string_agg(candidate, ', ' order by candidate), '')
   from (values
     -- Fréquences hors pilote.
     ('FREQ=MONTHLY;BYDAY=MO'),
     ('FREQ=DAILY;BYDAY=MO'),
     -- COUNT exigerait de dérouler la série pour savoir quand elle s'arrête.
     ('FREQ=WEEKLY;BYDAY=MO;COUNT=8'),
     -- Clés inconnues, même inoffensives en apparence. WKST changerait
     -- l'alignement des semaines d'INTERVAL sans que rien ne le signale.
     ('FREQ=WEEKLY;BYDAY=MO;BYHOUR=18'),
     ('FREQ=WEEKLY;WKST=SU;BYDAY=MO'),
     -- BYDAY est obligatoire : sans lui la RFC déduit le jour de DTSTART, ce
     -- que la matérialisation ne fait pas.
     ('FREQ=WEEKLY'),
     ('FREQ=WEEKLY;BYDAY='),
     -- Bornes d'INTERVAL.
     ('FREQ=WEEKLY;INTERVAL=0;BYDAY=MO'),
     ('FREQ=WEEKLY;INTERVAL=53;BYDAY=MO'),
     -- La forme est canonique, pas approximative.
     ('BYDAY=MO;FREQ=WEEKLY'),
     -- Jour inconnu, jour répété.
     ('FREQ=WEEKLY;BYDAY=XX'),
     ('FREQ=WEEKLY;BYDAY=MO,MO'),
     -- UNTIL mal formé, et une date qui n'existe pas.
     ('FREQ=WEEKLY;BYDAY=MO;UNTIL=2026-12-31'),
     ('FREQ=WEEKLY;BYDAY=MO;UNTIL=20260230')
   ) as refusees(candidate)
   where public.pilot_weekly_rrule_valid(candidate)),
  '',
  'toute RRULE hors du sous-ensemble pilote est refusée, jamais approximée'
);

-- Hugo est MANAGER de Rueil mais seulement MEMBER de Nanterre : le cas qui
-- distingue « a un rôle quelque part » de « a le rôle dans cette box ».
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"77777777-0000-4000-8000-000000000001","role":"authenticated","email":"hugo@rueil.example"}';

select lives_ok(
  $$insert into public.class_schedules (
      id, tenant_id, class_type_id, room_id, coach_membership_id,
      starts_on, starts_at_local, rrule, capacity
    ) values (
      'a6000000-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000003',
      '2026-10-19', '18:30', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 16
    )$$,
  'un MANAGER crée une série dans sa box'
);

select throws_ok(
  $$insert into public.class_schedules (
      tenant_id, class_type_id, room_id, coach_membership_id,
      starts_on, starts_at_local, rrule, capacity
    ) values (
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000003',
      '2026-10-19', '18:30', 'FREQ=MONTHLY;BYDAY=MO', 16
    )$$,
  '23514', null,
  'la contrainte SQL refuse une RRULE non prise en charge'
);

select throws_ok(
  $$insert into public.class_schedules (
      tenant_id, class_type_id, room_id, coach_membership_id,
      starts_on, starts_at_local, rrule, capacity
    ) values (
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000003',
      '2026-10-19', '18:30', 'FREQ=WEEKLY;BYDAY=MO', 16
    )$$,
  '23503', null,
  'une salle d''une autre box est refusée par FK composite'
);

reset role;

select is(
  public.materialize_class_occurrences('2026-10-19', '2026-12-13'),
  40,
  'huit semaines de WOD lundi-vendredi matérialisent quarante occurrences'
);

select is(
  public.materialize_class_occurrences('2026-10-19', '2026-12-13'),
  0,
  'rejouer le job ne duplique aucune occurrence'
);

select is(
  (select count(*) from public.classes
   where schedule_id = 'a6000000-0000-4000-8000-000000000001'),
  40::bigint,
  'les quarante occurrences sont bien stockées'
);

-- Le 25 octobre 2026 est le dimanche de retour à l''heure d''hiver en France.
insert into public.class_schedules (
  id, tenant_id, class_type_id, room_id, coach_membership_id,
  starts_on, starts_at_local, rrule, capacity
) values (
  'a6000000-0000-4000-8000-000000000002',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  '2026-10-18', '18:30', 'FREQ=WEEKLY;BYDAY=SU', 16
);

select public.materialize_class_occurrences('2026-10-18', '2026-10-25');

select is(
  (select to_char(starts_at at time zone 'Europe/Paris', 'YYYY-MM-DD HH24:MI')
   from public.classes
   where schedule_id = 'a6000000-0000-4000-8000-000000000002'
     and starts_at::date = '2026-10-25'),
  '2026-10-25 18:30',
  'le passage à l''heure d''hiver conserve 18h30 en heure locale de la box'
);

-- Une réservation future est représentée ici par booked_count : P1-003 le
-- modifiera dans sa transaction avec la réservation. Une exception annulée et
-- une occurrence réservée survivent toutes deux à la réduction de la série.
update public.classes set booked_count = 1
where schedule_id = 'a6000000-0000-4000-8000-000000000001'
  and starts_at at time zone 'Europe/Paris' = '2026-10-20 18:30'::timestamp;

update public.classes set status = 'CANCELLED', is_override = true
where schedule_id = 'a6000000-0000-4000-8000-000000000001'
  and starts_at at time zone 'Europe/Paris' = '2026-10-23 18:30'::timestamp;

update public.class_schedules
set rrule = 'FREQ=WEEKLY;BYDAY=MO', capacity = 12
where id = 'a6000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"77777777-0000-4000-8000-000000000001","role":"authenticated","email":"hugo@rueil.example"}';

select public.refresh_class_schedule(
  'a6000000-0000-4000-8000-000000000001', '2026-10-19', '2026-12-13'
);

select is(
  (select count(*) from public.classes
   where schedule_id = 'a6000000-0000-4000-8000-000000000001'
     and starts_at at time zone 'Europe/Paris' = '2026-10-20 18:30'::timestamp),
  1::bigint,
  'la modification ne détruit pas une occurrence réservée'
);

select is(
  (select status from public.classes
   where schedule_id = 'a6000000-0000-4000-8000-000000000001'
     and starts_at at time zone 'Europe/Paris' = '2026-10-23 18:30'::timestamp),
  'CANCELLED'::public.class_status,
  'une annulation unique ne casse pas la série et n''est pas réécrite'
);

select is(
  (select count(*) from public.classes
   where schedule_id = 'a6000000-0000-4000-8000-000000000001'
     and extract(isodow from starts_at at time zone 'Europe/Paris') not in (1, 2, 5)),
  0::bigint,
  'les occurrences futures non réservées et non exceptionnelles suivent la nouvelle règle'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select is(
  (select count(*) from public.classes
   where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  12::bigint,
  'un membre lit les occurrences de sa box'
);

select throws_ok(
  $$insert into public.class_schedules (
      tenant_id, class_type_id, room_id, coach_membership_id,
      starts_on, starts_at_local, rrule, capacity
    ) values (
      'aaaaaaaa-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000003',
      '2026-10-19', '18:30', 'FREQ=WEEKLY;BYDAY=MO', 16
    )$$,
  '42501', null,
  'un MEMBER ne crée pas une série'
);

select is_empty(
  $$select 1 from public.classes
    where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  'un membre ne voit aucune occurrence d''une autre box'
);

-- Rafraîchir sa propre série ne doit rien écrire chez le voisin.
--
-- `refresh_class_schedule()` est `security definer` et son propriétaire
-- `postgres` porte `rolbypassrls` : les policies de `classes` ne la freinent
-- pas. La seule barrière est donc la portée de la requête elle-même, et c'est
-- exactement ce que ce contrôle vérifie. Marc est OWNER de Rueil et **n'est
-- membre d'aucune autre box** — il ne verra jamais ces lignes, mais sans le
-- `p_schedule_id`, il les créait.
reset role;

insert into public.class_schedules (
  id, tenant_id, class_type_id, room_id, coach_membership_id,
  starts_on, starts_at_local, rrule, capacity
) values (
  'a6000000-0000-4000-8000-0000000000bb',
  'bbbbbbbb-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  '2026-10-19', '19:00', 'FREQ=WEEKLY;BYDAY=MO', 16
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select public.refresh_class_schedule(
  'a6000000-0000-4000-8000-000000000001', '2026-10-19', '2026-12-13'
);

reset role;

select is(
  (select count(*) from public.classes
   where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  0::bigint,
  'rafraîchir une série de sa box n''écrit aucune occurrence chez une autre box'
);

-- La sœur du contrôle précédent : l'un vérifie qu'on n'écrit pas chez le voisin
-- par effet de bord, l'autre qu'on ne peut pas le viser directement. La garde de
-- rôle lit le tenant de la série, pas celui que l'appelant prétend avoir.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select throws_ok(
  $$select public.refresh_class_schedule(
      'a6000000-0000-4000-8000-0000000000bb', '2026-10-19', '2026-12-13'
    )$$,
  '42501', null,
  'un OWNER ne rafraîchit pas la série d''une box dont il n''est pas membre'
);

reset role;

-- Alignement de semaine : les semaines se comptent depuis le lundi, pas depuis
-- `starts_on`. Série démarrée un **mercredi**, une semaine sur deux le lundi.
-- La RFC 5545 (WKST=MO) place la première occurrence le 02/11, pas le 26/10.
insert into public.class_schedules (
  id, tenant_id, class_type_id, room_id, coach_membership_id,
  starts_on, starts_at_local, rrule, capacity
) values (
  'a6000000-0000-4000-8000-0000000000cc',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  '2026-10-21', '18:30', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO', 16
);

select public.materialize_class_occurrences(
  '2026-10-21', '2026-12-13', 'a6000000-0000-4000-8000-0000000000cc'
);

select is(
  (select string_agg(
     to_char(starts_at at time zone 'Europe/Paris', 'YYYY-MM-DD'), ', ' order by starts_at)
   from public.classes
   where schedule_id = 'a6000000-0000-4000-8000-0000000000cc'),
  '2026-11-02, 2026-11-16, 2026-11-30',
  'INTERVAL=2 compte les semaines depuis le lundi, même si la série démarre un mercredi'
);

select is(
  (select count(*) from public.classes
   where schedule_id = 'a6000000-0000-4000-8000-000000000002'),
  2::bigint,
  'matérialiser une série n''en matérialise aucune autre, même dans la même box'
);

select * from finish();
rollback;
