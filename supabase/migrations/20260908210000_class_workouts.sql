-- P1-015 — La séance du cours, écrite par le coach.
--
-- Le premier ticket du projet venu d'un client réel : le coach de la box pilote
-- écrit sa semaine dans un autre outil, et sans ça il le garde pendant tout le
-- pilote.
--
-- ---------------------------------------------------------------------------
-- L'unité est l'occurrence, et c'est le point à ne pas rater
-- ---------------------------------------------------------------------------
--
-- Une journée porte plusieurs séances différentes, une par cours. Un
-- rattachement au couple (date, type de cours) aurait été plus « propre » et
-- **interdirait le geste que le coach décrit** : alléger le nombre de reps du
-- cours du soir modifierait aussi celui du matin.
--
-- La séance se rattache donc à `classes.id`, et le pré-remplissage **copie** au
-- lieu de lier — la duplication *est* la fonctionnalité, pas un défaut à
-- corriger.
--
-- ---------------------------------------------------------------------------
-- Ce qu'on ne modélise pas, et il faut que ce soit écrit ici
-- ---------------------------------------------------------------------------
--
-- Ni blocs, ni formats, ni mouvements, ni variantes. Le coach **tape du texte**
-- et le structure lui-même ; il écrit « Rx » et « Scaled » dans ses lignes.
-- Modéliser tout ça parce que `P2-009` en aura besoin reviendrait à construire
-- le Program Builder déguisé, pour quelqu'un qui n'en veut pas.
--
-- **Ici la structure est de l'affichage, pas de la donnée.** `P2-010` prévoit
-- déjà « l'import depuis un collage de texte » : c'est lui qui absorbera ces
-- séances, pas l'inverse.

-- ---------------------------------------------------------------------------
-- current_staff_tenant_ids() — la sœur qui manquait
-- ---------------------------------------------------------------------------
--
-- `current_admin_tenant_ids()` s'arrête à OWNER et MANAGER. Or **c'est le coach
-- qui écrit la séance**, et il n'est ni l'un ni l'autre.
--
-- Un helper plutôt qu'un prédicat en ligne. **Un seul appelant aujourd'hui** —
-- cette table — et un second déjà nommé : la feuille de cours de `P1-008a`, qui
-- a exactement le même besoin, « le staff qui anime » par opposition à « le
-- staff qui administre ». La règle 7 demande de nommer l'appelant à venir, pas
-- de le compter comme existant.
create or replace function public.current_staff_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.tenant_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.status = 'ACTIVE'
    and m.left_at is null
    and m.role in ('OWNER', 'MANAGER', 'COACH');
$$;

comment on function public.current_staff_tenant_ids() is
  'Boxes où l''utilisateur courant fait partie du staff (OWNER, MANAGER ou COACH). '
  'Sœur de current_admin_tenant_ids() : celle-ci dit « qui anime », l''autre « qui administre ». '
  'Le coach écrit la séance du cours sans administrer la box.';

revoke execute on function public.current_staff_tenant_ids() from public, anon;
grant execute on function public.current_staff_tenant_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- class_workouts
-- ---------------------------------------------------------------------------

create table public.class_workouts (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  class_id uuid not null,
  -- Facultatif : le nom du type de cours sert de défaut à l'affichage. Le coach
  -- veut pouvoir titrer ses séances, il ne veut pas y être obligé.
  title text,
  -- Le texte, tel qu'il l'a tapé. Sauts de ligne compris : c'est sa structure.
  body text not null,
  -- `null` = brouillon. Un brouillon n'existe pas pour un membre — le lire
  -- reviendrait à publier ce que le coach n'a pas publié.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint class_workouts_body_not_blank check (length(btrim(body)) > 0),
  constraint class_workouts_title_length check (title is null or length(title) <= 120),
  -- FK composite : sans elle, une séance de Rueil pourrait pointer une
  -- occurrence de Nanterre (`.claude/rules/database.md`, piège 4).
  constraint class_workouts_class_same_tenant
    foreign key (class_id, tenant_id)
    references public.classes (id, tenant_id) on delete cascade
);

-- **Une séance vivante par occurrence.** Deux, ce seraient deux vérités
-- affichables et aucune règle pour choisir laquelle.
create unique index class_workouts_class_key
  on public.class_workouts (class_id)
  where deleted_at is null;

create index class_workouts_tenant_idx
  on public.class_workouts (tenant_id, class_id)
  where deleted_at is null;

create trigger class_workouts_set_updated_at before update on public.class_workouts
  for each row execute function public.set_updated_at();

alter table public.class_workouts enable row level security;
alter table public.class_workouts force row level security;

-- Lire une séance **publiée** fait partie du droit de tout membre : c'est ce
-- qu'il vient chercher sur la fiche de cours. Le brouillon reste au staff.
--
-- **`deleted_at is null` ne borne que le membre, jamais le staff** — et ce n'est
-- pas une faveur, c'est ce qui rend l'archivage possible. Sur PostgreSQL 17, la
-- ligne mise à jour doit rester visible de celui qui la met à jour : avec la
-- condition sur tout le monde, `update … set deleted_at = now()` sous
-- `authenticated` rendait « new row violates row-level security policy », et
-- effacer sa séance était impossible depuis l'écran (passe du 9 septembre
-- 2026, gestes 7 et 8 ; `database.md`, piège 13). Les lectures du staff
-- filtrent explicitement, comme pour `rooms` et `class_types`.
create policy class_workouts_select on public.class_workouts for select to authenticated
  using (
    (
      tenant_id in (select public.current_tenant_ids())
      and published_at is not null
      and deleted_at is null
    )
    or tenant_id in (select public.current_staff_tenant_ids())
  );

create policy class_workouts_insert on public.class_workouts for insert to authenticated
  with check (tenant_id in (select public.current_staff_tenant_ids()));

create policy class_workouts_update on public.class_workouts for update to authenticated
  using (tenant_id in (select public.current_staff_tenant_ids()))
  with check (tenant_id in (select public.current_staff_tenant_ids()));

-- Les privilèges par défaut ont été retirés à `anon` et `authenticated` (D-006) :
-- sans grant explicite, la table est inaccessible. `tenant_id` et `class_id`
-- restent hors du `grant update` — déplacer une séance d'un cours à l'autre, ou
-- d'une box à l'autre, n'est pas une modification, c'est une autre séance.
grant select on public.class_workouts to authenticated;
grant insert (tenant_id, class_id, title, body, published_at) on public.class_workouts to authenticated;
grant update (title, body, published_at, deleted_at) on public.class_workouts to authenticated;

comment on table public.class_workouts is
  'La séance d''une occurrence de cours, en texte libre structuré par le coach. '
  'Rattachée à l''occurrence et non au couple (date, type) : c''est ce qui permet '
  'd''alléger le cours du soir sans toucher à celui du matin. Le pré-remplissage copie, il ne lie pas.';

-- ---------------------------------------------------------------------------
-- La troisième protection contre la réconciliation de série
-- ---------------------------------------------------------------------------
--
-- `refresh_class_schedule()` archive les occurrences avant de les
-- rematérialiser, en épargnant celles qui sont **réservées** (`booked_count > 0`)
-- ou **dérogatoires** (`is_override`). Une occurrence qui porte une séance
-- n'était ni l'une ni l'autre : le coach écrivait son WOD du jeudi, le gérant
-- corrigeait l'horaire de la série, et le texte disparaissait — sans erreur,
-- sans trace, et il ne s'en apercevait qu'en salle.
--
-- **Pas de `is_override = true` détourné pour ça.** Ce drapeau veut dire « cette
-- occurrence dévie de sa série » ; écrire une séance ne fait dévier ni l'heure
-- ni la capacité. Les confondre ferait qu'un cours cesserait de suivre les
-- corrections d'horaire de sa série dès qu'on lui écrit un WOD — un effet de
-- bord que personne ne devinerait.
--
-- La fonction est remplacée à l'identique, à ce prédicat près.
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
    -- **La troisième protection** (P1-015) — **sauf quand la série elle-même
    -- disparaît.**
    --
    -- Sans le premier terme, supprimer une série laisserait derrière elle
    -- toutes ses occurrences portant une séance : `SCHEDULED`, réservables,
    -- sans série derrière. La protection existe pour qu'une **correction**
    -- d'horaire n'efface pas le travail du coach ; une **suppression** est
    -- l'inverse — c'est le geste qui dit « ce cours n'existe plus ».
    --
    -- `archiveSchedule()` passe par ici après avoir posé le `deleted_at` de la
    -- série : c'est ce qui rend le premier terme vrai au bon moment.
    and (
      s.deleted_at is not null
      or not exists (
        select 1 from public.class_workouts w
        where w.class_id = c.id and w.deleted_at is null
      )
    )
    and (c.starts_at at time zone t.timezone)::date between v_from and p_until;

  perform public.materialize_class_occurrences(v_from, p_until, p_schedule_id);
end;
$$;

revoke all on function public.refresh_class_schedule(uuid, date, date) from public, anon;
grant execute on function public.refresh_class_schedule(uuid, date, date) to authenticated;
