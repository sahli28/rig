-- P2-018 — Abonnement à durée fixe, attribué à la main (RM2.8).
--
-- Décision commanditaire du 16 septembre 2026 : pas d'entité juridique, donc
-- pas de Stripe — le règlement se fait hors app (P2-019) et l'accès s'attribue
-- au back-office, pour 1, 2, 3, 6 ou 12 mois. Ce fichier remplit le corps de
-- `member_has_booking_right()` **à la place de P2-006**, sur le point de
-- couture posé en P1-003 : `book_class()` et `join_waitlist()` l'appellent déjà
-- dans leur transaction, rien n'est recâblé côté réservation.
--
-- Le jour où l'entité existera, P2-006 branchera Stripe sur cette même garde
-- sans jeter ce modèle : un abonnement Stripe deviendra une source de lignes de
-- couverture, la question « couvre-t-il la date du cours ? » ne changera pas.

-- ---------------------------------------------------------------------------
-- La table
-- ---------------------------------------------------------------------------

create table public.member_subscriptions (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  membership_id uuid not null,
  duration_months integer not null
    constraint member_subscriptions_duration_allowed check (duration_months in (1, 2, 3, 6, 12)),
  -- Des `date` en **heure locale de la box** (règle 9 de CLAUDE.md), pas des
  -- timestamptz : la question métier est « ce jour-là, l'accès court-il
  -- encore ? », et un jour de box commence à minuit chez elle. La conversion
  -- instant → date locale se fait au point de comparaison (`at time zone`),
  -- ce qui absorbe les passages d'heure d'été.
  starts_on date not null,
  -- Borne **incluse** : « 1 mois » attribué le 16/09 couvre jusqu'au 15/10, et
  -- l'accès meurt le lendemain de `ends_on`, en heure locale de la box.
  ends_on date not null,
  -- L'invariant vit sur la table, pas seulement dans la fonction qui écrit
  -- (règle des sœurs : un contrôle porté par une fonction ne couvre pas les
  -- chemins qu'on écrira plus tard). `date + interval` est immuable — aucun
  -- fuseau n'entre dans ce calcul, seulement dans le choix de `starts_on`.
  constraint member_subscriptions_ends_on_coherent
    check (ends_on = (starts_on + make_interval(months => duration_months) - interval '1 day')::date),
  -- L'appartenance de l'attribuant. Sans FK, comme `audit_logs.actor_membership_id`
  -- (piège 5 de database.md) : une trace d'attribution qui s'efface ou casse la
  -- suppression de compte RGPD de l'attribuant ne prouve plus rien.
  granted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Le retrait d'un accès sera un archivage (règle 10 : pas de DELETE physique).
  -- Aucun chemin client ne l'écrit aujourd'hui — le bouton de retrait est un
  -- ticket futur ; d'ici là, seul un opérateur SQL peut poser `deleted_at`.
  deleted_at timestamptz,
  -- FK composite (piège 4) : un abonnement de la box A ne peut pas pointer une
  -- appartenance de la box B. `cascade` et non `restrict` : la suppression de
  -- compte RGPD passe par `auth.users` → `users` → `memberships`, et un
  -- abonnement n'est pas une écriture comptable — aucun montant ne vit ici, le
  -- paiement est hors app (P2-019). La trace « un accès a été attribué »
  -- survit, elle, dans `audit_logs`, qui n'a de FK vers personne (piège 5).
  -- `account_deletion_test.sql` exerce cette cascade : tout compte du seed
  -- porte désormais un abonnement.
  constraint member_subscriptions_membership_same_tenant
    foreign key (membership_id, tenant_id)
    references public.memberships (id, tenant_id) on delete cascade
);

create index member_subscriptions_tenant_idx
  on public.member_subscriptions (tenant_id, created_at desc);
-- Le chemin chaud de l'oracle : « ce membre a-t-il une ligne qui couvre cette
-- date ? », appelé à chaque réservation.
create index member_subscriptions_membership_idx
  on public.member_subscriptions (membership_id, ends_on desc);

create trigger member_subscriptions_set_updated_at
  before update on public.member_subscriptions
  for each row execute function public.set_updated_at();

comment on table public.member_subscriptions is
  'Accès à durée fixe attribués à la main (P2-018, RM2.8). Renouvellement = nouvelle ligne, jamais un update. Écrite uniquement par grant_member_subscription().';
comment on column public.member_subscriptions.ends_on is
  'Dernier jour couvert, inclus, en date locale de la box. L''accès meurt le lendemain.';
comment on column public.member_subscriptions.granted_by is
  'Appartenance de l''attribuant. Sans FK : la trace survit à ses acteurs.';

-- ---------------------------------------------------------------------------
-- RLS et droits — le membre lit le sien, l'administration lit sa box,
-- personne n'écrit directement
-- ---------------------------------------------------------------------------

alter table public.member_subscriptions enable row level security;
alter table public.member_subscriptions force row level security;

-- Même forme que `bookings_own_select` : « le sien » = ses appartenances.
create policy member_subscriptions_own_select
  on public.member_subscriptions for select to authenticated
  using (
    membership_id in (
      select m.id from public.memberships m where m.user_id = (select auth.uid())
    )
  );

-- L'accès des membres est une affaire d'administration : OWNER/MANAGER, pas le
-- COACH — le tenant seul ne suffit pas (le rôle entre dans le prédicat,
-- piège 3 de database.md).
create policy member_subscriptions_admin_select
  on public.member_subscriptions for select to authenticated
  using (tenant_id in (select public.current_admin_tenant_ids()));

-- **Aucune policy ni grant d'écriture, et c'est le sujet** (motif `bookings`) :
-- `grant_member_subscription()` est `security definer`, elle n'en a pas besoin,
-- et leur absence garantit qu'aucun autre chemin n'existe.
grant select on public.member_subscriptions to authenticated;

-- ---------------------------------------------------------------------------
-- grant_member_subscription — l'attribution, journalisée, en une transaction
-- ---------------------------------------------------------------------------

create or replace function public.grant_member_subscription(
  p_membership_id uuid,
  p_duration_months integer
)
returns public.member_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_actor_membership_id uuid;
  v_starts date;
  v_row public.member_subscriptions;
begin
  -- La cible doit être dans une box que l'appelant administre. Un COACH, un
  -- MEMBER, ou une appartenance d'une autre box reçoivent la même réponse
  -- qu'un identifiant inexistant : confirmer l'existence serait déjà une
  -- divulgation (même raisonnement que book_class).
  select m.id, m.tenant_id, t.timezone
  into v_target
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.id = p_membership_id
    and m.left_at is null
    and m.tenant_id in (select public.current_admin_tenant_ids());

  if v_target.id is null then
    perform public.app_error(
      'FORBIDDEN_ROLE',
      'Cette appartenance n''existe pas, ou n''est pas administrable.',
      '42501'
    );
  end if;

  select m.id into v_actor_membership_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.tenant_id = v_target.tenant_id
    and m.status = 'ACTIVE' and m.left_at is null;

  -- Début = aujourd'hui, **en date locale de la box** (règle 9). La durée hors
  -- {1,2,3,6,12} et un ends_on incohérent remontent les CHECK de la table.
  v_starts := (now() at time zone v_target.timezone)::date;

  insert into public.member_subscriptions
    (tenant_id, membership_id, duration_months, starts_on, ends_on, granted_by)
  values (
    v_target.tenant_id,
    p_membership_id,
    p_duration_months,
    v_starts,
    (v_starts + make_interval(months => p_duration_months) - interval '1 day')::date,
    v_actor_membership_id
  )
  returning * into v_row;

  -- Journal dans la même transaction (convention P1-001). Aucune donnée
  -- nominative dans le diff.
  perform public.log_audit(
    v_target.tenant_id,
    'subscription.granted',
    'membership',
    p_membership_id,
    jsonb_build_object(
      'subscription_id', v_row.id,
      'membership_id', p_membership_id,
      'duration_months', p_duration_months,
      'starts_on', v_row.starts_on,
      'ends_on', v_row.ends_on
    )
  );

  return v_row;
end;
$$;

comment on function public.grant_member_subscription(uuid, integer) is
  'Attribue un accès à durée fixe (P2-018). OWNER/MANAGER seulement — la garde est dans le corps. Début = aujourd''hui en date locale de la box, fin incluse à + n mois - 1 jour.';

revoke all on function public.grant_member_subscription(uuid, integer) from public, anon;
grant execute on function public.grant_member_subscription(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- L'oracle rempli — l'abonnement couvre la date du cours, en date locale
-- ---------------------------------------------------------------------------

-- `create or replace` préserve l'ACL : le grant retiré par
-- `close_booking_right_oracle` (20260903100000) **reste retiré** — la fonction
-- ne filtre ni sur auth.uid() ni sur le tenant, l'exposer serait rouvrir
-- l'oracle d'existence inter-tenant. Ses seuls appelants sont `book_class()` et
-- `join_waitlist()`, tous deux `security definer`. `booking_test.sql` et
-- `member_subscriptions_test.sql` le vérifient.
create or replace function public.member_has_booking_right(
  p_membership_id uuid,
  p_class_starts_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    join public.member_subscriptions s on s.membership_id = m.id
    where m.id = p_membership_id
      and m.status = 'ACTIVE'
      and m.left_at is null
      and s.deleted_at is null
      -- La frontière est la **date locale de la box** du début du cours, pas la
      -- date UTC : `at time zone` absorbe les passages d'heure d'été, et le
      -- lendemain local de `ends_on` refuse même quand l'UTC est encore dessus.
      and (p_class_starts_at at time zone t.timezone)::date
            between s.starts_on and s.ends_on
  );
$$;

comment on function public.member_has_booking_right(uuid, timestamptz) is
  'Droits de réservation (RM2.8, P2-018) : appartenance active ET un abonnement dont [starts_on, ends_on] couvre la date locale du cours. Appelée uniquement par book_class() et join_waitlist(). Jamais exposée à authenticated : sans filtre sur auth.uid(), elle serait un oracle d''existence inter-tenant. P2-007 y ajoutera le portefeuille de crédits ; P2-006 (Stripe) alimentera la même garde.';
