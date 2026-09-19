-- P2-004 — `box_dashboard(tenant)` : le snapshot du tableau de bord.
--
-- Écrit sur un tenant **neuf et isolé** (pas le seed) : chaque comptage est donc
-- borné à ce que ce décor-ci écrit (D-014/D-020), jamais à une appartenance du
-- seed. Ce qu'il prouve :
--   * fenêtre = 30 derniers jours écoulés — un cours futur et un cours de la
--     fenêtre précédente sont exclus du courant (ajust. 1) ;
--   * remplissage lu depuis `classes.booked_count`, activité/présences depuis
--     `bookings` — deux sources distinctes (on met booked_count ≠ nb de bookings
--     exprès pour le prouver) ;
--   * expirations réservées à OWNER/MANAGER, `null` pour un COACH (ajust. 2), qui
--     obtient malgré tout les agrégats box-wide que la RLS de `bookings` ne lui
--     donnerait pas ;
--   * la checklist se dérive de l'état réel — supprimer une salle la décoche ;
--   * un MEMBER et un staff d'une autre box sont refoulés.

begin;
select plan(23);

-- ---------------------------------------------------------------------------
-- Décor : un tenant neuf « TDASH », possédé par Marc (user du seed 1111…).
-- Inséré en superutilisateur (avant tout `set role`) : la RLS ne s'applique pas,
-- c'est la fabrique du décor, pas le sujet du test.
-- ---------------------------------------------------------------------------
insert into public.tenants (id, slug, name, timezone) values
  ('d0040000-0000-4000-8000-000000000001', 'tdash-p2004', 'Test Dashboard', 'Europe/Paris');
insert into public.tenant_settings (tenant_id) values
  ('d0040000-0000-4000-8000-000000000001');
insert into public.locations (id, tenant_id, name, city) values
  ('d0040000-0000-4000-8000-000000000002', 'd0040000-0000-4000-8000-000000000001', 'Salle', 'Paris');
insert into public.rooms (id, tenant_id, location_id, name, capacity) values
  ('d0040000-0000-4000-8000-000000000003', 'd0040000-0000-4000-8000-000000000001',
   'd0040000-0000-4000-8000-000000000002', 'Salle principale', 20);
insert into public.class_types (id, tenant_id, name_i18n, duration_minutes, color, default_capacity, is_open_access) values
  ('d0040000-0000-4000-8000-000000000004', 'd0040000-0000-4000-8000-000000000001',
   '{"fr":"WOD","en":"WOD"}', 60, '#E4572E', 20, false);

insert into public.memberships (id, tenant_id, user_id, role, status) values
  ('d0040000-0000-4000-8000-00000000000a', 'd0040000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'OWNER',  'ACTIVE'),
  ('d0040000-0000-4000-8000-00000000000b', 'd0040000-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001', 'MEMBER', 'ACTIVE'),
  ('d0040000-0000-4000-8000-00000000000c', 'd0040000-0000-4000-8000-000000000001', '66666666-0000-4000-8000-000000000001', 'MEMBER', 'ACTIVE'),
  ('d0040000-0000-4000-8000-00000000000d', 'd0040000-0000-4000-8000-000000000001', '44444444-0000-4000-8000-000000000001', 'COACH',  'ACTIVE');

-- Trois cours : dans la fenêtre (−3 j), futur (+20 j, exclu), fenêtre précédente
-- (−45 j). `booked_count` est posé à la main — le remplissage le lit.
insert into public.classes
  (id, tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
   starts_at, ends_at, capacity, booked_count, status, is_override) values
  ('d0040000-0000-4000-8000-000000000101', 'd0040000-0000-4000-8000-000000000001', null,
   'd0040000-0000-4000-8000-000000000004', 'd0040000-0000-4000-8000-000000000003', 'd0040000-0000-4000-8000-00000000000d',
   now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 10, 7, 'SCHEDULED', true),
  ('d0040000-0000-4000-8000-000000000102', 'd0040000-0000-4000-8000-000000000001', null,
   'd0040000-0000-4000-8000-000000000004', 'd0040000-0000-4000-8000-000000000003', 'd0040000-0000-4000-8000-00000000000d',
   now() + interval '20 days', now() + interval '20 days' + interval '1 hour', 100, 100, 'SCHEDULED', true),
  ('d0040000-0000-4000-8000-000000000103', 'd0040000-0000-4000-8000-000000000001', null,
   'd0040000-0000-4000-8000-000000000004', 'd0040000-0000-4000-8000-000000000003', 'd0040000-0000-4000-8000-00000000000d',
   now() - interval '45 days', now() - interval '45 days' + interval '1 hour', 10, 3, 'SCHEDULED', true);

-- Trois réservations CONFIRMED sur le cours dans la fenêtre, dont deux pointées
-- présentes. (booked_count vaut 7, exprès ≠ 3 : deux sources distinctes.)
insert into public.bookings (id, tenant_id, class_id, membership_id, idempotency_key, status, attended_at) values
  ('d0040000-0000-4000-8000-000000000201', 'd0040000-0000-4000-8000-000000000001', 'd0040000-0000-4000-8000-000000000101', 'd0040000-0000-4000-8000-00000000000a', 'tdash-k1', 'CONFIRMED', now() - interval '3 days' + interval '10 min'),
  ('d0040000-0000-4000-8000-000000000202', 'd0040000-0000-4000-8000-000000000001', 'd0040000-0000-4000-8000-000000000101', 'd0040000-0000-4000-8000-00000000000b', 'tdash-k2', 'CONFIRMED', now() - interval '3 days' + interval '10 min'),
  ('d0040000-0000-4000-8000-000000000203', 'd0040000-0000-4000-8000-000000000001', 'd0040000-0000-4000-8000-000000000101', 'd0040000-0000-4000-8000-00000000000c', 'tdash-k3', 'CONFIRMED', null);

-- Deux abonnements : un qui expire dans 10 j (compté), un dans 100 j (hors
-- fenêtre) — borne le « sous 30 jours ».
-- `ends_on` obéit au CHECK `= starts_on + duration - 1 jour` : on part de l'échéance
-- voulue et on remonte `starts_on`. Un à +10 j (compté), un à +100 j (hors fenêtre).
insert into public.member_subscriptions (tenant_id, membership_id, duration_months, starts_on, ends_on) values
  ('d0040000-0000-4000-8000-000000000001', 'd0040000-0000-4000-8000-00000000000b', 1,
   (current_date + 10 - interval '1 month' + interval '1 day')::date, current_date + 10),
  ('d0040000-0000-4000-8000-000000000001', 'd0040000-0000-4000-8000-00000000000c', 12,
   (current_date + 100 - interval '12 months' + interval '1 day')::date, current_date + 100);

-- ---------------------------------------------------------------------------
-- La forme et les droits d'exécution
-- ---------------------------------------------------------------------------
select has_function('public', 'box_dashboard', array['uuid'], 'box_dashboard(tenant) existe');
select ok(
  has_function_privilege('authenticated', 'public.box_dashboard(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.box_dashboard(uuid)', 'EXECUTE'),
  'exécutable par authenticated, jamais par anon'
);

-- ---------------------------------------------------------------------------
-- Vue OWNER (Marc)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';

select is(
  (public.box_dashboard('d0040000-0000-4000-8000-000000000001') ->> 'members_active')::int,
  2, 'membres actifs = 2 (MEMBER only, OWNER et COACH exclus)'
);
select is(
  ((public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'fill') ->> 'booked')::int,
  7, 'remplissage : réservations = booked_count du cours dans la fenêtre (7)'
);
select is(
  ((public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'fill') ->> 'capacity')::int,
  10, 'remplissage : capacité = 10 — le cours futur (+20 j) est exclu'
);
select is(
  ((public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'fill_prev') ->> 'booked')::int,
  3, 'fenêtre précédente : le cours à −45 j y est (booked 3)'
);
select is(
  ((public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'fill_prev') ->> 'capacity')::int,
  10, 'fenêtre précédente : capacité 10, distincte du courant'
);
select is(
  ((public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'attendance') ->> 'present')::int,
  2, 'présences : deux réservations pointées présentes'
);
select is(
  ((public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'attendance') ->> 'total')::int,
  3, 'présences : dénominateur = 3 réservations confirmées de la fenêtre'
);
select is(
  jsonb_array_length(public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'activity'),
  30, 'activité : 30 jours, trous compris'
);
select is(
  (select coalesce(sum((e ->> 'count')::int), 0)::int
   from jsonb_array_elements(public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'activity') e),
  3, 'activité : 3 réservations sur la fenêtre — celles à −45 j sont hors champ'
);
select is(
  (public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'checklist' ->> 'rooms')::boolean,
  true, 'checklist : une salle → coché'
);
select is(
  (public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'checklist' ->> 'class_types')::boolean,
  true, 'checklist : un type de cours → coché'
);
select is(
  (public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'checklist' ->> 'opening_hours')::boolean,
  false, 'checklist : aucun horaire → décoché'
);
select is(
  (public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'checklist' ->> 'schedules')::boolean,
  false, 'checklist : aucune série au planning → décoché'
);
select is(
  (public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'checklist' ->> 'members')::boolean,
  true, 'checklist : un membre → coché'
);
select is(
  (public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'checklist' ->> 'payment_link')::boolean,
  false, 'checklist : aucun lien de paiement → décoché'
);
select is(
  (public.box_dashboard('d0040000-0000-4000-8000-000000000001') ->> 'subs_expiring')::int,
  1, 'OWNER : un abonnement expire sous 30 j (celui à +100 j est hors fenêtre)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Vue COACH (Sarah, 4444…) : agrégats box-wide oui, expirations non
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"44444444-0000-4000-8000-000000000001","role":"authenticated","email":"sarah@example.com"}';

select ok(
  public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'subs_expiring' = 'null'::jsonb,
  'COACH : les expirations d''abonnement sont masquées (null)'
);
select is(
  (public.box_dashboard('d0040000-0000-4000-8000-000000000001') ->> 'members_active')::int,
  2, 'COACH : obtient tout de même l''agrégat box-wide (2 membres)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Gardes : un MEMBER et un staff d'une autre box sont refoulés
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-0000-4000-8000-000000000001","role":"authenticated","email":"member@example.com"}';
select throws_ok(
  $$ select public.box_dashboard('d0040000-0000-4000-8000-000000000001') $$,
  '42501', null, 'un MEMBER n''accède pas au dashboard'
);
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-0000-4000-8000-000000000001","role":"authenticated","email":"owner-nanterre@example.com"}';
select throws_ok(
  $$ select public.box_dashboard('d0040000-0000-4000-8000-000000000001') $$,
  '42501', null, 'le staff d''une autre box est refoulé (anti-fuite)'
);
reset role;

-- ---------------------------------------------------------------------------
-- La checklist se dérive de l'état RÉEL : supprimer la salle la décoche
-- ---------------------------------------------------------------------------
update public.rooms set deleted_at = now()
where id = 'd0040000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated","email":"marc@rueil.example"}';
select is(
  (public.box_dashboard('d0040000-0000-4000-8000-000000000001') -> 'checklist' ->> 'rooms')::boolean,
  false, 'salle supprimée → checklist décochée (dérivée de l''état, pas d''un flag)'
);
reset role;

select * from finish();
rollback;
