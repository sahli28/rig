-- P2-018 — Abonnement à durée fixe, attribué à la main (RM2.8).
--
-- Ce fichier est écrit **avant** la migration. Il doit d'abord échouer parce que
-- la table et la fonction n'existent pas, pas parce qu'une assertion est fausse.
--
-- Ce qu'il prouve : la garde de réservation passe par un abonnement qui couvre
-- la **date locale de la box** du cours (y compris au passage d'heure d'été),
-- l'attribution est réservée à OWNER/MANAGER et journalisée, et il n'existe
-- aucun chemin d'écriture hors de `grant_member_subscription()` — le motif
-- `bookings` : l'absence de policy d'écriture est la garantie, pas un oubli.
--
-- Toutes les assertions sont **bornées** (D-014/D-020) : jamais un comptage sur
-- la seule base d'une appartenance, toujours sur ce que ce décor-ci a écrit.

begin;
select plan(27);

-- ---------------------------------------------------------------------------
-- Décor
-- ---------------------------------------------------------------------------

-- Julie (Rueil) perd son abonnement de seed : elle est le témoin « la box
-- attribue 3 mois ». Le seed donne un accès à toutes les appartenances — l'état
-- d'une box vivante — donc le cas « sans accès » se fabrique ici, pas là-bas.
delete from public.member_subscriptions
where membership_id = 'a3000000-0000-4000-8000-000000000004';

-- La fenêtre d'ouverture par défaut (J-7) fermerait un cours à +2 mois **avant**
-- que les droits parlent : on l'écarte pour que le refus observé soit bien
-- NO_VALID_ENTITLEMENT, pas BOOKING_WINDOW_CLOSED.
update public.tenant_settings set open_days_before = 200
where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001';

-- Deux cours ponctuels (P1-026 : schedule_id null + is_override) : un couvert
-- par « 3 mois », un au-delà.
insert into public.classes (
  id, tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
  starts_at, ends_at, capacity, is_override
) values
  ('d2180000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', null,
   'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   now() + interval '2 months', now() + interval '2 months 1 hour', 30, true),
  ('d2180000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', null,
   'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   now() + interval '4 months', now() + interval '4 months 1 hour', 30, true);

-- ---------------------------------------------------------------------------
-- 1. La forme, et les droits d'exécution
-- ---------------------------------------------------------------------------

select has_table('public', 'member_subscriptions', 'la table des abonnements existe');

select has_function(
  'public', 'grant_member_subscription',
  array['uuid', 'integer'],
  'grant_member_subscription(appartenance, durée en mois)'
);

-- L'oracle reste fermé (close_booking_right_oracle) : le remplir ne le rouvre
-- pas. `booking_test.sql` porte la même assertion — elle est répétée ici parce
-- que c'est CE ticket qui touche la fonction.
select is(
  has_function_privilege('authenticated', 'public.member_has_booking_right(uuid, timestamptz)', 'EXECUTE'),
  false,
  'member_has_booking_right reste inaccessible à authenticated'
);

select is(
  has_function_privilege('anon', 'public.member_has_booking_right(uuid, timestamptz)', 'EXECUTE'),
  false,
  'et à anon'
);

select is(
  has_function_privilege('authenticated', 'public.grant_member_subscription(uuid, integer)', 'EXECUTE'),
  true,
  'grant_member_subscription est appelable — sa garde de rôle est dans son corps'
);

-- ---------------------------------------------------------------------------
-- 2. Ce que la base refuse d'elle-même
-- ---------------------------------------------------------------------------

-- Durée hors {1, 2, 3, 6, 12} : refusée par la contrainte, quel que soit le
-- chemin d'écriture — y compris celui-ci, sous `postgres`.
select throws_ok(
  $$insert into public.member_subscriptions
      (tenant_id, membership_id, duration_months, starts_on, ends_on)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            'a3000000-0000-4000-8000-000000000004', 4, current_date,
            (current_date + make_interval(months => 4) - interval '1 day')::date)$$,
  '23514', null,
  'une durée de 4 mois est refusée par la base'
);

-- `ends_on` n'est pas une donnée, c'est un calcul : l'invariant vit sur la
-- table, pas seulement dans la fonction (règle des sœurs — il couvre aussi les
-- chemins d'écriture qu'on écrira plus tard).
select throws_ok(
  $$insert into public.member_subscriptions
      (tenant_id, membership_id, duration_months, starts_on, ends_on)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            'a3000000-0000-4000-8000-000000000004', 3, current_date,
            (current_date + interval '1 day')::date)$$,
  '23514', null,
  'un ends_on incohérent avec starts_on + durée est refusé par la base'
);

-- ---------------------------------------------------------------------------
-- 3. Qui attribue — COACH non, OWNER/MANAGER oui
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select throws_ok(
  $$select public.grant_member_subscription('a3000000-0000-4000-8000-000000000004', 3)$$,
  '42501', null,
  'un COACH ne peut pas attribuer un accès (FORBIDDEN_ROLE)'
);

set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select throws_ok(
  $$select public.grant_member_subscription('a3000000-0000-4000-8000-000000000004', 3)$$,
  '42501', null,
  'un MEMBER ne peut pas s''attribuer un accès à lui-même'
);

set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select lives_ok(
  $$select public.grant_member_subscription('a3000000-0000-4000-8000-000000000004', 3)$$,
  'un OWNER attribue 3 mois à un membre de sa box'
);

-- Aucune écriture directe, même pour un OWNER : la fonction est le seul chemin.
select throws_ok(
  $$insert into public.member_subscriptions
      (tenant_id, membership_id, duration_months, starts_on, ends_on)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            'a3000000-0000-4000-8000-000000000004', 1, current_date,
            (current_date + make_interval(months => 1) - interval '1 day')::date)$$,
  '42501', null,
  'aucun insert direct, même OWNER : grant_member_subscription est le seul chemin'
);

reset role;

-- ---------------------------------------------------------------------------
-- 4. Ce que l'attribution a écrit
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from public.member_subscriptions
   where membership_id = 'a3000000-0000-4000-8000-000000000004'),
  1::bigint,
  'une seule ligne pour Julie : celle que Marc vient d''attribuer'
);

select is(
  (select starts_on from public.member_subscriptions
   where membership_id = 'a3000000-0000-4000-8000-000000000004'),
  (now() at time zone 'Europe/Paris')::date,
  'l''accès commence aujourd''hui, en date locale de la box'
);

select is(
  (select ends_on from public.member_subscriptions
   where membership_id = 'a3000000-0000-4000-8000-000000000004'),
  ((now() at time zone 'Europe/Paris')::date + make_interval(months => 3) - interval '1 day')::date,
  'et se termine à starts_on + 3 mois - 1 jour, borne incluse'
);

select is(
  (select granted_by from public.member_subscriptions
   where membership_id = 'a3000000-0000-4000-8000-000000000004'),
  'a3000000-0000-4000-8000-000000000001'::uuid,
  'granted_by porte l''appartenance de l''attribuant'
);

select is(
  (select count(*) from public.audit_logs
   where action = 'subscription.granted'
     and target_id = 'a3000000-0000-4000-8000-000000000004'),
  1::bigint,
  'l''attribution est journalisée, dans la même transaction'
);

-- ---------------------------------------------------------------------------
-- 5. Le critère central : 3 mois couvrent +2 mois, pas +4
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

select lives_ok(
  $$select public.book_class(
      'd2180000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000004',
      'idem-p2018-couvert'
    )$$,
  'avec 3 mois d''accès, un cours dans 2 mois se réserve'
);

select throws_ok(
  $$select public.book_class(
      'd2180000-0000-4000-8000-000000000002',
      'a3000000-0000-4000-8000-000000000004',
      'idem-p2018-au-dela'
    )$$,
  '42501', null,
  'un cours dans 4 mois est refusé (NO_VALID_ENTITLEMENT)'
);

reset role;

-- Un MANAGER attribue aussi (Hugo, à Léa — qui cumule alors une seconde ligne :
-- renouvellement = ré-attribution, jamais une mise à jour).
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"77777777-0000-4000-8000-000000000001","role":"authenticated","email":"hugo@rueil.example"}';

select lives_ok(
  $$select public.grant_member_subscription('a3000000-0000-4000-8000-000000000002', 1)$$,
  'un MANAGER attribue aussi'
);

reset role;

-- ---------------------------------------------------------------------------
-- 6. La frontière du jour, en heure locale — y compris au passage d'heure d'été
-- ---------------------------------------------------------------------------

-- Thomas (Nanterre) reçoit un accès qui se termine le 25 octobre 2026 — le jour
-- où l'heure d'été finit à Paris. Dates fixes : l'oracle ne dépend pas de now().
delete from public.member_subscriptions
where membership_id = 'b3000000-0000-4000-8000-000000000002';

insert into public.member_subscriptions
  (tenant_id, membership_id, duration_months, starts_on, ends_on)
values ('bbbbbbbb-0000-4000-8000-000000000001',
        'b3000000-0000-4000-8000-000000000002', 2, date '2026-08-26', date '2026-10-25');

select ok(
  public.member_has_booking_right(
    'b3000000-0000-4000-8000-000000000002',
    timestamptz '2026-10-25 23:30:00 Europe/Paris'),
  'le dernier soir de l''accès, on réserve encore'
);

select ok(
  not public.member_has_booking_right(
    'b3000000-0000-4000-8000-000000000002',
    timestamptz '2026-10-26 00:30:00 Europe/Paris'),
  'dès le lendemain (heure locale), plus rien'
);

-- Le piège UTC : à 23 h 30 UTC le 25, il est déjà 00 h 30 le 26 à Paris
-- (repassée à UTC+1 le matin même). Une comparaison sur la date UTC dirait oui.
select ok(
  not public.member_has_booking_right(
    'b3000000-0000-4000-8000-000000000002',
    timestamptz '2026-10-25 23:30:00+00'),
  'la frontière est la date locale de la box, pas la date UTC'
);

-- ---------------------------------------------------------------------------
-- 7. L'abonnement ne suffit pas : l'appartenance doit rester active
-- ---------------------------------------------------------------------------

update public.memberships set status = 'SUSPENDED'
where id = 'a3000000-0000-4000-8000-000000000004';

select ok(
  not public.member_has_booking_right(
    'a3000000-0000-4000-8000-000000000004',
    now() + interval '2 months'),
  'suspendue, Julie ne réserve plus — abonnement valide ou pas'
);

update public.memberships set status = 'ACTIVE'
where id = 'a3000000-0000-4000-8000-000000000004';

-- ---------------------------------------------------------------------------
-- 8. Qui lit quoi
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"66666666-0000-4000-8000-000000000001","role":"authenticated","email":"julie@example.com"}';

-- Julie est membre des deux boxes : « le sien » couvre ses deux appartenances,
-- et rien d'autre.
select is_empty(
  $$select 1 from public.member_subscriptions
    where membership_id not in ('a3000000-0000-4000-8000-000000000004',
                                'b3000000-0000-4000-8000-000000000003')$$,
  'un membre ne lit que ses propres abonnements'
);

set local request.jwt.claims =
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"claire@nanterre.example"}';

select is_empty(
  $$select 1 from public.member_subscriptions
    where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'la propriétaire d''une autre box ne voit rien de Rueil'
);

set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select isnt_empty(
  $$select 1 from public.member_subscriptions
    where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'un OWNER lit les abonnements de sa box'
);

set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select is_empty(
  $$select 1 from public.member_subscriptions
    where membership_id <> 'a3000000-0000-4000-8000-000000000003'$$,
  'un COACH ne lit que le sien : l''accès des membres est une affaire d''administration'
);

reset role;

select * from finish();
rollback;
