-- Décor de passe manuelle — P1-004, l'annulation.
--
-- **À rejouer après chaque `pnpm db:reset`**, et rejouable autant de fois qu'on
-- veut sans reset : il efface son propre décor avant de le reposer, et il ne
-- touche à rien d'autre que ses quatre cours et ses réservations préfixées
-- `passe-p1-004-`.
--
-- Pourquoi un décor plutôt que « réserver dans l'app puis attendre » : deux des
-- quatre états ne sont **pas atteignables par l'app**, et c'est voulu.
-- `book_class()` refuse un cours à moins de `close_minutes_before` (15 min par
-- défaut) : on ne peut donc pas réserver un cours en cours ni un cours passé.
-- Ces deux réservations-là s'écrivent ici. Les deux autres se prennent **dans
-- l'app**, parce que c'est le chemin qu'on veut exercer.
--
-- Compte visé : Léa (`lea@example.com`), MEMBER de CrossFit Rueil.
--
--     export PATH="$PATH:/c/Users/sahli/AppData/Local/Programs/DockerDesktop/resources/bin"
--     docker exec -i supabase_db_imys psql -U postgres -d postgres \
--       -v ON_ERROR_STOP=1 -f - < supabase/fixtures/passe-p1-004.sql

begin;

-- ---------------------------------------------------------------------------
-- Effacer le décor précédent — le sien, et rien d'autre
-- ---------------------------------------------------------------------------
--
-- Y compris les réservations prises dans l'app sur ces cours : sans ça, rejouer
-- le script sans reset buterait sur l'index unique partiel
-- `(class_id, membership_id) where status = 'CONFIRMED'`, ou laisserait un
-- `booked_count` qui ne correspond plus à rien.

delete from public.bookings
where class_id in (
  'cf000000-0000-4000-8000-000000000001',
  'cf000000-0000-4000-8000-000000000002',
  'cf000000-0000-4000-8000-000000000003',
  'cf000000-0000-4000-8000-000000000004'
);

delete from public.classes
where id in (
  'cf000000-0000-4000-8000-000000000001',
  'cf000000-0000-4000-8000-000000000002',
  'cf000000-0000-4000-8000-000000000003',
  'cf000000-0000-4000-8000-000000000004'
);

-- ---------------------------------------------------------------------------
-- Quatre cours, un par état de l'annulation
-- ---------------------------------------------------------------------------
--
-- Les instants sont relatifs à `now()` et décalés de minutes impaires : la
-- fenêtre par défaut est de 240 minutes, et `classes_schedule_occurrence_key`
-- est unique sur `(schedule_id, starts_at)` — un instant rond risquerait de
-- tomber sur une occurrence du seed.
--
-- Ils sont accrochés à la série `a7000000-…0001` (WOD du soir, Rueil) pour
-- hériter de son type, de sa salle et de son coach. Ils ne suivent pas sa
-- récurrence, et c'est sans conséquence : `classes` porte ses propres instants.

insert into public.classes (
  id, tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
  starts_at, ends_at, capacity, is_override
) values
  -- 1. Demain — **annulation libre** (plus de 240 min avant le début).
  ('cf000000-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   now() + interval '26 hours 7 minutes', now() + interval '27 hours 7 minutes', 8, true),

  -- 2. Dans ~2 h — **annulation tardive** : dans la fenêtre de 240 min, mais
  --    encore réservable (au-delà des 15 min de `close_minutes_before`).
  ('cf000000-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   now() + interval '2 hours 7 minutes', now() + interval '3 hours 7 minutes', 8, true),

  -- 3. Commencé il y a 20 min, se termine dans 40 — **le cas qui a motivé la
  --    règle** : c'est à cette minute-là qu'on sait qu'on n'ira pas.
  ('cf000000-0000-4000-8000-000000000003',
   'aaaaaaaa-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   now() - interval '20 minutes', now() + interval '40 minutes', 8, true),

  -- 4. Hier — le no-show constitué. Même refus, un jour plus tard.
  ('cf000000-0000-4000-8000-000000000004',
   'aaaaaaaa-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001',
   'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'a3000000-0000-4000-8000-000000000003',
   now() - interval '1 day 3 hours 7 minutes', now() - interval '1 day 2 hours 7 minutes', 8, true);

-- ---------------------------------------------------------------------------
-- Les deux réservations que l'app ne peut pas prendre
-- ---------------------------------------------------------------------------
--
-- Cours 1 et 2 : **rien ici**. Léa les réserve dans l'app, parce que c'est le
-- chemin qu'on veut exercer — clé d'idempotence comprise.

insert into public.bookings (
  tenant_id, class_id, membership_id, status, idempotency_key, booked_at
) values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   'cf000000-0000-4000-8000-000000000003',
   'a3000000-0000-4000-8000-000000000002',
   'CONFIRMED', 'passe-p1-004-en-cours', now() - interval '2 days'),
  ('aaaaaaaa-0000-4000-8000-000000000001',
   'cf000000-0000-4000-8000-000000000004',
   'a3000000-0000-4000-8000-000000000002',
   'CONFIRMED', 'passe-p1-004-hier', now() - interval '3 days');

-- `booked_count` est l'invariant que P1-004 protège : le poser à la main ici,
-- c'est reproduire ce que `book_class()` aurait fait si la fenêtre l'avait
-- laissé faire. Un décor qui laisserait 0 ferait mentir l'écran avant même la
-- première manipulation.
update public.classes
set booked_count = 1
where id in (
  'cf000000-0000-4000-8000-000000000003',
  'cf000000-0000-4000-8000-000000000004'
);

commit;

-- ---------------------------------------------------------------------------
-- Ce qu'on doit lire pour savoir que le décor est bon
-- ---------------------------------------------------------------------------

select
  case c.id
    when 'cf000000-0000-4000-8000-000000000001' then '1. demain — annulation libre'
    when 'cf000000-0000-4000-8000-000000000002' then '2. dans 2 h — annulation tardive'
    when 'cf000000-0000-4000-8000-000000000003' then '3. en cours — refus attendu'
    else '4. hier — refus attendu'
  end as scenario,
  to_char(c.starts_at at time zone t.timezone, 'DD/MM HH24:MI') as debut_local,
  c.booked_count,
  coalesce(b.status::text, '— à réserver dans l''app') as reservation_lea
from public.classes c
join public.tenants t on t.id = c.tenant_id
left join public.bookings b
  on b.class_id = c.id
 and b.membership_id = 'a3000000-0000-4000-8000-000000000002'
 and b.status = 'CONFIRMED'
where c.id in (
  'cf000000-0000-4000-8000-000000000001',
  'cf000000-0000-4000-8000-000000000002',
  'cf000000-0000-4000-8000-000000000003',
  'cf000000-0000-4000-8000-000000000004'
)
order by c.starts_at;
