-- P2-020 — Open gym qui chevauche un cours, explicitement.
--
-- Ce fichier est écrit **avant** la migration. La règle qu'il fige : deux
-- créneaux dans la même salle au même moment sont un cas prévu **si au moins
-- l'un est en accès libre** (`class_types.is_open_access`) ; deux cours coachés
-- au même endroit sont un conflit à signaler — signaler, jamais bloquer : il
-- n'existe aucun garde dur d'occupation de salle (P1-026), et ce ticket n'en
-- construit pas.
--
-- La règle repose sur la **colonne**, pas sur le nom « Open gym » : une box
-- peut renommer son type sans casser le comportement.
--
-- Les deux fonctions sont `security invoker`, et c'est une décision de
-- sécurité : elles prennent un identifiant du client, et l'invoker les met
-- sous la RLS de l'appelant — un id d'une autre box rend 0, pas une réponse.
-- C'est la leçon de `close_booking_right_oracle` prise à l'envers, et
-- l'assertion « non-oracle » ci-dessous la fige.

begin;
select plan(13);

-- ---------------------------------------------------------------------------
-- Décor : une salle partagée, des ponctuels qui se chevauchent
-- ---------------------------------------------------------------------------

-- Demain, heure ronde — même repère que one_off_class_test.
create temp table repere as
  select (date_trunc('hour', now()) + interval '26 hours') as starts_at;
grant select on repere to authenticated;

-- Deux salles créées PAR CE DÉCOR, et aucun cours en Salle principale : le
-- seed y matérialise ses propres séries (WOD 18:30, Haltéro 19:00…), et un
-- repère à `now()+26h` peut tomber dessus selon l'heure d'exécution — c'est
-- exactement le rouge intermittent que D-014/D-020 documentent. Une salle que
-- seul le test connaît rend les comptages vrais à toute heure.
insert into public.rooms (id, tenant_id, location_id, name, capacity)
values
  ('e2100000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'Annexe A', 12),
  ('e2100000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'Annexe B', 12);

-- Six ponctuels (P1-026 : schedule_id null + is_override), tous à Rueil :
--   -01  WOD,      Annexe A, T .. T+1h            — la base du décor
--   -02  WOD,      Annexe A, T+30 .. T+90         — chevauche -01 : LE conflit
--   -03  Open gym, Annexe A, T .. T+2h            — chevauche tout, et c'est prévu
--   -04  WOD,      Annexe A, T+30 .. T+90, ANNULÉ — un fantôme n'avertit pas
--   -05  WOD,      Annexe B, T .. T+1h            — même heure, autre salle
--   -06  WOD,      Annexe A, T+3h .. T+4h         — même salle, heures disjointes
insert into public.classes (
  id, tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
  starts_at, ends_at, capacity, is_override, status
)
select
  ('e2200000-0000-4000-8000-00000000000' || n)::uuid,
  'aaaaaaaa-0000-4000-8000-000000000001', null,
  type_id::uuid, room_id::uuid, 'a3000000-0000-4000-8000-000000000003',
  (select starts_at from repere) + debut,
  (select starts_at from repere) + fin,
  10, true, statut::public.class_status
from (values
  ('1', 'a4000000-0000-4000-8000-000000000001', 'e2100000-0000-4000-8000-000000000001', interval '0',          interval '1 hour',    'SCHEDULED'),
  ('2', 'a4000000-0000-4000-8000-000000000001', 'e2100000-0000-4000-8000-000000000001', interval '30 minutes', interval '90 minutes','SCHEDULED'),
  ('3', 'a4000000-0000-4000-8000-000000000003', 'e2100000-0000-4000-8000-000000000001', interval '0',          interval '2 hours',   'SCHEDULED'),
  ('4', 'a4000000-0000-4000-8000-000000000001', 'e2100000-0000-4000-8000-000000000001', interval '30 minutes', interval '90 minutes','CANCELLED'),
  ('5', 'a4000000-0000-4000-8000-000000000001', 'e2100000-0000-4000-8000-000000000002', interval '0',          interval '1 hour',    'SCHEDULED'),
  ('6', 'a4000000-0000-4000-8000-000000000001', 'e2100000-0000-4000-8000-000000000001', interval '3 hours',    interval '4 hours',   'SCHEDULED')
) as decor(n, type_id, room_id, debut, fin, statut);

-- ---------------------------------------------------------------------------
-- 1. La forme
-- ---------------------------------------------------------------------------

select has_column(
  'public', 'class_types', 'is_open_access',
  'class_types porte le marqueur d''accès libre'
);

select is(
  (select is_open_access from public.class_types
   where id = 'a4000000-0000-4000-8000-000000000001'),
  false,
  'un type existant reste coaché par défaut'
);

select is(
  (select is_open_access from public.class_types
   where id = 'a4000000-0000-4000-8000-000000000003'),
  true,
  'l''« Open gym » du seed est en accès libre — par la colonne, pas par le nom'
);

select has_function(
  'public', 'coached_room_conflicts_for_class', array['uuid'],
  'la règle existe pour un cours'
);

select has_function(
  'public', 'coached_room_conflicts_for_schedule', array['uuid'],
  'et pour une série'
);

-- Invoker, pas definer : une fonction qui prend un id du client et répondrait
-- hors RLS serait un oracle d'existence inter-tenant (close_booking_right_oracle).
select is(
  (select coalesce(string_agg(p.proname, ', '), '')
   from pg_proc p
   join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('coached_room_conflicts_for_class', 'coached_room_conflicts_for_schedule')
     and p.prosecdef),
  '',
  'les deux fonctions sont security invoker : la RLS de l''appelant s''applique'
);

-- ---------------------------------------------------------------------------
-- 2. La règle, cas par cas (sous postgres : la règle nue, sans RLS)
-- ---------------------------------------------------------------------------

select is(
  public.coached_room_conflicts_for_class('e2200000-0000-4000-8000-000000000002'),
  1,
  'deux WOD dans la même salle au même moment : un conflit'
);

-- -01 côtoie l'open gym (-03), l'annulé (-04), l'autre salle (-05) et le
-- disjoint (-06) : seul -02 compte. C'est l'assertion des exclusions.
select is(
  public.coached_room_conflicts_for_class('e2200000-0000-4000-8000-000000000001'),
  1,
  'open gym, annulé, autre salle et heures disjointes ne comptent pas'
);

select is(
  public.coached_room_conflicts_for_class('e2200000-0000-4000-8000-000000000003'),
  0,
  'l''open gym se pose sur des cours coachés sans conflit — c''est prévu'
);

-- ---------------------------------------------------------------------------
-- 3. Non-oracle : la frontière de box tient
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"claire@nanterre.example"}';

select is(
  public.coached_room_conflicts_for_class('e2200000-0000-4000-8000-000000000002'),
  0,
  'une propriétaire d''une autre box n''obtient rien : la RLS s''applique dans la fonction'
);

set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select is(
  public.coached_room_conflicts_for_class('e2200000-0000-4000-8000-000000000002'),
  1,
  'le vrai appelant — un admin de la box — voit le conflit'
);

reset role;

-- ---------------------------------------------------------------------------
-- 4. Les séries : mêmes règles, à travers leurs occurrences
-- ---------------------------------------------------------------------------

insert into public.class_schedules (
  id, tenant_id, class_type_id, room_id, coach_membership_id,
  starts_on, starts_at_local, rrule, capacity
)
values
  ('e2300000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000001', 'e2100000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   ((select starts_at from repere) at time zone 'Europe/Paris')::date,
   ((select starts_at from repere) at time zone 'Europe/Paris')::time,
   'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU', 10),
  ('e2300000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000003', 'e2100000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   ((select starts_at from repere) at time zone 'Europe/Paris')::date,
   ((select starts_at from repere) at time zone 'Europe/Paris')::time,
   'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU', 10);

select public.materialize_class_occurrences(
  ((select starts_at from repere) at time zone 'Europe/Paris')::date,
  ((select starts_at from repere) at time zone 'Europe/Paris')::date,
  'e2300000-0000-4000-8000-000000000001'
);
select public.materialize_class_occurrences(
  ((select starts_at from repere) at time zone 'Europe/Paris')::date,
  ((select starts_at from repere) at time zone 'Europe/Paris')::date,
  'e2300000-0000-4000-8000-000000000002'
);

-- L'occurrence coachée tombe sur -01 et -02 : UNE occurrence en conflit (on
-- compte les occurrences à signaler, pas les paires).
select is(
  public.coached_room_conflicts_for_schedule('e2300000-0000-4000-8000-000000000001'),
  1,
  'une série coachée posée sur un créneau occupé : son occurrence est signalée'
);

select is(
  public.coached_room_conflicts_for_schedule('e2300000-0000-4000-8000-000000000002'),
  0,
  'une série d''open gym au même endroit ne signale rien'
);

select * from finish();
rollback;
