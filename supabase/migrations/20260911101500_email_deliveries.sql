-- P1-018 — L'émetteur d'invitations : la table de journal/file, et ses RPC.
--
-- `import_members` crée des invitations PENDING **sans jeton** ; l'émetteur leur
-- envoie un e-mail « connectez-vous avec cette adresse » via l'API Brevo, et cette
-- table en tient le **journal** et l'**idempotence** (jamais deux fois).
--
-- Différence avec `push_outbox`, et elle décide la forme : ici l'émetteur est une
-- **action back-office** jouée sous l'identité `authenticated` d'un OWNER/MANAGER,
-- pas un edge function en `service_role`. Donc (1) la table est **visible de la
-- box** — policy select + grant, comme une table métier, pour qu'elle repère les
-- adresses mortes ; (2) les RPC d'écriture sont `security definer` **granted to
-- authenticated** et **autorisent** (`current_admin_tenant_ids`), au lieu d'être
-- réservées à `service_role`.
--
-- Table **mutable** (`sending` -> `sent` | `failed`), pas append-only : on réserve
-- avant d'envoyer, on marque après. D'où `updated_at` + `set_updated_at`, et pas de
-- `forbid_mutation`. « Réserver avant » est ce qui tient « jamais deux fois » sur
-- une coupure à mi-parcours : la ligne `sending` fait sauter l'invitation au
-- ré-lancement.

-- `invitations` doit être référençable par FK composite (piège 4 de database.md).
-- Ajouté ici, **au premier référencement** — même geste que `classes`, `rooms`,
-- `class_types` (chacune a reçu son `_id_tenant_key` quand une FK est arrivée).
alter table public.invitations
  add constraint invitations_id_tenant_key unique (id, tenant_id);

create table public.email_deliveries (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invitation_id uuid not null,
  -- La **seule** PII : l'adresse. Jamais le corps, jamais une donnée de santé
  -- (.claude/rules/privacy.md) — un journal d'envois n'est pas une copie de la boîte.
  email text not null,
  -- sending -> (mark) -> sent | failed. Un CHECK, pas un enum (comme push_outbox) :
  -- les états d'un envoi changent plus vite qu'un type partagé, et
  -- `alter type add value` est irréversible.
  status text not null default 'sending',
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint email_deliveries_status_known check (status in ('sending', 'sent', 'failed')),
  -- FK composite (piège 4) : une ligne ne référence qu'une invitation du **même**
  -- tenant. Ferme la substitution invitation/tenant indépendamment de toute policy.
  constraint email_deliveries_invitation_same_tenant
    foreign key (invitation_id, tenant_id)
    references public.invitations (id, tenant_id) on delete cascade
);

create index email_deliveries_tenant_idx on public.email_deliveries (tenant_id, created_at desc);
-- Sert la fenêtre d'idempotence : « cette invitation a-t-elle un envoi récent ? »
create index email_deliveries_invitation_idx on public.email_deliveries (invitation_id, created_at desc);

create trigger email_deliveries_set_updated_at before update on public.email_deliveries
  for each row execute function public.set_updated_at();

comment on table public.email_deliveries is
  'Journal/file des e-mails d''invitation du pilote (P1-018). Mutable : sending -> sent | failed. Écrite par claim/mark (security definer, autorisées OWNER/MANAGER), lisible par la box (OWNER/MANAGER). L''adresse seule, jamais de corps.';

alter table public.email_deliveries enable row level security;
alter table public.email_deliveries force row level security;

-- La box voit ses envois — pour repérer les adresses mortes (FAILED) et relancer.
-- OWNER/MANAGER seuls, miroir exact d'`invitations_select` : l'effectif et ses
-- adresses relèvent de la responsabilité de traitement de la box.
create policy email_deliveries_admin_select on public.email_deliveries
  for select to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  );

grant select on public.email_deliveries to authenticated;
-- Aucun grant insert/update/delete : les écritures passent par les RPC ci-dessous.

-- ---------------------------------------------------------------------------
-- claim_invitations_to_email — réserve un lot d'invitations à mailer
-- ---------------------------------------------------------------------------
-- Autorise l'appelant (OWNER/MANAGER du tenant), sélectionne les invitations
-- PENDING **nominatives et vives** sans envoi récent (fenêtre `p_within` — unifie
-- envoi initial, relance et vagues), insère une ligne `sending` par retenue, et
-- rend le lot à mailer. `for update skip locked` sur les invitations : deux
-- lancements concurrents ne réservent jamais la même (et une invitation en cours
-- d'acceptation est sautée).
create or replace function public.claim_invitations_to_email(
  p_tenant_id uuid,
  p_limit integer default 40,
  p_within interval default interval '24 hours'
)
returns table (
  delivery_id uuid,
  invitation_id uuid,
  email text,
  first_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tenant_id not in (select public.current_admin_tenant_ids()) then
    perform public.app_error('FORBIDDEN_ROLE',
      'Réservé aux propriétaires et gestionnaires.', '42501');
  end if;

  return query
  with candidates as (
    select i.id, i.email::text as email, i.first_name
    from public.invitations i
    where i.tenant_id = p_tenant_id
      and i.status = 'PENDING'
      and i.email is not null
      and i.expires_at > now()
      and not exists (
        select 1 from public.email_deliveries d
        where d.invitation_id = i.id and d.created_at > now() - p_within
      )
    order by i.created_at
    limit p_limit
    for update skip locked
  ),
  reserved as (
    insert into public.email_deliveries (tenant_id, invitation_id, email, status)
    select p_tenant_id, c.id, c.email, 'sending'
    from candidates c
    returning email_deliveries.id, email_deliveries.invitation_id, email_deliveries.email
  )
  select r.id, r.invitation_id, r.email, c.first_name
  from reserved r
  join candidates c on c.id = r.invitation_id;
end;
$$;

comment on function public.claim_invitations_to_email(uuid, integer, interval) is
  'Réserve un lot d''invitations PENDING nominatives et vives sans envoi récent (fenêtre p_within), insère une ligne email_deliveries sending par retenue, rend le lot à mailer. security definer, autorise OWNER/MANAGER.';

-- ---------------------------------------------------------------------------
-- mark_email_delivery — l'envoi Brevo terminé passe la ligne à sent | failed
-- ---------------------------------------------------------------------------
-- `where status = 'sending'` : idempotent (un second appel ne trouve rien, comme
-- `mark_push_sent`). Autorise sur le tenant de la ligne, dans le `where` : un
-- appelant non-admin n'affecte aucune ligne (la valeur inchangée prouve la garde).
create or replace function public.mark_email_delivery(
  p_delivery_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'mark_email_delivery: statut cible invalide %', p_status
      using errcode = '22023';
  end if;

  update public.email_deliveries d
  set status = p_status,
      provider_message_id = p_provider_message_id,
      last_error = p_error,
      sent_at = case when p_status = 'sent' then now() else null end
  where d.id = p_delivery_id
    and d.status = 'sending'
    and d.tenant_id in (select public.current_admin_tenant_ids());
end;
$$;

comment on function public.mark_email_delivery(uuid, text, text, text) is
  'Passe une ligne email_deliveries sending à sent | failed. Idempotent par le garde status = sending. security definer, autorise OWNER/MANAGER dans le where.';

revoke all on function public.claim_invitations_to_email(uuid, integer, interval) from public, anon;
grant execute on function public.claim_invitations_to_email(uuid, integer, interval) to authenticated;
revoke all on function public.mark_email_delivery(uuid, text, text, text) from public, anon;
grant execute on function public.mark_email_delivery(uuid, text, text, text) to authenticated;
