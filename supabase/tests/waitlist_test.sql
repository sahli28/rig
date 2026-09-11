-- P1-006 — Liste d'attente : la cascade, l'offre, l'auto-book, les gardes.
--
-- Écrit pour prouver **le siège n'est jamais perdu**. Le cas « personne ne
-- confirme » est celui qui casse en production (note du ticket) : il est le
-- premier scénario, et il vérifie l'invariant central — un siège tenu redevient
-- libre quand toute la file l'ignore, et **aucune réservation n'est créée entre
-- temps** (donc aucun débit à venir).
--
-- Ce que ce fichier ne teste pas : la concurrence réelle (une session, pas de
-- contention) — c'est `scripts/booking-concurrency.mjs`. L'invariant sous verrou
-- (`booked_count = confirmées + offertes`) y sera martelé.

begin;
select plan(40);

-- ---------------------------------------------------------------------------
-- Décor : Rueil, une série, quatre cours capacité 1, plafond desserré
-- ---------------------------------------------------------------------------
\set rueil    '\'aaaaaaaa-0000-4000-8000-000000000001\''
\set lea_ms   '\'a3000000-0000-4000-8000-000000000002\''
\set julie_ms '\'a3000000-0000-4000-8000-000000000004\''
\set hugo_ms  '\'a3000000-0000-4000-8000-000000000005\''
\set lea_jwt    '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}'
\set julie_jwt  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}'
\set hugo_jwt   '{"sub":"77777777-0000-4000-8000-000000000001","role":"authenticated","email":"hugo@rueil.example"}'

-- Le plafond de réservations à venir n'est pas le sujet ici (il l'est dans
-- booking_test) : on le desserre pour que Léa puisse réserver plusieurs cours.
update public.tenant_settings set max_upcoming_bookings = 100
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into public.class_schedules (
  id, tenant_id, class_type_id, room_id, coach_membership_id,
  starts_on, starts_at_local, rrule, capacity
) values (
  'f1000000-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  current_date, '18:30', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU', 1
);

-- X, Z : ≥ 12 h (offre + fenêtre de confirmation). Y : < 12 h (auto-book).
-- W : capacité 2, restera avec une place libre (garde CLASS_NOT_FULL).
-- V : ≥ 12 h, annulé par la box pendant qu'une offre court (D-027).
insert into public.classes (
  id, tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
  starts_at, ends_at, capacity
) values
  ('f2000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003',
   now() + interval '2 days', now() + interval '2 days' + interval '1 hour', 1),
  ('f2000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003',
   now() + interval '6 hours', now() + interval '7 hours', 1),
  ('f2000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003',
   now() + interval '3 days', now() + interval '3 days' + interval '1 hour', 1),
  ('f2000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003',
   now() + interval '4 days', now() + interval '4 days' + interval '1 hour', 2),
  ('f2000000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003',
   now() + interval '5 days', now() + interval '5 days' + interval '1 hour', 1);

\set classX '\'f2000000-0000-4000-8000-000000000001\''
\set classY '\'f2000000-0000-4000-8000-000000000002\''
\set classZ '\'f2000000-0000-4000-8000-000000000003\''
\set classW '\'f2000000-0000-4000-8000-000000000004\''
\set classV '\'f2000000-0000-4000-8000-000000000005\''

-- Un helper pour lire le code applicatif d'une erreur (SQLSTATE partagés).
-- Il exécute le SQL dans son propre bloc : `get stacked diagnostics` ne vaut
-- que dans un gestionnaire d'exception. Même forme que cancellation_test.
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
-- 1. La forme
-- ---------------------------------------------------------------------------
select has_function('public', 'join_waitlist', array['uuid','uuid','text'], 'join_waitlist existe');
select has_function('public', 'promote_waitlist', array['uuid','uuid','timestamptz'], 'promote_waitlist existe');
select has_function('public', 'confirm_promotion', array['uuid'], 'confirm_promotion existe');
select has_function('public', 'leave_waitlist', array['uuid'], 'leave_waitlist existe');
select has_function('public', 'expire_waitlist_offers', array['timestamptz'], 'expire_waitlist_offers existe');
select has_function('public', 'my_waitlist_rank', array['uuid'], 'my_waitlist_rank existe');
select is(
  has_function_privilege('authenticated', 'public.promote_waitlist(uuid,uuid,timestamptz)', 'EXECUTE'),
  false, 'promote_waitlist est interne : authenticated ne l''appelle pas'
);
select is(
  has_function_privilege('authenticated', 'public.join_waitlist(uuid,uuid,text)', 'EXECUTE'),
  true, 'un membre rejoint la file'
);
select is(
  has_function_privilege('authenticated', 'public.my_waitlist_rank(uuid)', 'EXECUTE'),
  true, 'un membre lit son propre rang'
);
select is(
  has_function_privilege('anon', 'public.my_waitlist_rank(uuid)', 'EXECUTE'),
  false, 'anon ne lit aucun rang'
);

-- ---------------------------------------------------------------------------
-- 2. FLAGSHIP — personne ne confirme : le siège redevient libre, sans débit
-- ---------------------------------------------------------------------------
-- Léa remplit X (capacité 1) ; Julie puis Hugo rejoignent la file.
set local role authenticated;
set local request.jwt.claims = :'lea_jwt';
select public.book_class(:classX, :lea_ms, 'lea-x');

set local request.jwt.claims = :'julie_jwt';
select public.join_waitlist(:classX, :julie_ms, 'jw-julie-x');
set local request.jwt.claims = :'hugo_jwt';
select public.join_waitlist(:classX, :hugo_ms, 'jw-hugo-x');
reset role;

select is((select booked_count from public.classes where id = :classX), 1, 'X est plein');
select is((select waitlist_count from public.classes where id = :classX), 2, 'deux en file sur X');

-- Le rang **dérivé**, lu sous l'identité de chacun. Julie a rejoint avant Hugo,
-- donc une position d'insertion plus basse : 1re, puis 2e. Léa, réservée, n'a
-- aucune entrée active — son rang est null, pas 0 (« pas sur la file » ≠ « en
-- tête »). Le tout la même seconde, avant que Léa n'annule et ne rebatte l'ordre.
set local role authenticated;
set local request.jwt.claims = :'julie_jwt';
select is(public.my_waitlist_rank(:classX), 1, 'Julie est 1re — elle a rejoint la première');
set local request.jwt.claims = :'hugo_jwt';
select is(public.my_waitlist_rank(:classX), 2, 'Hugo est 2e');
set local request.jwt.claims = :'lea_jwt';
select is(public.my_waitlist_rank(:classX), null, 'Léa, réservée, n''est pas sur la file : rang null');
-- Isolation inter-tenant, **figée par un test** (règle 10, doublon structurel/
-- comportemental) : Claire est propriétaire de Nanterre, pas membre de Rueil.
-- Sur X — un cours de Rueil où deux personnes attendent réellement — son rang
-- est null, jamais 2. Si un jour la jointure sur `auth.uid()` s'affaiblissait,
-- le décompte d'une autre box fuirait ici, et cette assertion rougirait.
set local request.jwt.claims = '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"claire@nanterre.example"}';
select is(
  public.my_waitlist_rank(:classX),
  null,
  'Claire (Nanterre) sur un cours de Rueil : rang null — le décompte d''une autre box ne fuit pas'
);
reset role;

-- Léa annule : la place s'offre à la tête (Julie), et **reste tenue**.
set local role authenticated;
set local request.jwt.claims = :'lea_jwt';
select public.cancel_booking((select id from public.bookings where class_id = :classX and membership_id = :lea_ms));
reset role;

select is(
  (select status::text from public.waitlist_entries where class_id = :classX and membership_id = :julie_ms),
  'OFFERED', 'Julie reçoit l''offre'
);
select isnt(
  (select expires_at from public.waitlist_entries where class_id = :classX and membership_id = :julie_ms),
  null, 'l''offre porte un délai'
);
select is((select booked_count from public.classes where id = :classX), 1, 'le siège reste tenu pendant l''offre');

-- Julie ignore : l'offre expire, la place cascade à Hugo.
update public.waitlist_entries set expires_at = now() - interval '1 minute'
where class_id = :classX and membership_id = :julie_ms and status = 'OFFERED';
select public.expire_waitlist_offers();

select is(
  (select status::text from public.waitlist_entries where class_id = :classX and membership_id = :julie_ms),
  'EXPIRED', 'l''offre de Julie a expiré'
);
select is(
  (select status::text from public.waitlist_entries where class_id = :classX and membership_id = :hugo_ms),
  'OFFERED', 'la place a cascadé à Hugo'
);
select is((select booked_count from public.classes where id = :classX), 1, 'siège toujours tenu pour Hugo');

-- Hugo ignore aussi : file épuisée, le siège **redevient libre**.
update public.waitlist_entries set expires_at = now() - interval '1 minute'
where class_id = :classX and membership_id = :hugo_ms and status = 'OFFERED';
select public.expire_waitlist_offers();

select is((select booked_count from public.classes where id = :classX), 0, 'personne n''a pris : le siège est LIBRE');
select is((select waitlist_count from public.classes where id = :classX), 0, 'la file est vide');
select is(
  (select count(*)::int from public.bookings where class_id = :classX and status = 'CONFIRMED'),
  0, 'aucune réservation créée en chemin — aucun débit'
);

-- Et la place libre est réellement réservable.
set local role authenticated;
set local request.jwt.claims = :'julie_jwt';
select isnt(public.book_class(:classX, :julie_ms, 'julie-x-libre'), null, 'la place rendue est réservable');
reset role;

-- ---------------------------------------------------------------------------
-- 3. Auto-book (< 12 h) : pas de fenêtre, la place se prend d'office
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = :'lea_jwt';
select public.book_class(:classY, :lea_ms, 'lea-y');
set local request.jwt.claims = :'julie_jwt';
select public.join_waitlist(:classY, :julie_ms, 'jw-julie-y');
set local request.jwt.claims = :'lea_jwt';
select public.cancel_booking((select id from public.bookings where class_id = :classY and membership_id = :lea_ms and status = 'CONFIRMED'));
reset role;

select is(
  (select status::text from public.waitlist_entries where class_id = :classY and membership_id = :julie_ms),
  'ACCEPTED', 'à moins de 12 h, Julie est promue d''office'
);
select is(
  (select count(*)::int from public.bookings where class_id = :classY and membership_id = :julie_ms and status = 'CONFIRMED'),
  1, 'et une réservation confirmée existe pour elle'
);
select is((select booked_count from public.classes where id = :classY), 1, 'le siège a été transféré, pas ajouté');

-- ---------------------------------------------------------------------------
-- 4. Confirmation d'une offre (≥ 12 h), et son idempotence
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = :'lea_jwt';
select public.book_class(:classZ, :lea_ms, 'lea-z');
set local request.jwt.claims = :'julie_jwt';
select public.join_waitlist(:classZ, :julie_ms, 'jw-julie-z');
set local request.jwt.claims = :'lea_jwt';
select public.cancel_booking((select id from public.bookings where class_id = :classZ and membership_id = :lea_ms));
reset role;

set local role authenticated;
set local request.jwt.claims = :'julie_jwt';
select isnt(
  public.confirm_promotion((select id from public.waitlist_entries where class_id = :classZ and membership_id = :julie_ms)),
  null, 'Julie confirme dans le délai : une réservation'
);
reset role;

select is(
  (select status::text from public.waitlist_entries where class_id = :classZ and membership_id = :julie_ms),
  'ACCEPTED', 'l''entrée passe à ACCEPTED'
);
select is((select booked_count from public.classes where id = :classZ), 1, 'le siège tenu devient la réservation');

-- Rejeu : la même entrée rend la même réservation, sans double-booking.
set local role authenticated;
set local request.jwt.claims = :'julie_jwt';
select is(
  public.confirm_promotion((select id from public.waitlist_entries where class_id = :classZ and membership_id = :julie_ms)),
  (select booking_id from public.waitlist_entries where class_id = :classZ and membership_id = :julie_ms),
  'confirmer deux fois rend la même réservation (idempotent)'
);
reset role;

-- ---------------------------------------------------------------------------
-- 5. Gardes du join
-- ---------------------------------------------------------------------------
-- On ne rejoint pas la file d'un cours qui a de la place (W, capacité 2, vide).
set local role authenticated;
set local request.jwt.claims = :'julie_jwt';
select throws_ok(
  format('select public.join_waitlist(%L, %L, %L)', :classW, :julie_ms, 'jw-w'),
  '23514', null, 'un cours non complet se réserve, ne se waitliste pas'
);
select is(
  pg_temp.code_of(format('select public.join_waitlist(%L, %L, %L)', :classW, :julie_ms, 'jw-w')),
  'CLASS_NOT_FULL', 'et le code applicatif le dit'
);
reset role;

-- Déjà en file : rejoindre avec une autre clé lève ALREADY_ON_WAITLIST.
-- (Décor : Léa remplit W une fois, puis Julie s'y met en file deux fois.)
set local role authenticated;
set local request.jwt.claims = :'lea_jwt';
select public.book_class(:classW, :lea_ms, 'lea-w');
set local request.jwt.claims = :'hugo_jwt';
select public.book_class(:classW, :hugo_ms, 'hugo-w');   -- W (cap 2) désormais plein
set local request.jwt.claims = :'julie_jwt';
select public.join_waitlist(:classW, :julie_ms, 'jw-w-1');
select throws_ok(
  format('select public.join_waitlist(%L, %L, %L)', :classW, :julie_ms, 'jw-w-2'),
  '23505', null, 'déjà en file : une seconde entrée active est refusée'
);
select is(
  pg_temp.code_of(format('select public.join_waitlist(%L, %L, %L)', :classW, :julie_ms, 'jw-w-2')),
  'ALREADY_ON_WAITLIST', 'et le code applicatif le dit'
);
reset role;

-- ---------------------------------------------------------------------------
-- 6. Confirmer sur un cours annulé par la box (D-027)
-- ---------------------------------------------------------------------------
-- Léa remplit V (cap 1), Julie rejoint et se fait offrir la place (≥ 12 h → offre).
-- Puis la box annule le cours : l'écran de staff pose `status = 'CANCELLED'` et
-- `cancel_class_bookings` passe les entrées actives à `CLASS_CANCELLED`. Fait à la
-- main ici pour rester borné à `confirm_promotion` (l'annulation par la box a ses
-- propres tests). Confirmer doit alors dire « cours annulé », pas « offre expirée » :
-- le siège n'est passé à personne, il n'y a plus de cours.
set local role authenticated;
set local request.jwt.claims = :'lea_jwt';
select public.book_class(:classV, :lea_ms, 'lea-v');
set local request.jwt.claims = :'julie_jwt';
select public.join_waitlist(:classV, :julie_ms, 'jw-julie-v');
set local request.jwt.claims = :'lea_jwt';
select public.cancel_booking((select id from public.bookings where class_id = :classV and membership_id = :lea_ms));
reset role;

select is(
  (select status::text from public.waitlist_entries where class_id = :classV and membership_id = :julie_ms),
  'OFFERED', 'Julie a une offre en cours sur V'
);

update public.classes set status = 'CANCELLED' where id = :classV;
update public.waitlist_entries set status = 'CLASS_CANCELLED'
where class_id = :classV and membership_id = :julie_ms;

set local role authenticated;
set local request.jwt.claims = :'julie_jwt';
select throws_ok(
  format('select public.confirm_promotion(%L)',
    (select id from public.waitlist_entries where class_id = :classV and membership_id = :julie_ms)),
  '23514', null, 'confirmer sur un cours annulé lève une erreur métier'
);
select is(
  pg_temp.code_of(format('select public.confirm_promotion(%L)',
    (select id from public.waitlist_entries where class_id = :classV and membership_id = :julie_ms))),
  'CLASS_CANCELLED', 'et le code dit « cours annulé », pas OFFER_EXPIRED'
);
reset role;

select * from finish();
rollback;
