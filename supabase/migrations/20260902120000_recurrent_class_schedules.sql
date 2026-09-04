-- P1-002 — Planning récurrent.
--
-- Une série reste une règle locale (jour + heure dans le fuseau de la box) ;
-- `classes` est le fait daté, en UTC, que P1-003 réservera transactionnellement.
-- Ne jamais dériver une occurrence dans le navigateur : réservation, waitlist,
-- check-in et programmation doivent tous lire exactement la même ligne.

-- `rooms` précédait les FK composites. Cette clé est requise pour empêcher une
-- série de la box A de pointer une salle de la box B.
alter table public.rooms
  add constraint rooms_id_tenant_key unique (id, tenant_id);

create type public.class_status as enum ('SCHEDULED', 'CANCELLED');

-- ---------------------------------------------------------------------------
-- RRULE pilote : une grammaire délibérément petite et exacte
-- ---------------------------------------------------------------------------
--
-- PostgreSQL ne contient pas de parseur RFC 5545, et le job pg_cron ne peut pas
-- exécuter une bibliothèque TypeScript. Le pilote accepte donc uniquement la
-- forme canonique produite par l'UI :
--
--   FREQ=WEEKLY[;INTERVAL=1..52];BYDAY=MO[,TU...][;UNTIL=YYYYMMDD]
--
-- Rejeter est essentiel : interpréter `COUNT`, `MONTHLY` ou `BYHOUR` comme une
-- approximation ferait tenir un cours à une heure que la box n'a jamais choisie.
create or replace function public.pilot_weekly_rrule_valid(p_rrule text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_days text[];
  v_until text;
begin
  if p_rrule is null
     or p_rrule !~ '^FREQ=WEEKLY(;INTERVAL=([1-9]|[1-4][0-9]|5[0-2]))?;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*(;UNTIL=[0-9]{8})?$' then
    return false;
  end if;

  v_days := string_to_array((regexp_match(p_rrule, 'BYDAY=([^;]+)'))[1], ',');
  if cardinality(v_days) <> (select count(distinct day_code) from unnest(v_days) as day_code) then
    return false;
  end if;

  v_until := (regexp_match(p_rrule, 'UNTIL=([0-9]{8})'))[1];
  if v_until is not null then
    begin
      return to_char(to_date(v_until, 'YYYYMMDD'), 'YYYYMMDD') = v_until;
    exception when others then
      return false;
    end;
  end if;

  return true;
end;
$$;

create or replace function public.pilot_weekly_rrule_days(p_rrule text)
returns integer[]
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_code text;
  v_days integer[] := '{}';
begin
  -- L'appelant a déjà passé la contrainte `pilot_weekly_rrule_valid`.
  foreach v_code in array string_to_array((regexp_match(p_rrule, 'BYDAY=([^;]+)'))[1], ',') loop
    v_days := array_append(v_days, case v_code
      when 'MO' then 1 when 'TU' then 2 when 'WE' then 3 when 'TH' then 4
      when 'FR' then 5 when 'SA' then 6 when 'SU' then 7
    end);
  end loop;
  return v_days;
end;
$$;

create or replace function public.pilot_weekly_rrule_interval(p_rrule text)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select coalesce(((regexp_match(p_rrule, 'INTERVAL=([0-9]+)'))[1])::integer, 1);
$$;

create or replace function public.pilot_weekly_rrule_until(p_rrule text)
returns date
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_match text[];
begin
  v_match := regexp_match(p_rrule, 'UNTIL=([0-9]{8})');
  if v_match is null then return null; end if;
  return to_date(v_match[1], 'YYYYMMDD');
end;
$$;

revoke all on function public.pilot_weekly_rrule_valid(text) from public, anon;
revoke all on function public.pilot_weekly_rrule_days(text) from public, anon;
revoke all on function public.pilot_weekly_rrule_interval(text) from public, anon;
revoke all on function public.pilot_weekly_rrule_until(text) from public, anon;
grant execute on function public.pilot_weekly_rrule_valid(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Séries et occurrences matérialisées
-- ---------------------------------------------------------------------------
create table public.class_schedules (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  class_type_id uuid not null,
  room_id uuid not null,
  coach_membership_id uuid not null,
  -- Ces deux champs sont locaux à la box. `starts_at` dans `classes` est la
  -- conversion UTC de leur combinaison, et non l'inverse : ainsi l'heure reste
  -- 18h30 pour la box après le passage à l'heure d'hiver.
  starts_on date not null,
  starts_at_local time not null,
  rrule text not null,
  capacity integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint class_schedules_capacity_positive check (capacity > 0),
  constraint class_schedules_rrule_pilot check (public.pilot_weekly_rrule_valid(rrule)),
  constraint class_schedules_until_after_start check (
    public.pilot_weekly_rrule_until(rrule) is null
    or public.pilot_weekly_rrule_until(rrule) >= starts_on
  ),
  constraint class_schedules_type_same_tenant
    foreign key (class_type_id, tenant_id)
    references public.class_types (id, tenant_id) on delete restrict,
  constraint class_schedules_room_same_tenant
    foreign key (room_id, tenant_id)
    references public.rooms (id, tenant_id) on delete restrict,
  constraint class_schedules_coach_same_tenant
    foreign key (coach_membership_id, tenant_id)
    references public.memberships (id, tenant_id) on delete restrict
);

create index class_schedules_tenant_idx on public.class_schedules (tenant_id, starts_on)
  where deleted_at is null;
alter table public.class_schedules
  add constraint class_schedules_id_tenant_key unique (id, tenant_id);
create trigger class_schedules_set_updated_at before update on public.class_schedules
  for each row execute function public.set_updated_at();

create table public.classes (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  schedule_id uuid not null,
  class_type_id uuid not null,
  room_id uuid not null,
  coach_membership_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null,
  -- P1-003 modifie ce compteur sous `select … for update`, dans la même
  -- transaction que la réservation. Il existe maintenant pour que le modèle ne
  -- doive jamais être cassé à l'arrivée des réservations.
  booked_count integer not null default 0,
  status public.class_status not null default 'SCHEDULED',
  -- Une annulation, un coach remplacé ou une capacité modifiée sur une séance
  -- est une exception : le rafraîchissement de série ne doit jamais l'écraser.
  is_override boolean not null default false,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint classes_ends_after_starts check (ends_at > starts_at),
  constraint classes_capacity_positive check (capacity > 0),
  constraint classes_booked_within_capacity check (booked_count between 0 and capacity),
  constraint classes_schedule_same_tenant
    foreign key (schedule_id, tenant_id)
    references public.class_schedules (id, tenant_id) on delete restrict,
  constraint classes_type_same_tenant
    foreign key (class_type_id, tenant_id)
    references public.class_types (id, tenant_id) on delete restrict,
  constraint classes_room_same_tenant
    foreign key (room_id, tenant_id)
    references public.rooms (id, tenant_id) on delete restrict,
  constraint classes_coach_same_tenant
    foreign key (coach_membership_id, tenant_id)
    references public.memberships (id, tenant_id) on delete restrict
);

create index classes_tenant_starts_idx on public.classes (tenant_id, starts_at)
  where deleted_at is null;
create unique index classes_schedule_occurrence_key
  on public.classes (schedule_id, starts_at)
  where deleted_at is null;
create trigger classes_set_updated_at before update on public.classes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Matérialisation et réconciliation
-- ---------------------------------------------------------------------------
-- `p_schedule_id` borne le balayage à **une** série. Il n'est pas un confort de
-- performance : sans lui, `refresh_class_schedule()` — appelable par n'importe
-- quel authenticated — matérialisait les séries de **toutes les boxes**, parce
-- que cette fonction est `security definer` et que son propriétaire `postgres`
-- porte `rolbypassrls`. Aucune fuite en lecture (`classes_select` tient), mais
-- une écriture inter-tenant déclenchée par un appelant sans droits chez l'autre,
-- contre le garde-fou n°5 de l'ADR 0002.
--
-- Onzième cas de la « règle des sœurs » (`.claude/rules/database.md`) : l'étape
-- d'archivage de `refresh_class_schedule()` était bornée à une série, sa jumelle
-- — la re-matérialisation — ne l'était pas. Le job nocturne passe `null` et
-- garde le balayage global, qui est légitime pour lui.
create or replace function public.materialize_class_occurrences(
  p_from date,
  p_until date,
  p_schedule_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  if p_from is null or p_until is null or p_until < p_from then
    raise exception 'invalid materialization horizon' using errcode = '22007';
  end if;

  with desired as (
    select
      s.id as schedule_id,
      s.tenant_id,
      s.class_type_id,
      s.room_id,
      s.coach_membership_id,
      ((occurrence.day::date + s.starts_at_local) at time zone t.timezone) as starts_at,
      ((occurrence.day::date + s.starts_at_local) at time zone t.timezone)
        + make_interval(mins => ct.duration_minutes) as ends_at,
      s.capacity
    from public.class_schedules s
    join public.tenants t on t.id = s.tenant_id and t.deleted_at is null
    join public.class_types ct
      on (ct.id, ct.tenant_id) = (s.class_type_id, s.tenant_id)
      and ct.deleted_at is null
    join public.rooms r
      on (r.id, r.tenant_id) = (s.room_id, s.tenant_id)
      and r.deleted_at is null
    cross join lateral generate_series(
      greatest(s.starts_on, p_from)::timestamp,
      least(p_until, coalesce(public.pilot_weekly_rrule_until(s.rrule), p_until))::timestamp,
      interval '1 day'
    ) as occurrence(day)
    where s.deleted_at is null
      and (p_schedule_id is null or s.id = p_schedule_id)
      and extract(isodow from occurrence.day)::integer = any (public.pilot_weekly_rrule_days(s.rrule))
      -- Les semaines se comptent depuis le **lundi** de la semaine de
      -- `starts_on`, pas depuis `starts_on` lui-même. Une division du nombre de
      -- jours par 7 décale tout d'une semaine dès que `starts_on` n'est pas un
      -- jour de `BYDAY` : une série démarrée un mercredi en
      -- `INTERVAL=2;BYDAY=MO` tombait les lundis 26/10, 09/11, 23/11 là où la
      -- RFC 5545 (WKST=MO par défaut) donne 02/11, 16/11, 30/11. Sans effet à
      -- `INTERVAL=1`, donc invisible sur le cas courant — et c'est bien ce qui
      -- le rendait dangereux.
      and ((
        (date_trunc('week', occurrence.day)::date
         - date_trunc('week', s.starts_on::timestamp)::date) / 7
      ) % public.pilot_weekly_rrule_interval(s.rrule)) = 0
  )
  insert into public.classes (
    tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
    starts_at, ends_at, capacity
  )
  select
    tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
    starts_at, ends_at, capacity
  from desired
  on conflict (schedule_id, starts_at) where deleted_at is null do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- Cette fonction est l'appelant transactionnel de la modification d'une série.
-- Une action web l'appelle après avoir validé le formulaire ; elle préserve les
-- cours réservés et les exceptions, archive les occurrences devenues obsolètes,
-- puis complète l'horizon avec les nouvelles occurrences.
create or replace function public.refresh_class_schedule(
  p_schedule_id uuid,
  p_from date,
  p_until date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_from date;
begin
  if p_from is null or p_until is null or p_until < p_from then
    raise exception 'invalid refresh horizon' using errcode = '22007';
  end if;

  select tenant_id into strict v_tenant_id
  from public.class_schedules
  where id = p_schedule_id;

  if not exists (
    select 1
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.tenant_id = v_tenant_id
      and m.status = 'ACTIVE'
      and m.left_at is null
      and m.role in ('OWNER', 'MANAGER')
  ) then
    raise exception 'not allowed to refresh this schedule' using errcode = '42501';
  end if;

  -- Un appelant ne peut jamais faire réécrire le passé en choisissant un p_from
  -- ancien. Les réservations et l'historique gardent leur fait daté.
  v_from := greatest(p_from, current_date);
  if p_until < v_from then return; end if;

  -- Les occurrences modifiables ne portent encore ni réservation ni exception.
  -- Les archiver toutes, puis les recréer depuis la règle courante, est plus sûr
  -- que d'essayer de dériver « ce qui a changé » : une seule branche oubliée
  -- laisserait une occurrence qui ne correspond plus à la série. Les identifiants
  -- de cours réservés et d'exceptions sont, eux, intouchables.
  --
  -- L'archive est volontaire : règle 10. Une ligne supprimée physiquement ne
  -- laisserait plus de trace si une série était rétablie, et un DELETE pourrait
  -- casser plus tard une réservation ajoutée par P1-003.
  update public.classes c
  set deleted_at = now()
  from public.class_schedules s
  join public.tenants t on t.id = s.tenant_id
  where c.schedule_id = s.id
    and s.id = p_schedule_id
    and c.deleted_at is null
    and c.status = 'SCHEDULED'
    and c.is_override = false
    and c.booked_count = 0
    and (c.starts_at at time zone t.timezone)::date between v_from and p_until;

  perform public.materialize_class_occurrences(v_from, p_until, p_schedule_id);
end;
$$;

-- L'horizon ne croît jamais sans borne : on archive les séances terminées sans
-- réservation après huit semaines. Une séance réservée reste l'historique de la
-- box ; P1-003 fera augmenter `booked_count` dans sa transaction.
create or replace function public.maintain_class_occurrences()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `null` : le job de fond est le **seul** appelant légitimement global.
  perform public.materialize_class_occurrences(current_date, current_date + 56, null);

  update public.classes
  set deleted_at = now()
  where deleted_at is null
    and status = 'SCHEDULED'
    and booked_count = 0
    and ends_at < ((current_date - 56)::timestamp at time zone 'UTC');
end;
$$;

revoke all on function public.materialize_class_occurrences(date, date, uuid) from public, anon, authenticated;
revoke all on function public.maintain_class_occurrences() from public, anon, authenticated;
revoke all on function public.refresh_class_schedule(uuid, date, date) from public, anon;
grant execute on function public.refresh_class_schedule(uuid, date, date) to authenticated;

-- `pg_cron` est le premier job de fond du produit. Il exécute seulement une
-- fonction SQL idempotente ; aucune logique de calendrier ne vit dans un
-- processus Node qui peut s'arrêter entre deux déploiements.
create extension if not exists pg_cron;
select cron.schedule(
  'rack-maintain-class-occurrences',
  '5 0 * * *',
  $$select public.maintain_class_occurrences();$$
);

-- ---------------------------------------------------------------------------
-- RLS et droits de table
-- ---------------------------------------------------------------------------
alter table public.class_schedules enable row level security;
alter table public.class_schedules force row level security;
alter table public.classes enable row level security;
alter table public.classes force row level security;

-- Lire un planning fait partie du droit de tout membre. Construire ou modifier
-- une série est opérationnel, donc OWNER/MANAGER comme class_types et salles.
create policy class_schedules_select on public.class_schedules for select to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and deleted_at is null
  );
create policy class_schedules_insert on public.class_schedules for insert to authenticated
  with check (tenant_id in (select public.current_admin_tenant_ids()));
create policy class_schedules_update on public.class_schedules for update to authenticated
  using (tenant_id in (select public.current_admin_tenant_ids()))
  with check (tenant_id in (select public.current_admin_tenant_ids()));

create policy classes_select on public.classes for select to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and deleted_at is null
  );
create policy classes_insert on public.classes for insert to authenticated
  with check (tenant_id in (select public.current_admin_tenant_ids()));
create policy classes_update on public.classes for update to authenticated
  using (tenant_id in (select public.current_admin_tenant_ids()))
  with check (tenant_id in (select public.current_admin_tenant_ids()));

grant select, insert, update on public.class_schedules to authenticated;
grant select on public.classes to authenticated;
grant insert (
  tenant_id, schedule_id, class_type_id, room_id, coach_membership_id,
  starts_at, ends_at, capacity, status, is_override, cancellation_reason
) on public.classes to authenticated;
grant update (
  class_type_id, room_id, coach_membership_id, starts_at, ends_at, capacity,
  status, is_override, cancellation_reason, deleted_at
) on public.classes to authenticated;

comment on table public.class_schedules is
  'Série hebdomadaire tenant-scopée. RRULE pilote strictement bornée ; l''heure reste locale à la box.';
comment on table public.classes is
  'Occurrence matérialisée en UTC. P1-003 réservera cette ligne sous verrou et modifiera booked_count.';
