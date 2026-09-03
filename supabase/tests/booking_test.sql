-- Réservation transactionnelle — les règles métier, une par une.
--
-- Ce fichier est écrit **avant** `book_class()`. Il doit d'abord échouer parce
-- que la fonction n'existe pas, pas parce qu'une assertion est fausse.
--
-- Ce qu'il ne teste pas, et ne peut pas tester : la **concurrence**. Un fichier
-- pgTAP tourne dans une seule session, et deux réservations simultanées sur la
-- dernière place ne se simulent pas en séquentiel — la fonction passerait ce
-- fichier au vert sans le moindre `for update`. C'est l'objet du harnais
-- `scripts/booking-concurrency.mjs`, et c'est le critère qui compte vraiment.

begin;
select plan(31);

-- ---------------------------------------------------------------------------
-- Décor : une série, une occurrence, et de quoi remplir la salle
-- ---------------------------------------------------------------------------

-- Une capacité de 1 : la contention est le sujet, pas le volume.
insert into public.class_schedules (
  id, tenant_id, class_type_id, room_id, coach_membership_id,
  starts_on, starts_at_local, rrule, capacity
) values (
  'c1000000-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  current_date, '18:30', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU', 1
);

select public.materialize_class_occurrences(
  current_date, current_date + 14, 'c1000000-0000-4000-8000-000000000001'
);

-- Le cours de demain : dans la fenêtre d'ouverture (J-7 par défaut) et pas
-- encore fermé (15 min avant le début).
create temporary table cible as
select id, starts_at
from public.classes
where schedule_id = 'c1000000-0000-4000-8000-000000000001'
  and starts_at > now() + interval '1 hour'
order by starts_at
limit 1;

-- Les assertions interrogent cette table sous le rôle `authenticated`, qui n'a
-- aucun droit sur un objet temporaire créé par `postgres`. Même correctif que
-- dans `rls_leak_test.sql`.
grant select on cible to authenticated;

-- ---------------------------------------------------------------------------
-- 1. La forme
-- ---------------------------------------------------------------------------

select has_table('public', 'bookings', 'la table des réservations existe');

select has_function(
  'public', 'book_class',
  array['uuid', 'uuid', 'text'],
  'book_class(cours, appartenance, clé d''idempotence)'
);

select has_function(
  'public', 'member_has_booking_right',
  array['uuid', 'timestamptz'],
  'le point de couture des droits existe, avec la date du cours (RM2.8)'
);

-- `booked_count` ne doit jamais pouvoir être bougé à la main : c'est la seule
-- colonne dont la justesse dépend d'un verrou.
select is(
  has_column_privilege('authenticated', 'public.classes', 'booked_count', 'UPDATE'),
  false,
  'booked_count reste hors d''atteinte d''une écriture directe'
);

select is(
  has_column_privilege('authenticated', 'public.bookings', 'status', 'UPDATE'),
  false,
  'le statut d''une réservation ne se change pas à la main'
);

-- ---------------------------------------------------------------------------
-- 2. Le parcours nominal
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select lives_ok(
  $$select public.book_class(
      (select id from cible),
      'a3000000-0000-4000-8000-000000000002',
      'idem-lea-001'
    )$$,
  'un membre réserve un cours de sa box'
);

select is(
  (select count(*) from public.bookings
   where class_id = (select id from cible) and status = 'CONFIRMED'),
  1::bigint,
  'la réservation est confirmée'
);

select is(
  (select booked_count from public.classes where id = (select id from cible)),
  1,
  'le compteur du cours a été incrémenté dans la même transaction'
);

-- ---------------------------------------------------------------------------
-- 3. Idempotence — règle 4 de CLAUDE.md
-- ---------------------------------------------------------------------------

select is(
  public.book_class(
    (select id from cible),
    'a3000000-0000-4000-8000-000000000002',
    'idem-lea-001'
  ),
  (select id from public.bookings
   where class_id = (select id from cible) and status = 'CONFIRMED'),
  'rejouer la même clé rend la réservation d''origine, pas une nouvelle'
);

select is(
  (select count(*) from public.bookings where class_id = (select id from cible)),
  1::bigint,
  'un double tap ne crée pas deux réservations'
);

select is(
  (select booked_count from public.classes where id = (select id from cible)),
  1,
  'et n''incrémente pas le compteur une seconde fois'
);

select throws_ok(
  $$select public.book_class(
      (select id from cible),
      'a3000000-0000-4000-8000-000000000002',
      null
    )$$,
  '22023', null,
  'une réservation sans clé d''idempotence est refusée'
);

select throws_ok(
  $$select public.book_class(
      (select id from cible),
      'a3000000-0000-4000-8000-000000000002',
      '   '
    )$$,
  '22023', null,
  'une clé vide ne vaut pas une clé'
);

-- ---------------------------------------------------------------------------
-- 4. Les refus métier
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.book_class(
      (select id from cible),
      'a3000000-0000-4000-8000-000000000002',
      'idem-lea-002'
    )$$,
  '23505', null,
  'réserver deux fois le même cours est refusé (ALREADY_BOOKED)'
);

-- La place est prise : le suivant se heurte à la capacité, pas à une file.
set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select throws_ok(
  $$select public.book_class(
      (select id from cible),
      'a3000000-0000-4000-8000-000000000004',
      'idem-julie-001'
    )$$,
  '23514', null,
  'le cours complet est refusé (CLASS_FULL)'
);

select is(
  (select booked_count from public.classes where id = (select id from cible)),
  1,
  'un refus pour cours complet ne laisse aucune trace sur le compteur'
);

select is(
  (select count(*) from public.bookings
   where membership_id = 'a3000000-0000-4000-8000-000000000004'),
  0::bigint,
  'ni aucune réservation fantôme'
);

-- ---------------------------------------------------------------------------
-- 5. On ne réserve que pour soi, et que chez soi
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.book_class(
      (select id from cible),
      'a3000000-0000-4000-8000-000000000002',
      'idem-usurpation'
    )$$,
  '42501', null,
  'réserver pour l''appartenance de quelqu''un d''autre est refusé'
);

set local request.jwt.claims =
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"claire@nanterre.example"}';

select throws_ok(
  $$select public.book_class(
      (select id from cible),
      'b3000000-0000-4000-8000-000000000001',
      'idem-claire-001'
    )$$,
  '42501', null,
  'réserver un cours d''une autre box est refusé, sans dire qu''il existe'
);

-- ---------------------------------------------------------------------------
-- 6. Les fenêtres, en heure locale de la box
-- ---------------------------------------------------------------------------

reset role;

-- Un cours qui commence dans dix minutes : la fermeture par défaut est à J-15 min.
insert into public.classes (
  tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
  starts_at, ends_at, capacity
) values (
  'aaaaaaaa-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  now() + interval '10 minutes', now() + interval '70 minutes', 10
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select throws_ok(
  $$select public.book_class(
      (select id from public.classes
       where starts_at between now() + interval '5 minutes' and now() + interval '15 minutes'
       limit 1),
      'a3000000-0000-4000-8000-000000000004',
      'idem-trop-tard'
    )$$,
  '23514', null,
  'un cours qui commence dans dix minutes est fermé (BOOKING_WINDOW_CLOSED)'
);

reset role;

-- Un cours dans trois mois : au-delà de la fenêtre d'ouverture (J-7).
insert into public.classes (
  tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
  starts_at, ends_at, capacity
) values (
  'aaaaaaaa-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  now() + interval '90 days', now() + interval '90 days 1 hour', 10
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select throws_ok(
  $$select public.book_class(
      (select id from public.classes
       where starts_at > now() + interval '80 days' limit 1),
      'a3000000-0000-4000-8000-000000000004',
      'idem-trop-tot'
    )$$,
  '23514', null,
  'un cours dans trois mois n''est pas encore ouvert (BOOKING_WINDOW_CLOSED)'
);

-- ---------------------------------------------------------------------------
-- 7. Un cours annulé ne se réserve pas
-- ---------------------------------------------------------------------------

reset role;

update public.classes
set status = 'CANCELLED', is_override = true, cancellation_reason = 'test'
where id = (select id from cible);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select throws_ok(
  $$select public.book_class(
      (select id from cible),
      'a3000000-0000-4000-8000-000000000004',
      'idem-annule'
    )$$,
  '23514', null,
  'un cours annulé ne se réserve pas'
);

-- ---------------------------------------------------------------------------
-- 8. Le plafond de réservations à venir (RM2.5)
-- ---------------------------------------------------------------------------

reset role;

update public.classes set status = 'SCHEDULED', is_override = false where id = (select id from cible);
update public.tenant_settings set max_upcoming_bookings = 1
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

-- Julie a droit à une réservation à venir. On lui en donne une, sur un cours
-- large, puis on lui en refuse une seconde.
insert into public.classes (
  id, tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
  starts_at, ends_at, capacity
) values (
  'c2000000-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  now() + interval '2 days', now() + interval '2 days 1 hour', 30
),
(
  'c2000000-0000-4000-8000-000000000002',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  now() + interval '3 days', now() + interval '3 days 1 hour', 30
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select lives_ok(
  $$select public.book_class(
      'c2000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000004',
      'idem-julie-plafond-1'
    )$$,
  'la première réservation à venir passe'
);

select throws_ok(
  $$select public.book_class(
      'c2000000-0000-4000-8000-000000000002',
      'a3000000-0000-4000-8000-000000000004',
      'idem-julie-plafond-2'
    )$$,
  '23514', null,
  'la seconde dépasse le plafond (MAX_UPCOMING_BOOKINGS_REACHED)'
);

-- ---------------------------------------------------------------------------
-- 9. Les droits — la couture de P2-006 et P2-007
-- ---------------------------------------------------------------------------

reset role;

-- En phase pilote, « avoir des droits » veut dire « être membre actif ». Une
-- appartenance suspendue n'en a plus.
update public.tenant_settings set max_upcoming_bookings = 3
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';
update public.memberships set status = 'SUSPENDED'
where id = 'a3000000-0000-4000-8000-000000000004';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select throws_ok(
  $$select public.book_class(
      'c2000000-0000-4000-8000-000000000002',
      'a3000000-0000-4000-8000-000000000004',
      'idem-julie-suspendue'
    )$$,
  '42501', null,
  'une appartenance suspendue ne réserve plus (NO_VALID_ENTITLEMENT)'
);

-- ---------------------------------------------------------------------------
-- 10. Isolation
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"claire@nanterre.example"}';

select is_empty(
  $$select 1 from public.bookings
    where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'une propriétaire d''une autre box ne voit aucune réservation de Rueil'
);

-- ---------------------------------------------------------------------------
-- 11. L'oracle refermé, et la garde de rôle qui manquait
-- ---------------------------------------------------------------------------

-- `member_has_booking_right()` ne filtre ni sur `auth.uid()` ni sur le tenant.
-- Tant qu'elle était exposée à `authenticated`, elle répondait `true` sur une
-- appartenance d'une autre box et `false` sur un identifiant inexistant : un
-- oracle d'existence qui traversait la frontière de tenant. Le correctif n'est
-- pas de durcir la fonction mais de retirer le grant — son seul appelant,
-- `book_class()`, est `security definer` et n'en a jamais eu besoin.
select is(
  has_function_privilege('authenticated', 'public.member_has_booking_right(uuid, timestamptz)', 'EXECUTE'),
  false,
  'member_has_booking_right n''est pas appelable directement : ce serait un oracle inter-tenant'
);

-- Et la preuve que sa fermeture ne casse pas l'appelant : le parcours nominal
-- ci-dessus l'a déjà exercée. Ce contrôle-ci vérifie qu'elle reste hors de portée
-- **aussi** pour `anon`.
select is(
  has_function_privilege('anon', 'public.member_has_booking_right(uuid, timestamptz)', 'EXECUTE'),
  false,
  'ni pour anon'
);

-- Garde de rôle sur `bookings`, exigée par `.claude/rules/database.md` : le test
-- d'isolation A/B ne peut pas voir une élévation MEMBER → OWNER **dans la même
-- box**. C'est précisément là que se logent ces trous.
reset role;

-- Marc, OWNER de Rueil : il voit les réservations de sa box.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select isnt_empty(
  $$select 1 from public.bookings
    where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'un OWNER voit les réservations de sa box'
);

-- Julie, MEMBER de la même box : elle ne voit que les siennes.
set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select is_empty(
  $$select 1 from public.bookings
    where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and membership_id <> 'a3000000-0000-4000-8000-000000000004'$$,
  'un MEMBER de la même box ne voit aucune réservation qui ne soit la sienne'
);

-- Sarah, COACH du cours : la spec §5.2 lui accorde la liste des inscrits de
-- **ses** cours. Elle ne l'avait pas — `current_admin_tenant_ids()` exclut le
-- coach — et le roster de P1-008 en dépendait sans que rien ne le dise.
set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select isnt_empty(
  $$select 1 from public.bookings where class_id = (select id from cible)$$,
  'un COACH voit les inscrits du cours qu''il anime'
);

select * from finish();
rollback;
