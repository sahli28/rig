-- Annulation — les fenêtres, la cascade, et ce qu'on ne promet pas.
--
-- Écrit **avant** `cancel_booking()`. Doit d'abord échouer parce que la fonction
-- n'existe pas, pas parce qu'une assertion est fausse.
--
-- Ce que ce fichier ne teste pas : la concurrence entre une annulation et une
-- réservation sur la même place. Une session, pas de contention — c'est l'objet
-- de `scripts/booking-concurrency.mjs --scenario cancel`, et c'est là que se
-- trouve l'invariant qui compte : `booked_count = count(bookings CONFIRMED)`.

begin;
select plan(46);

-- ---------------------------------------------------------------------------
-- Décor : une série quotidienne, deux occurrences utiles
-- ---------------------------------------------------------------------------

insert into public.class_schedules (
  id, tenant_id, class_type_id, room_id, coach_membership_id,
  starts_on, starts_at_local, rrule, capacity
) values (
  'e1000000-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  current_date, '18:30', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU', 2
);

select public.materialize_class_occurrences(
  current_date, current_date + 14, 'e1000000-0000-4000-8000-000000000001'
);

-- Un cours confortablement dans la fenêtre : demain ou après-demain.
create temporary table libre as
select id, starts_at from public.classes
where schedule_id = 'e1000000-0000-4000-8000-000000000001'
  and starts_at > now() + interval '20 hours'
order by starts_at limit 1;

-- Un cours **dans la fenêtre d'annulation** : la fermeture par défaut est à
-- 240 min, donc trois heures avant le début est déjà « tardif ».
insert into public.classes (
  id, tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
  starts_at, ends_at, capacity
) values (
  'e2000000-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000003',
  now() + interval '3 hours', now() + interval '4 hours', 2
);

grant select on libre to authenticated;

-- ---------------------------------------------------------------------------
-- 1. La forme
-- ---------------------------------------------------------------------------

select has_function(
  'public', 'cancel_booking',
  array['uuid'],
  'cancel_booking(réservation) — l''identifiant suffit, il est l''idempotence'
);

select has_function(
  'public', 'cancel_class_bookings',
  array['uuid'],
  'cancel_class_bookings(cours) — la sœur : annuler un cours annule ses réservations'
);

select has_function(
  'public', 'restore_booking_entitlement',
  array['uuid', 'boolean'],
  'le point de couture de la restitution existe, avec « dans la fenêtre ? »'
);

select has_column(
  'public', 'bookings', 'cancelled_within_window',
  'le fait est stocké, pas dérivé : cancel_window_minutes est éditable'
);

select is(
  has_column_privilege('authenticated', 'public.bookings', 'cancelled_within_window', 'UPDATE'),
  false,
  'et personne ne peut le réécrire à la main'
);

-- ---------------------------------------------------------------------------
-- 2. Annuler dans la fenêtre
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select public.book_class(
  (select id from libre), 'a3000000-0000-4000-8000-000000000002', 'annul-lea-001'
);

select is(
  (select booked_count from public.classes where id = (select id from libre)),
  1,
  'le décor est posé : une place prise'
);

select lives_ok(
  $$select public.cancel_booking(
      (select id from public.bookings
       where membership_id = 'a3000000-0000-4000-8000-000000000002'
         and class_id = (select id from libre))
    )$$,
  'un membre annule sa réservation'
);

select is(
  (select status from public.bookings
   where membership_id = 'a3000000-0000-4000-8000-000000000002'
     and class_id = (select id from libre)),
  'CANCELLED'::public.booking_status,
  'la réservation passe à CANCELLED'
);

select is(
  (select booked_count from public.classes where id = (select id from libre)),
  0,
  'la place est **immédiatement** libérée'
);

select is(
  (select cancelled_within_window from public.bookings
   where membership_id = 'a3000000-0000-4000-8000-000000000002'
     and class_id = (select id from libre)),
  true,
  'et l''annulation est marquée comme faite dans les délais'
);

select isnt(
  (select cancelled_at from public.bookings
   where membership_id = 'a3000000-0000-4000-8000-000000000002'
     and class_id = (select id from libre)),
  null,
  'cancelled_at est horodaté'
);

-- ---------------------------------------------------------------------------
-- 3. Ré-réserver après annulation — ce que l'index partiel autorise
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.book_class(
      (select id from libre), 'a3000000-0000-4000-8000-000000000002', 'annul-lea-002'
    )$$,
  'annuler puis re-réserver le même cours est possible'
);

select is(
  (select count(*) from public.bookings
   where membership_id = 'a3000000-0000-4000-8000-000000000002'
     and class_id = (select id from libre)),
  2::bigint,
  'les deux lignes coexistent — une CANCELLED, une CONFIRMED'
);

select is(
  (select booked_count from public.classes where id = (select id from libre)),
  1,
  'et le compteur suit'
);

-- ---------------------------------------------------------------------------
-- 4. Double annulation — aucune double restitution
-- ---------------------------------------------------------------------------

-- L'identifiant de la réservation **est** la clé d'idempotence : annuler deux
-- fois la même ligne doit être sans effet, pas une erreur. Un membre qui tape
-- deux fois sur un réseau lent a annulé, une fois.
select lives_ok(
  $$select public.cancel_booking(
      (select id from public.bookings
       where membership_id = 'a3000000-0000-4000-8000-000000000002'
         and class_id = (select id from libre)
         and status = 'CONFIRMED')
    )$$,
  'première annulation'
);

select is(
  (select booked_count from public.classes where id = (select id from libre)),
  0,
  'la place est libérée une fois'
);

select lives_ok(
  $$select public.cancel_booking(
      (select id from public.bookings
       where membership_id = 'a3000000-0000-4000-8000-000000000002'
         and class_id = (select id from libre)
         and idempotency_key = 'annul-lea-002')
    )$$,
  'rejouer l''annulation ne lève pas'
);

select is(
  (select booked_count from public.classes where id = (select id from libre)),
  0,
  'et ne décrémente pas une seconde fois — c''est la double restitution qu''on évite'
);

-- ---------------------------------------------------------------------------
-- 5. Hors fenêtre : accepté, marqué, sans conséquence dans l'app
-- ---------------------------------------------------------------------------
--
-- RM2.4 dit « après : crédit consommé ». Aucune table de crédits n'existe
-- (P2-007). Le pilote **accepte** l'annulation — sinon la place resterait
-- occupée par quelqu'un qui a dit ne pas venir — la marque tardive, et laisse
-- la box appliquer sa règle hors de l'app.

select public.book_class(
  'e2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002',
  'annul-lea-tardif'
);

select lives_ok(
  $$select public.cancel_booking(
      (select id from public.bookings where idempotency_key = 'annul-lea-tardif')
    )$$,
  'une annulation hors fenêtre est **acceptée**, pas refusée'
);

select is(
  (select cancelled_within_window from public.bookings
   where idempotency_key = 'annul-lea-tardif'),
  false,
  'elle est marquée comme tardive'
);

select is(
  (select booked_count from public.classes where id = 'e2000000-0000-4000-8000-000000000001'),
  0,
  'et la place est libérée quand même — c''est tout l''intérêt de l''accepter'
);

-- ---------------------------------------------------------------------------
-- 5bis. Un cours commencé ne s'annule plus — les deux bornes
-- ---------------------------------------------------------------------------
--
-- La section 5 dit que tardif reste accepté. Celle-ci dit où « tardif » finit.
--
-- Sans cette garde, **le no-show devient effaçable** : RM3.4 le définit comme
-- « pas de check-in, cours eu lieu, réservation non annulée », donc qui n'est
-- pas venu annule le lendemain et son absence n'a jamais existé. Effet plus
-- visible du même trou : `booked_count` décrémenté sur un cours passé, et un
-- cours qui était plein affiche zéro inscrit dans les statistiques de
-- remplissage une semaine plus tard.
--
-- **Comment on atteint les bornes.** `book_class()` refuse un cours à moins de
-- `close_minutes_before` (15 min par défaut) : réserver un cours qui commence
-- dans une minute est impossible par construction. On réserve donc à J-2h,
-- **puis** on déplace le cours de part et d'autre de son début. Écrire la
-- réservation à la main contournerait `book_class()`, et un test qui contourne
-- ce qu'il prétend exercer ne prouve rien.

reset role;

-- Le SQLSTATE ne suffit pas : `23514` sert déjà à `BOOKING_WINDOW_CLOSED`. Ce
-- qui se vérifie est le **code applicatif**, celui auquel le client réagit.
-- Même helper que `app_error_codes_test.sql`, recopié parce que `pg_temp` ne
-- traverse pas les fichiers.
create or replace function pg_temp.code_of(p_sql text)
returns text
language plpgsql
as $$
declare
  v_detail text;
begin
  execute p_sql;
  return null;  -- pas d'erreur levée
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return (v_detail::jsonb) ->> 'code';
end;
$$;

insert into public.classes (
  id, tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
  starts_at, ends_at, capacity
) values
  ('e3000000-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   now() + interval '2 hours', now() + interval '3 hours', 2),
  -- Décalés d'une minute les uns des autres : `classes_schedule_occurrence_key`
  -- est unique sur `(schedule_id, starts_at)`, et `now()` est figé dans la
  -- transaction. Vaut aussi pour les instants d'arrivée plus bas.
  ('e4000000-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   now() + interval '2 hours 1 minute', now() + interval '3 hours', 2),
  ('e5000000-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   now() + interval '2 hours 2 minutes', now() + interval '3 hours', 2);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select public.book_class(
  'e3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002', 'annul-borne-avant'
);
select public.book_class(
  'e4000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002', 'annul-borne-apres'
);
select public.book_class(
  'e5000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002', 'annul-cours-passe'
);

-- **Une minute avant le début.**
reset role;
update public.classes
set starts_at = now() + interval '1 minute', ends_at = now() + interval '61 minutes'
where id = 'e3000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select lives_ok(
  $$select public.cancel_booking(
      (select id from public.bookings where idempotency_key = 'annul-borne-avant')
    )$$,
  'à une minute du début, l''annulation passe encore'
);

-- La borne du **début** n'est pas celle de la **fenêtre**, et ce test le prouve :
-- la même annulation est acceptée *et* marquée tardive. Un code qui confondrait
-- les deux gardes rendrait ici `true`, ou lèverait.
select is(
  (select cancelled_within_window from public.bookings
   where idempotency_key = 'annul-borne-avant'),
  false,
  'et reste marquée tardive — la fenêtre juge, le début interdit'
);

select is(
  (select booked_count from public.classes
   where id = 'e3000000-0000-4000-8000-000000000001'),
  0,
  'la place est libérée : jusqu''au début, il reste quelque chose à libérer'
);

-- **Une minute après le début.**
reset role;
update public.classes
set starts_at = now() - interval '1 minute', ends_at = now() + interval '59 minutes'
where id = 'e4000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select throws_ok(
  $$select public.cancel_booking(
      (select id from public.bookings where idempotency_key = 'annul-borne-apres')
    )$$,
  '23514', null,
  'une minute après le début, l''annulation est refusée'
);

select is(
  pg_temp.code_of(
    $$select public.cancel_booking(
        (select id from public.bookings where idempotency_key = 'annul-borne-apres')
      )$$
  ),
  'CLASS_ALREADY_STARTED',
  'avec son propre code : `23514` sert déjà à BOOKING_WINDOW_CLOSED'
);

-- Les deux assertions qui **sont** la règle : ce qu'on protège n'est pas la
-- fonction, c'est la donnée du no-show et celle du remplissage.
select is(
  (select status from public.bookings where idempotency_key = 'annul-borne-apres'),
  'CONFIRMED'::public.booking_status,
  'la réservation reste confirmée — le no-show de RM3.4 n''est pas effaçable'
);

select is(
  (select booked_count from public.classes
   where id = 'e4000000-0000-4000-8000-000000000001'),
  1,
  'et le cours passé garde son compte d''inscrits'
);

-- **Le rejeu survit à la garde.** Une annulation faite avant le cours reste
-- rejouable après : l'identifiant est l'idempotence, et refuser ici rendrait une
-- erreur pour une action qui a réussi — le cas exact du client qui perd la
-- réponse et retente.
reset role;
update public.classes
set starts_at = now() - interval '3 minutes', ends_at = now() + interval '57 minutes'
where id = 'e3000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select lives_ok(
  $$select public.cancel_booking(
      (select id from public.bookings where idempotency_key = 'annul-borne-avant')
    )$$,
  'rejouer une annulation déjà faite reste sans erreur, même le cours passé'
);

select is(
  (select status from public.bookings where idempotency_key = 'annul-borne-avant'),
  'CANCELLED'::public.booking_status,
  'et sans effet'
);

-- **La sœur n'a délibérément pas la garde.** Une box qui annule après coup un
-- cours qui n'a pas eu lieu régularise — c'est son seul chemin de rattrapage, et
-- il passe par une garde de rôle. Ce test existe pour que personne n'« aligne »
-- les deux fonctions en croyant refermer un oubli.
reset role;
update public.classes
set starts_at = now() - interval '2 minutes', ends_at = now() + interval '58 minutes'
where id = 'e5000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select is(
  public.cancel_class_bookings('e5000000-0000-4000-8000-000000000001'),
  1,
  'la box annule encore les réservations d''un cours déjà passé'
);

select is(
  (select cancelled_within_window from public.bookings
   where idempotency_key = 'annul-cours-passe'),
  true,
  'et ces annulations-là restent subies, jamais tardives'
);

-- ---------------------------------------------------------------------------
-- 6. La fenêtre se lit dans les réglages de la box, et rien d'autre
-- ---------------------------------------------------------------------------

reset role;
update public.tenant_settings set cancel_window_minutes = 60
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select public.book_class(
  'e2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002',
  'annul-lea-fenetre-courte'
);

-- Le même cours, à trois heures : tardif à 240 min, dans les délais à 60.
select is(
  (select public.cancel_booking(
     (select id from public.bookings where idempotency_key = 'annul-lea-fenetre-courte')
   ) is not null),
  true,
  'la fenêtre suit le réglage de la box'
);

select is(
  (select cancelled_within_window from public.bookings
   where idempotency_key = 'annul-lea-fenetre-courte'),
  true,
  'à 60 minutes de fenêtre, la même annulation à J-3h est dans les délais'
);

-- **Le marquage est figé, pas recalculé.** `cancel_window_minutes` est éditable
-- depuis P1-001b : si le drapeau était dérivé, changer le réglage réécrirait
-- l'histoire de toutes les annulations passées.
reset role;
update public.tenant_settings set cancel_window_minutes = 240
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select cancelled_within_window from public.bookings
   where idempotency_key = 'annul-lea-fenetre-courte'),
  true,
  'et changer le réglage après coup ne réécrit pas ce qui a déjà été jugé'
);

-- ---------------------------------------------------------------------------
-- 7. On n'annule que ses propres réservations
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select public.book_class(
  (select id from libre), 'a3000000-0000-4000-8000-000000000004', 'annul-julie-001'
);

set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select throws_ok(
  $$select public.cancel_booking(
      (select id from public.bookings where idempotency_key = 'annul-julie-001')
    )$$,
  '42501', null,
  'annuler la réservation de quelqu''un d''autre est refusé'
);

-- Lu hors du rôle applicatif : sous `authenticated`, Léa ne **voit** pas la
-- réservation de Julie — `bookings_own_select` la lui cache, ce qui est le
-- comportement voulu. L'assertion porte sur l'état de la ligne, pas sur ce que
-- Léa en perçoit ; la lire sous son rôle mesurait la RLS, pas l'annulation.
reset role;

select is(
  (select status from public.bookings where idempotency_key = 'annul-julie-001'),
  'CONFIRMED'::public.booking_status,
  'et la réservation visée n''a pas bougé'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

-- Une réservation inconnue et celle d'une autre box rendent la même réponse.
select throws_ok(
  $$select public.cancel_booking('00000000-0000-4000-8000-00000000dead')$$,
  '42501', null,
  'une réservation inconnue est refusée sans dire qu''elle n''existe pas'
);

-- **Et l'autre moitié de cette phrase**, que seul le commentaire affirmait :
-- « celle d'une autre box ». Toute cette suite tournait sur un seul tenant.
--
-- L'identifiant doit arriver **réel** dans la main de Claire, sinon le test
-- passerait pour une mauvaise raison : la RLS lui cache la ligne, le
-- sous-`select` rendrait `null`, et on mesurerait la garde « réservation
-- inconnue » au lieu de la garde de propriété.
reset role;
create temporary table resa_julie as
select id from public.bookings where idempotency_key = 'annul-julie-001';
grant select on resa_julie to authenticated;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"claire@nanterre.example"}';

select throws_ok(
  $$select public.cancel_booking((select id from resa_julie))$$,
  '42501', null,
  'la propriétaire d''une autre box est refusée exactement comme sur un identifiant inconnu'
);

-- ---------------------------------------------------------------------------
-- 8. La sœur : annuler un cours annule ses réservations
-- ---------------------------------------------------------------------------
--
-- Avant ce ticket, `classes.status = 'CANCELLED'` ne touchait **rien** : les
-- réservations restaient CONFIRMED, le compteur restait plein, et la personne
-- voyait toujours sa réservation active dans « Mes réservations ». Le seul
-- trigger sur `classes` était `set_updated_at` — vérifié au catalogue.

-- **Avant le chemin de succès, les deux refus** — parce qu'ils n'existaient pas.
-- `cancel_class_bookings()` n'était appelée que par Marc, `OWNER` : sa garde de
-- rôle et sa garde de tenant étaient écrites dans le `where` du `for update`, et
-- rien ne prouvait qu'elles refusaient quoi que ce soit. Contrôle structurel
-- contre contrôle comportemental, et c'est `rls-auditor` qui a posé la question,
-- ni cette suite ni sa sœur `cancel_booking()` — qui, elle, a son test d'échec
-- depuis la section 7.
--
-- Ce qu'ils attrapent le jour où ils rougiront : `current_admin_tenant_ids()`
-- remplacée par `current_tenant_ids()`, ou le filtre de tenant retiré du
-- `for update` en le croyant posé ailleurs. La fonction est
-- `grant execute … to authenticated` sans distinction de rôle : c'est elle, et
-- elle seule, qui tient la porte.
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"lea@example.com"}';

select throws_ok(
  $$select public.cancel_class_bookings((select id from libre))$$,
  '42501', null,
  'un MEMBER n''annule pas un cours entier à la place du staff'
);

set local request.jwt.claims =
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"claire@nanterre.example"}';

select throws_ok(
  $$select public.cancel_class_bookings((select id from libre))$$,
  '42501', null,
  'et la propriétaire d''une autre box non plus, sur un cours qui n''est pas le sien'
);

reset role;

select is(
  (select count(*) from public.bookings
   where class_id = (select id from libre) and status = 'CONFIRMED'),
  1::bigint,
  'les deux tentatives n''ont rien touché — un refus se mesure à ce qui n''a pas bougé'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select lives_ok(
  $$select public.cancel_class_bookings((select id from libre))$$,
  'la box annule un cours entier'
);

select is(
  (select count(*) from public.bookings
   where class_id = (select id from libre) and status = 'CONFIRMED'),
  0::bigint,
  'aucune réservation ne reste confirmée sur un cours annulé'
);

select is(
  (select booked_count from public.classes where id = (select id from libre)),
  0,
  'et le compteur retombe à zéro'
);

-- Ce n'est pas la faute des membres : leurs annulations sont **dans les
-- délais**, quoi qu'il arrive. Le jour où P2-007 restituera un crédit, cette
-- ligne décidera qu'il est rendu.
select is(
  (select bool_and(cancelled_within_window) from public.bookings
   where class_id = (select id from libre) and status = 'CANCELLED'),
  true,
  'une annulation subie n''est jamais tardive'
);

select * from finish();
rollback;
