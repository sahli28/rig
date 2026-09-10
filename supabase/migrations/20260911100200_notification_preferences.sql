-- P1-007 — Les réglages de notification par catégorie.
--
-- « Désactiver une catégorie n'affecte pas les autres » : une ligne par
-- `(appartenance, catégorie)`, jamais un réglage global.
--
-- ---------------------------------------------------------------------------
-- Ni consentement, ni opposition légale : une préférence de livraison
-- ---------------------------------------------------------------------------
--
-- Le consentement `PUSH` vit dans `consents` (opt-in, base légale, versionné,
-- horodaté, IP). L'opposition à la feuille d'inscrits vit sur `memberships`
-- (`hidden_from_roster`, intérêt légitime). **Ceci n'est ni l'un ni l'autre** :
-- une fois le push consenti, choisir de ne plus recevoir *les rappels* mais
-- toujours *les promotions* est un réglage de confort. D'où sa propre table,
-- pas `consents`, pas une colonne sur `memberships`.
--
-- **Opt-out** : l'absence de ligne = activé (le défaut du produit est de
-- prévenir). Une ligne `enabled = false` = désactivé. C'est ce que la sémantique
-- d'éligibilité lit — voir `notification_eligibility`.
--
-- **Par box**, comme le consentement `PUSH` : Julie peut vouloir les rappels de
-- Rueil et pas ceux de Nanterre.
create table public.notification_preferences (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  membership_id uuid not null,
  category public.notification_category not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_membership_same_tenant
    foreign key (membership_id, tenant_id)
    references public.memberships (id, tenant_id) on delete cascade,
  -- Sert l'upsert `on conflict` : une seule ligne par catégorie et appartenance.
  constraint notification_preferences_uniq unique (membership_id, category)
);

create index notification_preferences_tenant_idx
  on public.notification_preferences (tenant_id, membership_id);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;

-- Self-service : le membre lit et écrit **ses** réglages. Policies **par
-- commande** (jamais `for all` sans grant delete — ça casserait le grant⇔policy
-- de `rls_leak_test`, piège 6). Le prédicat d'appartenance est le même aux
-- trois. Pas de delete : basculer `enabled` suffit, donc pas de policy delete,
-- donc grant⇔policy tient.
create policy notification_preferences_self_select on public.notification_preferences
  for select to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and membership_id in (
      select m.id from public.memberships m
      where m.user_id = (select auth.uid()) and m.status = 'ACTIVE' and m.left_at is null
    )
  );

create policy notification_preferences_self_insert on public.notification_preferences
  for insert to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and membership_id in (
      select m.id from public.memberships m
      where m.user_id = (select auth.uid()) and m.status = 'ACTIVE' and m.left_at is null
    )
  );

create policy notification_preferences_self_update on public.notification_preferences
  for update to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and membership_id in (
      select m.id from public.memberships m
      where m.user_id = (select auth.uid()) and m.status = 'ACTIVE' and m.left_at is null
    )
  )
  with check (
    tenant_id in (select public.current_tenant_ids())
    and membership_id in (
      select m.id from public.memberships m
      where m.user_id = (select auth.uid()) and m.status = 'ACTIVE' and m.left_at is null
    )
  );

grant select, insert, update on public.notification_preferences to authenticated;
