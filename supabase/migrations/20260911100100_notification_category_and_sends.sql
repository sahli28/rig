-- P1-007 — Les catégories de notification, et le journal d'envoi.
--
-- ---------------------------------------------------------------------------
-- La catégorie — un enum, et deux classifieurs qui vivent avec lui
-- ---------------------------------------------------------------------------
--
-- Les catégories P1 : rappel de cours J-1, promotion de liste d'attente,
-- annulation de cours. `MARKETING` est P2 (campagnes ciblées, opt-in e-privacy),
-- mais l'enum et le plafond existent dès maintenant pour que le premier envoi
-- marketing trouve un compteur qui marche, pas à construire dans l'urgence.
--
-- `alter type … add value` est additif et **irréversible** — c'est le piège que
-- P1-003c a documenté pour les finalités de consentement. Ici les quatre valeurs
-- couvrent le périmètre connu ; une cinquième s'ajoutera avec son cas d'usage.
create type public.notification_category as enum (
  'CLASS_REMINDER',
  'WAITLIST_PROMOTION',
  'CLASS_CANCELLATION',
  'MARKETING'
);

-- **L'invariant vit avec la catégorie, pas éparpillé sur chaque ligne.** Un
-- drapeau `transactional` par enregistrement pourrait être mal posé à
-- l'insertion ; une fonction immuable ne le peut pas. Extensible en P2 par une
-- ligne.
--
-- Ce qui **compte dans le plafond** : le marketing seul. Le transactionnel
-- (promotion, annulation, rappel) part toujours et ne se compte jamais.
create or replace function public.notification_counts_toward_cap(
  p_category public.notification_category
) returns boolean language sql immutable set search_path = '' as $$
  select p_category = 'MARKETING'
$$;

-- Ce qui **respecte les quiet hours** : tout sauf l'annulation. « L'annulation
-- d'un cours imminent » du périmètre est traitée comme urgente — elle passe la
-- nuit. Invariant défendable : on prévient d'un cours annulé quelle que soit
-- l'heure.
create or replace function public.notification_respects_quiet_hours(
  p_category public.notification_category
) returns boolean language sql immutable set search_path = '' as $$
  select p_category <> 'CLASS_CANCELLATION'
$$;

-- ---------------------------------------------------------------------------
-- Le journal d'envoi — append-only, tenant-scopé
-- ---------------------------------------------------------------------------
--
-- Preuve de ce qui est parti (pour le membre) **et** source du compteur de
-- plafond. `membership_id`, pas `user_id` : une notification part d'une box vers
-- un membre-dans-la-box, et le plafond se compte **par appartenance** — Julie,
-- membre de deux boxes, a deux compteurs. FK composite `(membership_id,
-- tenant_id)` (piège 4 de `database.md`) : une ligne ne référence qu'une
-- appartenance du même tenant.
--
-- **Pas d'`updated_at`** : append-only, jamais modifié, comme `ledger_entries`,
-- `audit_logs`, `consents`.
create table public.notification_sends (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  membership_id uuid not null,
  category public.notification_category not null,
  channel text not null default 'push',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint notification_sends_channel_known check (channel in ('push', 'email')),
  constraint notification_sends_membership_same_tenant
    foreign key (membership_id, tenant_id)
    references public.memberships (id, tenant_id) on delete cascade
);

create index notification_sends_tenant_idx on public.notification_sends (tenant_id, sent_at desc);
-- Sert le compteur de plafond : (appartenance, catégorie, fenêtre).
create index notification_sends_cap_idx on public.notification_sends (membership_id, category, sent_at desc);

-- Append-only via le trigger déjà outillé (`20260830143108:148`, lève
-- `restrict_violation` = 23001). **UPDATE seulement, pas DELETE** — exactement
-- le choix de `consents` (piège 8) : un `before delete` rebloquerait la cascade
-- de la suppression de compte RGPD (appartenance supprimée → sends en cascade).
-- Le DELETE client est fermé par l'absence de grant/policy, pas par un trigger.
create trigger notification_sends_no_update
  before update on public.notification_sends
  for each row execute function public.forbid_mutation();

alter table public.notification_sends enable row level security;
alter table public.notification_sends force row level security;

-- Le membre voit **son** historique. L'écriture est réservée à l'émetteur, qui
-- agit en `service_role` (bypass RLS) : aucune policy ni grant d'écriture, comme
-- `audit_logs`. Le test grant⇔policy de `rls_leak_test` le vérifie : select
-- accordé + policy select ; insert/update/delete ni l'un ni l'autre.
create policy notification_sends_self_select on public.notification_sends
  for select to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and membership_id in (
      select m.id from public.memberships m
      where m.user_id = (select auth.uid()) and m.status = 'ACTIVE' and m.left_at is null
    )
  );

grant select on public.notification_sends to authenticated;

-- ---------------------------------------------------------------------------
-- Le compteur du plafond marketing — fenêtre glissante de 7 jours
-- ---------------------------------------------------------------------------
--
-- `security definer` et révoquée de tous les rôles applicatifs : elle lit la
-- consommation d'un membre, ce serait un oracle si un client pouvait l'appeler
-- sur l'appartenance d'autrui. L'émetteur (service_role) et les tests (postgres)
-- l'appellent.
create or replace function public.notification_marketing_count_7d(
  p_membership_id uuid,
  p_now timestamptz default now()
) returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.notification_sends s
  where s.membership_id = p_membership_id
    and s.category = 'MARKETING'
    and s.channel = 'push'
    and s.sent_at > p_now - interval '7 days';
$$;

revoke execute on function public.notification_marketing_count_7d(uuid, timestamptz)
  from public, anon, authenticated;
