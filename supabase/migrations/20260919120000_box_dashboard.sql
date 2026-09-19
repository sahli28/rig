-- ---------------------------------------------------------------------------
-- P2-004 — `box_dashboard(tenant)` : le snapshot du tableau de bord, en un appel
-- ---------------------------------------------------------------------------
--
-- Un seul aller-retour, un instantané cohérent : les KPI ne peuvent pas se
-- contredire entre eux (ils lisent la même transaction), et la série jour par
-- jour — impossible à agréger proprement via PostgREST — se fait ici.
--
-- **`security definer`, et c'est un choix de correction, pas de confort.** La
-- RLS de `bookings` n'ouvre la lecture *de toute la box* qu'à l'OWNER/MANAGER
-- (`bookings_staff_select`) ; un COACH ne voit que les cours qu'il coache
-- (`bookings_coach_select`). Or le coach a le droit de lire les agrégats
-- *box-wide* (remplissage, présences, activité) — décision P2-004. En invoker,
-- ces chiffres seraient faux pour lui. La fonction contourne donc la RLS, mais
-- se garde elle-même : le paramètre est sûr (`current_tenant_role` filtre sur
-- `auth.uid()`), et un non-staff est refoulé. Les expirations d'abonnement, elles,
-- restent réservées à l'OWNER/MANAGER — gestion d'accès, hors métier coach.
--
-- Fenêtre = les **30 derniers jours écoulés** en heure locale de la box, jamais
-- le futur : un cours à venir se remplit encore, l'inclure afficherait un
-- remplissage « faible » en permanence. Remplissage, présences et activité visent
-- exactement la même fenêtre, plus la fenêtre précédente pour la vraie variation.

create or replace function public.box_dashboard(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.membership_role;
  v_is_admin boolean;
  v_tz text;
  v_today date;
  v_result jsonb;
begin
  v_role := public.current_tenant_role(p_tenant_id);
  if v_role is null or v_role = 'MEMBER' then
    raise exception 'box_dashboard: accès refusé' using errcode = '42501';
  end if;
  v_is_admin := v_role in ('OWNER', 'MANAGER');

  select t.timezone into v_tz from public.tenants t where t.id = p_tenant_id;
  v_tz := coalesce(v_tz, 'Europe/Paris');
  v_today := (now() at time zone v_tz)::date;

  with
  win as (
    select v_today - 29 as cur_start, v_today as cur_end,
           v_today - 59 as prev_start, v_today - 30 as prev_end
  ),
  -- Cours du tenant, avec leur jour local. Une seule lecture, réutilisée.
  cls as (
    select c.id, c.capacity, c.booked_count,
           (c.starts_at at time zone v_tz)::date as day
    from public.classes c
    where c.tenant_id = p_tenant_id
      and c.deleted_at is null
      and c.status = 'SCHEDULED'
  ),
  fill_cur as (
    select coalesce(sum(booked_count), 0)::int as booked, coalesce(sum(capacity), 0)::int as capacity
    from cls, win where cls.day between win.cur_start and win.cur_end
  ),
  fill_prev as (
    select coalesce(sum(booked_count), 0)::int as booked, coalesce(sum(capacity), 0)::int as capacity
    from cls, win where cls.day between win.prev_start and win.prev_end
  ),
  -- Réservations rattachées à leur cours (et à son jour local). CONFIRMED pour le
  -- dénominateur ; `attended_at` non nul = présence pointée par le coach.
  bk as (
    select (c.starts_at at time zone v_tz)::date as day, b.status, b.attended_at
    from public.bookings b
    join public.classes c on c.id = b.class_id
    where c.tenant_id = p_tenant_id and c.deleted_at is null and c.status = 'SCHEDULED'
  ),
  att_cur as (
    select count(*) filter (where attended_at is not null)::int as present,
           count(*) filter (where status = 'CONFIRMED')::int as total
    from bk, win where bk.day between win.cur_start and win.cur_end
  ),
  att_prev as (
    select count(*) filter (where attended_at is not null)::int as present,
           count(*) filter (where status = 'CONFIRMED')::int as total
    from bk, win where bk.day between win.prev_start and win.prev_end
  ),
  -- Activité : réservations confirmées par jour, tous les 30 jours présents même
  -- vides (le graphe ne doit pas avoir de trous).
  days as (
    select generate_series(win.cur_start, win.cur_end, interval '1 day')::date as day from win
  ),
  book_by_day as (
    select bk.day, count(*) filter (where bk.status = 'CONFIRMED')::int as n
    from bk, win where bk.day between win.cur_start and win.cur_end
    group by bk.day
  ),
  activity as (
    select jsonb_agg(
             jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD'), 'count', coalesce(b.n, 0))
             order by d.day
           ) as arr
    from days d left join book_by_day b on b.day = d.day
  ),
  members as (
    select count(*)::int as n
    from public.memberships m
    where m.tenant_id = p_tenant_id and m.role = 'MEMBER'
      and m.status = 'ACTIVE' and m.left_at is null
  ),
  subs as (
    select count(*)::int as n
    from public.member_subscriptions s
    where s.tenant_id = p_tenant_id and s.deleted_at is null
      and s.ends_on between v_today and v_today + 30
  ),
  checklist as (
    select
      exists(select 1 from public.rooms r where r.tenant_id = p_tenant_id and r.deleted_at is null) as rooms,
      exists(select 1 from public.class_types ct where ct.tenant_id = p_tenant_id and ct.deleted_at is null) as class_types,
      exists(select 1 from public.opening_hours oh where oh.tenant_id = p_tenant_id and oh.deleted_at is null) as opening_hours,
      exists(select 1 from public.class_schedules cs where cs.tenant_id = p_tenant_id and cs.deleted_at is null) as schedules,
      exists(select 1 from public.memberships m where m.tenant_id = p_tenant_id and m.role = 'MEMBER' and m.left_at is null) as members,
      exists(select 1 from public.tenant_settings ts where ts.tenant_id = p_tenant_id and ts.payment_link_url is not null) as payment_link
  )
  select jsonb_build_object(
    'members_active', (select n from members),
    'fill', jsonb_build_object('booked', (select booked from fill_cur), 'capacity', (select capacity from fill_cur)),
    'fill_prev', jsonb_build_object('booked', (select booked from fill_prev), 'capacity', (select capacity from fill_prev)),
    'attendance', jsonb_build_object('present', (select present from att_cur), 'total', (select total from att_cur)),
    'attendance_prev', jsonb_build_object('present', (select present from att_prev), 'total', (select total from att_prev)),
    'subs_expiring', case when v_is_admin then (select n from subs) else null end,
    'activity', coalesce((select arr from activity), '[]'::jsonb),
    'checklist', (select to_jsonb(c) from checklist c)
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.box_dashboard(uuid) is
  'Snapshot du tableau de bord d''une box (P2-004) : KPI 30 jours glissants, série d''activité, checklist de mise en route. security definer et gardée par current_tenant_role ; un coach obtient les agrégats box-wide que la RLS de bookings ne lui donnerait pas, mais pas les expirations d''abonnement (OWNER/MANAGER seulement).';

revoke execute on function public.box_dashboard(uuid) from public, anon;
grant execute on function public.box_dashboard(uuid) to authenticated;
