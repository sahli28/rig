-- Conformité, traçabilité et ledger financier.

create type public.consent_purpose as enum (
  'TERMS',            -- CGU de la plateforme
  'PRIVACY',          -- politique de confidentialité
  'BOX_TERMS',        -- CGV de la box
  'PUSH',             -- notifications
  'LEADERBOARD',      -- apparaître dans les classements
  'NETWORK_SHARING',  -- partage minimal avec une box partenaire
  'MARKETING'
);

create type public.ledger_direction as enum ('CREDIT', 'DEBIT');

-- ---------------------------------------------------------------------------
-- consents — table hybride, seule du schéma
-- ---------------------------------------------------------------------------

-- `tenant_id` est **nullable** : un consentement plateforme (CGU Rack, politique
-- de confidentialité) n'appartient à aucune box, un consentement de box en
-- porte une. C'est l'unique exception au `tenant_id not null`, justifiée ici et
-- consignée dans `.claude/rules/database.md`.
create table public.consents (
  id uuid primary key default public.uuid_generate_v7(),
  -- **Volontairement sans clé étrangère vers `users`**, comme
  -- `audit_logs.actor_membership_id` (piège 5 de `.claude/rules/database.md`).
  --
  -- Avec `on delete cascade`, la suppression de compte détruisait la preuve de
  -- consentement que la box est tenue de conserver — tout le durcissement
  -- append-only de cette table ne servait alors à rien, puisque le seul chemin
  -- de suppression restant la détruisait quand même.
  --
  -- L'anonymisation à J+30 (P0-005) réécrira `user_id` vers un pseudonyme ;
  -- elle ne supprimera pas la ligne.
  user_id uuid not null,
  -- La FK vers le tenant, elle, reste : si la box ferme, ses consentements de
  -- box partent avec elle. Les consentements plateforme (`tenant_id is null`)
  -- survivent.
  tenant_id uuid references public.tenants (id) on delete cascade,
  purpose public.consent_purpose not null,
  granted boolean not null,
  policy_version text not null,
  granted_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Pas de colonne `revoked_at`, contrairement à la spec §7.3 : elle imposerait de
-- **modifier** une ligne existante, ce qu'une table append-only interdit. Un
-- retrait de consentement est une **nouvelle ligne** avec `granted = false` ;
-- l'état courant est la dernière ligne par (user, tenant, purpose). C'est aussi
-- ce qui rend l'historique probant : on voit qui a consenti à quoi, quand, et
-- quand il s'est rétracté.

create index consents_user_idx on public.consents (user_id, purpose, granted_at desc);
create index consents_tenant_idx on public.consents (tenant_id, purpose)
  where tenant_id is not null;

-- ---------------------------------------------------------------------------
-- devices — jetons push, attachés à la personne
-- ---------------------------------------------------------------------------

-- Global sans `tenant_id` : un membre inscrit dans deux boxes garde un seul
-- appareil. Le ciblage d'une notification se fait par `memberships`.
create table public.devices (
  id uuid primary key default public.uuid_generate_v7(),
  user_id uuid not null references public.users (id) on delete cascade,
  push_token text not null,
  platform text not null,
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_platform_known check (platform in ('ios', 'android', 'web'))
);

create unique index devices_push_token_key on public.devices (push_token);
create index devices_user_idx on public.devices (user_id);

-- ---------------------------------------------------------------------------
-- audit_logs — qui a fait quoi
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- **Volontairement sans clé étrangère.** Un journal d'audit doit survivre à
  -- la disparition de son auteur : une FK forcerait un `set null` à la
  -- suppression du membre, que le trigger append-only refuserait, bloquant du
  -- même coup la suppression de compte RGPD.
  --
  -- Le risque que la FK composite couvrait ailleurs — attribuer une action à un
  -- membre d'une autre box — n'existe pas ici : la table n'a aucune policy
  -- d'écriture, et `log_audit()` déduit l'acteur de `auth.uid()` après avoir
  -- vérifié son appartenance au tenant.
  actor_membership_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  diff jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index audit_logs_tenant_idx on public.audit_logs (tenant_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_membership_id);

-- ---------------------------------------------------------------------------
-- processed_webhook_events — déduplication Stripe
-- ---------------------------------------------------------------------------

-- Pas de `tenant_id` : la déduplication est globale par identifiant d'événement
-- Stripe, un même événement ne devant être traité qu'une fois quelle que soit la
-- box concernée. Table d'infrastructure, jamais exposée à un client.
create table public.processed_webhook_events (
  event_id text primary key,
  source text not null default 'stripe',
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ledger_entries — source de vérité comptable, append-only
-- ---------------------------------------------------------------------------

create table public.ledger_entries (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  type text not null,
  -- Centimes entiers, jamais de float ni de numeric (règle 5 de CLAUDE.md).
  amount_cents integer not null,
  currency char(3) not null default 'EUR',
  direction public.ledger_direction not null,
  ref_type text,
  ref_id uuid,
  stripe_object_id text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index ledger_entries_tenant_idx on public.ledger_entries (tenant_id, occurred_at desc);
create index ledger_entries_ref_idx on public.ledger_entries (ref_type, ref_id);

-- Append-only : une correction se fait par contre-écriture, jamais par
-- modification. Sans ça, aucun rapprochement avec Stripe n'est défendable —
-- et un journal d'audit modifiable ne prouve rien non plus, d'où l'application
-- du même verrou à `audit_logs`.
create or replace function public.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    '%.% est append-only : % interdit. Émettre une contre-écriture.',
    tg_table_schema, tg_table_name, tg_op
    using errcode = 'restrict_violation';
end;
$$;

create trigger ledger_entries_no_update
  before update on public.ledger_entries
  for each row execute function public.forbid_mutation();

create trigger ledger_entries_no_delete
  before delete on public.ledger_entries
  for each row execute function public.forbid_mutation();

create trigger audit_logs_no_update
  before update on public.audit_logs
  for each row execute function public.forbid_mutation();

create trigger audit_logs_no_delete
  before delete on public.audit_logs
  for each row execute function public.forbid_mutation();

-- `consents` est une preuve légale : une ligne réécrite ne prouve rien.
--
-- Trigger sur l'`UPDATE` **seulement**, volontairement. Contre le `DELETE`, la
-- protection est l'absence de policy : le client ne peut pas supprimer. Ajouter
-- un trigger `before delete` rebloquerait la cascade de la suppression de compte
-- — exactement le piège déjà rencontré avec les clés étrangères composites, où
-- une garde d'intégrité a cassé la conformité RGPD.
create trigger consents_no_update
  before update on public.consents
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Horodatage automatique
-- ---------------------------------------------------------------------------

create trigger devices_set_updated_at before update on public.devices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.consents enable row level security;
alter table public.consents force row level security;
alter table public.devices enable row level security;
alter table public.devices force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
alter table public.processed_webhook_events enable row level security;
alter table public.processed_webhook_events force row level security;
alter table public.ledger_entries enable row level security;
alter table public.ledger_entries force row level security;

-- consents : les siens, qu'ils soient de plateforme ou de box.
-- Lecture et **ajout** de ses propres consentements. Ni `update`, ni `delete` :
-- un membre pouvait sinon effacer ou réécrire la preuve du consentement que sa
-- box est légalement tenue de conserver — la policy d'accountability ci-dessous
-- n'aurait rien protégé, puisqu'elle est en lecture seule côté box.
--
-- Se rétracter reste aussi simple que consentir (`privacy.md`) : c'est une
-- nouvelle ligne avec `granted = false`, pas une suppression.
create policy consents_self_select on public.consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy consents_self_insert on public.consents for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (tenant_id is null or tenant_id in (select public.current_tenant_ids()))
  );

-- Accountability RGPD : la box est responsable de traitement pour ses propres
-- membres et doit pouvoir **prouver** leur consentement. Sans cette policy, elle
-- n'aurait aucun chemin d'accès à cette preuve — et la tentation serait la clé
-- de service, qui donnerait bien plus.
--
-- Strictement borné : uniquement les consentements **portant son tenant_id**.
-- Les consentements plateforme (`tenant_id is null` : CGU Rack, politique de
-- confidentialité) ne la regardent pas et restent invisibles.
create policy consents_box_accountability_select on public.consents for select to authenticated
  using (
    tenant_id is not null
    and tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  );

-- devices : les siens.
create policy devices_self_write on public.devices for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- audit_logs : lecture seule, et seulement pour sa box.
--
-- Aucune policy d'écriture pour `authenticated` : un membre pourrait sinon
-- fabriquer des entrées d'audit dans sa propre box. L'écriture passe par
-- `log_audit()`, plus bas — surtout pas par la clé de service.
create policy audit_logs_tenant_select on public.audit_logs for select to authenticated
  using (tenant_id in (select public.current_tenant_ids()));

-- Seule voie d'écriture dans le journal d'audit.
--
-- Sans elle, `.claude/rules/api.md` (« journaliser toute action sensible »)
-- serait impossible à appliquer sous le rôle `authenticated`, et la sortie de
-- secours évidente serait la clé de service — c'est-à-dire exactement ce que
-- `.claude/rules/database.md` interdit.
--
-- **Aucun paramètre d'acteur** : il est déduit de `auth.uid()`. L'appelant ne
-- peut donc pas attribuer une action à quelqu'un d'autre, ni journaliser dans
-- une box dont il n'est pas membre.
create or replace function public.log_audit(
  p_tenant_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid default null,
  p_diff jsonb default null,
  p_ip inet default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_id uuid;
  v_id uuid;
begin
  select m.id into v_membership_id
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.tenant_id = p_tenant_id
    and m.status = 'ACTIVE'
    and m.left_at is null;

  if v_membership_id is null then
    raise exception 'Journalisation refusée : pas membre actif de cette box.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_logs (tenant_id, actor_membership_id, action, target_type, target_id, diff, ip)
  values (p_tenant_id, v_membership_id, p_action, p_target_type, p_target_id, p_diff, p_ip)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.log_audit(uuid, text, text, uuid, jsonb, inet) is
  'Écrit une entrée d''audit. L''acteur est déduit de auth.uid(), jamais passé en paramètre.';

revoke execute on function public.log_audit(uuid, text, text, uuid, jsonb, inet) from public, anon;
grant execute on function public.log_audit(uuid, text, text, uuid, jsonb, inet) to authenticated;

-- ledger_entries : lecture seule, même raison — et l'écriture d'une ligne
-- comptable par un client serait une faille, pas une fonctionnalité.
create policy ledger_entries_tenant_select on public.ledger_entries for select to authenticated
  using (tenant_id in (select public.current_tenant_ids()));

-- processed_webhook_events : aucune policy, volontairement. RLS forcée sans
-- policy permissive signifie « invisible et intouchable pour `authenticated` ».
