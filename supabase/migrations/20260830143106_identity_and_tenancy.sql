-- Identité et tenancy : le socle multi-tenant.
--
-- Modèle : une **personne** est globale (`users`, adossée à `auth.users`), une
-- **appartenance** la relie à une box (`memberships`). S'inscrire dans une
-- deuxième box ne crée pas un second compte.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.tenant_status as enum ('ACTIVE', 'SUSPENDED', 'CLOSED');
create type public.membership_role as enum ('OWNER', 'MANAGER', 'COACH', 'MEMBER');
-- Trois façons de ne plus être actif, qui n'ont pas les mêmes conséquences :
--   LEFT      — départ volontaire. Peut revenir par n'importe quelle invitation.
--   REMOVED   — exclu par la box. Ne revient que sur invitation **nominative**,
--               c'est-à-dire un geste délibéré d'un OWNER ou d'un MANAGER.
--   SUSPENDED — sanction en cours. Ne revient par aucune invitation.
-- Confondre LEFT et REMOVED viderait `remove_member()` de tout effet : il
-- suffirait de scanner le QR affiché au mur de la box pour annuler son exclusion.
create type public.membership_status as enum ('ACTIVE', 'SUSPENDED', 'LEFT', 'REMOVED');
create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- ---------------------------------------------------------------------------
-- tenants — la box elle-même
-- ---------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default public.uuid_generate_v7(),
  slug text not null,
  name text not null,
  country char(2) not null default 'FR',
  -- Fuseau de la box : toutes les règles métier (fenêtre d'annulation) et tous
  -- les affichages d'heure s'y réfèrent, jamais au fuseau de l'appareil.
  timezone text not null default 'Europe/Paris',
  currency char(3) not null default 'EUR',
  status public.tenant_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tenants_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create unique index tenants_slug_key on public.tenants (slug) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- users — la personne, globale par construction
-- ---------------------------------------------------------------------------

-- `id` référence `auth.users` pour que `auth.uid()` soit directement exploitable
-- dans les policies. Conséquence assumée : cet identifiant est un UUID v4 imposé
-- par Supabase Auth, là où toutes les autres tables utilisent un v7.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext not null,
  first_name text,
  last_name text,
  birthdate date,
  gender text,
  locale text not null default 'fr',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint users_locale_supported check (locale in ('fr', 'en'))
);

create unique index users_email_key on public.users (email) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- memberships — le lien personne ↔ box, et la source de toute autorisation
-- ---------------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.membership_role not null default 'MEMBER',
  status public.membership_status not null default 'ACTIVE',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index memberships_tenant_user_key on public.memberships (tenant_id, user_id);
-- Cible des clés étrangères composites : elles imposent qu'une référence
-- pointe une ligne du **même** tenant (cf. `audit_logs`, `invitations`).
alter table public.memberships add constraint memberships_id_tenant_key unique (id, tenant_id);
-- Index de service du prédicat RLS : il est parcouru à chaque requête.
create index memberships_user_active_idx on public.memberships (user_id, tenant_id)
  where status = 'ACTIVE' and left_at is null;

-- ---------------------------------------------------------------------------
-- current_tenant_ids() — le prédicat d'isolation
-- ---------------------------------------------------------------------------

-- Dérive les droits de l'identité portée par le JWT (`auth.uid()`) et de rien
-- d'autre : aucun `tenant_id` transmis par un client n'accorde d'accès (ADR 0002).
--
-- `stable` : Postgres met le résultat en cache d'initplan au lieu de le
-- réévaluer ligne à ligne.
--
-- `security definer` est **obligatoire ici**, pas une facilité. La policy de
-- `memberships` appelle cette fonction, qui lit `memberships` : en
-- `security invoker` elle serait soumise à cette même policy, qui la rappellerait
-- — `infinite recursion detected in policy for relation "memberships"`.
--
-- Ce qui rend le `security definer` sûr : la fonction **ne prend aucun
-- paramètre** et filtre sur `auth.uid()`. Elle ne peut structurellement retourner
-- que les tenants de son appelant. Lui ajouter un paramètre en ferait une faille.
create or replace function public.current_tenant_ids()
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
    and m.left_at is null;
$$;

comment on function public.current_tenant_ids() is
  'Tenants où l''utilisateur courant a une appartenance active. Base de toutes les policies RLS. SECURITY DEFINER pour briser la récursion sur memberships ; sûre car sans paramètre.';

revoke execute on function public.current_tenant_ids() from public, anon;
grant execute on function public.current_tenant_ids() to authenticated;

-- Rôle de l'appelant dans une box donnée.
--
-- `memberships` étant la table qui *porte* l'autorisation, la laisser modifiable
-- par n'importe quel membre viderait tout le modèle de son sens : un MEMBER
-- pourrait se promouvoir OWNER. Le rôle entre donc dans le prédicat des tables
-- sensibles, et pas seulement dans l'API.
--
-- `security definer` pour la même raison que `current_tenant_ids()` : appelée
-- depuis une policy de `memberships`, elle serait sinon récursive.
create or replace function public.current_tenant_role(p_tenant_id uuid)
returns public.membership_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  where m.user_id = (select auth.uid())
    and m.tenant_id = p_tenant_id
    and m.status = 'ACTIVE'
    and m.left_at is null;
$$;

comment on function public.current_tenant_role(uuid) is
  'Rôle de l''appelant dans une box. Le paramètre est sans risque : la fonction filtre toujours sur auth.uid().';

revoke execute on function public.current_tenant_role(uuid) from public, anon;
grant execute on function public.current_tenant_role(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tables rattachées au tenant
-- ---------------------------------------------------------------------------

create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  open_days_before integer not null default 7,
  close_minutes_before integer not null default 15,
  cancel_window_minutes integer not null default 240,
  max_upcoming_bookings integer not null default 3,
  default_visitor_capacity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_settings_windows_positive check (
    open_days_before >= 0
    and close_minutes_before >= 0
    and cancel_window_minutes >= 0
    and max_upcoming_bookings >= 1
    and default_visitor_capacity >= 0
  )
);

create table public.themes (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  app_name text not null,
  logo_url text,
  -- Couleur de marque telle que saisie. La correction de contraste se fait à
  -- l'affichage (packages/ui), pas en base : on conserve le choix de la box.
  primary_color text not null default '#E4572E',
  radius integer not null default 16,
  font text not null default 'Inter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint themes_primary_color_hex check (primary_color ~* '^#[0-9a-f]{6}$'),
  constraint themes_radius_sane check (radius between 0 and 48)
);

create table public.locations (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  address text,
  city text,
  postal_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index locations_tenant_idx on public.locations (tenant_id, created_at desc);
alter table public.locations add constraint locations_id_tenant_key unique (id, tenant_id);

create table public.rooms (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid not null,
  name text not null,
  capacity integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint rooms_capacity_positive check (capacity > 0),
  -- Clé étrangère **composite** : une salle ne peut référencer qu'une adresse
  -- du même tenant. Une FK simple sur `location_id` laisserait passer un
  -- rattachement croisé — le `with check` de la policy ne regarde que
  -- `tenant_id`, pas la cohérence des références.
  constraint rooms_location_same_tenant
    foreign key (location_id, tenant_id)
    references public.locations (id, tenant_id) on delete cascade
);

create index rooms_tenant_idx on public.rooms (tenant_id, location_id);

create table public.invitations (
  id uuid primary key default public.uuid_generate_v7(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email extensions.citext,
  role public.membership_role not null default 'MEMBER',
  status public.invitation_status not null default 'PENDING',
  -- Jeton nominatif à usage unique. Le QR d'affiliation de la box est une
  -- invitation sans e-mail, réutilisable jusqu'à révocation.
  token text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Même raison que pour `rooms` : l'invitant appartient forcément au tenant
  -- qui invite.
  -- `set null (invited_by)` avec la liste de colonnes : sans elle, PostgreSQL
  -- annule **toutes** les colonnes de la clé, `tenant_id` compris — qui est
  -- `not null`. La suppression d'un membre ayant émis une invitation échouerait
  -- alors en `23502`, et avec elle la suppression de compte RGPD.
  constraint invitations_inviter_same_tenant
    foreign key (invited_by, tenant_id)
    references public.memberships (id, tenant_id) on delete set null (invited_by)
);

create unique index invitations_token_key on public.invitations (token);
create index invitations_tenant_idx on public.invitations (tenant_id, status);

-- ---------------------------------------------------------------------------
-- Horodatage automatique
-- ---------------------------------------------------------------------------

create trigger tenants_set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();
create trigger tenant_settings_set_updated_at before update on public.tenant_settings
  for each row execute function public.set_updated_at();
create trigger themes_set_updated_at before update on public.themes
  for each row execute function public.set_updated_at();
create trigger locations_set_updated_at before update on public.locations
  for each row execute function public.set_updated_at();
create trigger rooms_set_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();
create trigger invitations_set_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- `force` en plus de `enable` : sans lui, le propriétaire de la table (donc les
-- migrations elles-mêmes) échapperait aux policies.
-- ---------------------------------------------------------------------------

alter table public.tenants enable row level security;
alter table public.tenants force row level security;
alter table public.users enable row level security;
alter table public.users force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
alter table public.tenant_settings enable row level security;
alter table public.tenant_settings force row level security;
alter table public.themes enable row level security;
alter table public.themes force row level security;
alter table public.locations enable row level security;
alter table public.locations force row level security;
alter table public.rooms enable row level security;
alter table public.rooms force row level security;
alter table public.invitations enable row level security;
alter table public.invitations force row level security;

-- tenants : la table *est* le tenant, le filtre porte donc sur `id`.
--
-- Aucune policy `insert` : créer une box en insérant directement serait
-- impossible de toute façon (il faudrait déjà y appartenir). La seule porte
-- d'entrée est `create_tenant()`, plus bas.
create policy tenants_member_select on public.tenants for select to authenticated
  using (id in (select public.current_tenant_ids()));
create policy tenants_member_update on public.tenants for update to authenticated
  using (id in (select public.current_tenant_ids()))
  with check (id in (select public.current_tenant_ids()));

-- Pas de policy `delete` non plus : supprimer une box casserait de toute façon
-- sur `ledger_entries … on delete restrict` et sur les triggers append-only.
-- Une box se ferme par `status = 'CLOSED'` et `deleted_at` (règle 10 de
-- CLAUDE.md, pas de suppression physique). Une policy `for delete` ici
-- n'entretiendrait qu'une illusion.

-- users : donnée de la personne, pas de la box. Chacun ne voit que lui-même.
-- Voir un membre de sa box passera par une vue restreinte (P0-005), jamais par
-- un accès direct à cette table.
-- Lecture et mise à jour de sa propre fiche. **Ni `insert`, ni `delete`.**
--
-- Pas de `delete` : supprimer `public.users` en laissant `auth.users` produit un
-- compte à moitié effacé — la personne se reconnecte, mais ses appartenances,
-- ses appareils et ses consentements ont disparu en cascade. La suppression
-- passe par le parcours RGPD (anonymisation à J+30), jamais par le client.
--
-- Pas de `insert` : la fiche est créée à l'inscription, côté serveur, en regard
-- de `auth.users`.
create policy users_self_select on public.users for select to authenticated
  using (id = (select auth.uid()));
create policy users_self_update on public.users for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- memberships : visibles et modifiables pour les tenants où l'on est actif.
--
-- **Aucune policy `insert`**, volontairement. Un `with check` d'appartenance
-- rendrait la toute première appartenance ininsérable : pour insérer il faudrait
-- déjà appartenir. Les deux seules portes d'entrée sont `create_tenant()` et
-- `accept_invitation()`, plus bas, qui valident elles-mêmes leurs préconditions.
-- `memberships` est en **lecture seule** pour `authenticated`. Aucune policy
-- d'écriture, quel que soit le rôle.
--
-- Une garde de rôle dans un `with check` ne suffit pas : elle valide qui écrit,
-- pas ce qui est écrit. Un MANAGER pouvait ainsi faire
-- `update memberships set user_id = <un tiers> where id = <la ligne OWNER>`,
-- évincer le propriétaire et greffer un utilisateur arbitraire — sans invitation,
-- sans vérification d'e-mail. Écrire un `with check` qui gèle `user_id` et
-- plafonne `role` est possible mais illisible et fragile.
--
-- Toutes les mutations passent donc par des fonctions `security definer`, qui
-- valident leurs préconditions en clair : `set_member_role()`, `remove_member()`,
-- `leave_tenant()`, plus `create_tenant()` et `accept_invitation()` pour l'entrée.
create policy memberships_tenant_select on public.memberships for select to authenticated
  using (tenant_id in (select public.current_tenant_ids()));

-- Les réglages de réservation gouvernent le produit pour toute la box : un
-- simple membre n'a pas à pouvoir élargir sa propre fenêtre d'annulation.
-- Policies **par commande**, jamais un `for all` doublé d'un `_select` : les
-- policies permissives s'additionnent, la garde de rôle du `for all` serait
-- alors inerte en lecture (piège 6 de `.claude/rules/database.md`).
--
-- Tous les membres lisent — ce sont ces règles que l'app affiche
-- (« annulation jusqu'à 4 h avant ») — mais seuls OWNER et MANAGER écrivent.
-- Pas de policy `delete` : les réglages vivent et meurent avec la box.
create policy tenant_settings_select on public.tenant_settings for select to authenticated
  using (tenant_id in (select public.current_tenant_ids()));
create policy tenant_settings_insert on public.tenant_settings for insert to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  );
create policy tenant_settings_update on public.tenant_settings for update to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  )
  with check (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  );

-- Le branding est réservé au propriétaire : la spec §5.2 exclut explicitement le
-- gestionnaire du white-label.
-- Le thème est lisible par tous les membres — c'est lui qui peint leur app —
-- et modifiable par le seul propriétaire.
create policy themes_select on public.themes for select to authenticated
  using (tenant_id in (select public.current_tenant_ids()));
create policy themes_insert on public.themes for insert to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) = 'OWNER'
  );
create policy themes_update on public.themes for update to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) = 'OWNER'
  )
  with check (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) = 'OWNER'
  );

-- Pas de policy `delete` : les adresses se retirent par `deleted_at` (règle 10).
create policy locations_select on public.locations for select to authenticated
  using (tenant_id in (select public.current_tenant_ids()));
create policy locations_insert on public.locations for insert to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  );
create policy locations_update on public.locations for update to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  )
  with check (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  );

-- Les salles sont lisibles par tous : elles apparaissent sur le planning.
create policy rooms_select on public.rooms for select to authenticated
  using (tenant_id in (select public.current_tenant_ids()));
create policy rooms_insert on public.rooms for insert to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  );
create policy rooms_update on public.rooms for update to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  )
  with check (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  );

-- Les invitations portent des adresses e-mail et **le rôle accordé à l'arrivée**.
-- Laisser un MEMBER en créer permettrait de forger une invitation `OWNER` puis de
-- la faire accepter par un complice : élévation de privilège en deux temps.
--
-- Un MANAGER invite des membres et des coachs, jamais un autre manager ni un
-- propriétaire (spec §5.2).
create policy invitations_write on public.invitations for all to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  )
  with check (
    tenant_id in (select public.current_tenant_ids())
    and (
      public.current_tenant_role(tenant_id) = 'OWNER'
      or (
        public.current_tenant_role(tenant_id) = 'MANAGER'
        and role in ('MEMBER', 'COACH')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Portes d'entrée — les seules façons de créer une appartenance
-- ---------------------------------------------------------------------------

-- `memberships` n'a pas de policy `insert` : sans ces deux fonctions, la
-- première appartenance serait ininsérable (il faudrait déjà appartenir au
-- tenant pour y entrer). Elles sont `security definer` et valident donc
-- elles-mêmes toutes leurs préconditions — c'est le prix de ce privilège.

-- Crée une box et y installe l'appelant comme OWNER, en une transaction.
create or replace function public.create_tenant(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_tenant_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Nom de box requis.' using errcode = 'check_violation';
  end if;

  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Slug invalide : %', p_slug using errcode = 'check_violation';
  end if;

  insert into public.tenants (name, slug)
  values (p_name, p_slug)
  returning id into v_tenant_id;

  insert into public.tenant_settings (tenant_id) values (v_tenant_id);
  insert into public.themes (tenant_id, app_name) values (v_tenant_id, p_name);

  insert into public.memberships (tenant_id, user_id, role)
  values (v_tenant_id, v_user_id, 'OWNER');

  return v_tenant_id;
end;
$$;

comment on function public.create_tenant(text, text) is
  'Crée une box et son OWNER. Seule porte d''entrée à memberships avec accept_invitation().';

revoke execute on function public.create_tenant(text, text) from public, anon;
grant execute on function public.create_tenant(text, text) to authenticated;

-- Consomme une invitation et crée l'appartenance correspondante.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invitation public.invitations;
  v_user_email text;
  v_existing_status public.membership_status;
begin
  if v_user_id is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  -- `for update` : deux acceptations simultanées du même jeton nominatif ne
  -- doivent pas produire deux appartenances.
  select * into v_invitation
  from public.invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'Invitation introuvable.' using errcode = 'no_data_found';
  end if;

  if v_invitation.status <> 'PENDING' then
    raise exception 'Invitation déjà utilisée ou révoquée.' using errcode = 'check_violation';
  end if;

  if v_invitation.expires_at <= now() then
    update public.invitations set status = 'EXPIRED' where id = v_invitation.id;
    raise exception 'Invitation expirée.' using errcode = 'check_violation';
  end if;

  -- Une invitation nominative est liée à **une** adresse. Sans ce contrôle, le
  -- jeton seul suffit : un lien transféré, capté dans un en-tête `Referer` ou
  -- pris en capture d'écran ouvrirait la box à n'importe qui.
  --
  -- La comparaison porte sur l'e-mail **vérifié du JWT**, pas sur
  -- `public.users.email`. Une première version comparait à cette colonne — que
  -- l'utilisateur peut réécrire : il lui suffisait de se donner l'adresse de
  -- l'invité pour consommer un jeton capté. Un contrôle d'identité ne peut pas
  -- s'appuyer sur une donnée que la personne contrôlée fournit elle-même.
  if v_invitation.email is not null then
    v_user_email := lower((select auth.jwt() ->> 'email'));
    if v_user_email is null or v_user_email <> lower(v_invitation.email::text) then
      raise exception 'Invitation nominative : adresse non correspondante.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  select status into v_existing_status
  from public.memberships
  where tenant_id = v_invitation.tenant_id and user_id = v_user_id;

  -- Une sanction ne se lève pas en réutilisant une invitation.
  if v_existing_status = 'SUSPENDED' then
    raise exception 'Appartenance suspendue : contacter la box.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Une exclusion non plus, sauf si la box réinvite **nommément**. Le QR
  -- d'affiliation affiché au mur (`email is null`) reste ouvert en permanence :
  -- s'il pouvait annuler une exclusion, `remove_member()` ne servirait à rien.
  if v_existing_status = 'REMOVED' and v_invitation.email is null then
    raise exception 'Appartenance révoquée : une invitation nominative est requise.'
      using errcode = 'insufficient_privilege';
  end if;

  -- `role = excluded.role` : on revient avec le rôle de la **nouvelle**
  -- invitation, jamais avec l'ancien. Un coach parti qui scanne le QR membre
  -- revient membre.
  insert into public.memberships (tenant_id, user_id, role)
  values (v_invitation.tenant_id, v_user_id, v_invitation.role)
  on conflict (tenant_id, user_id) do update
    set status = 'ACTIVE', left_at = null, role = excluded.role
    where public.memberships.status in ('LEFT', 'REMOVED');

  -- Une invitation nominative est à usage unique ; le QR d'affiliation de la
  -- box est une invitation sans e-mail, qui reste ouverte.
  if v_invitation.email is not null then
    update public.invitations
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invitation.id;
  end if;

  return v_invitation.tenant_id;
end;
$$;

comment on function public.accept_invitation(text) is
  'Consomme une invitation et crée l''appartenance. Valide expiration et statut elle-même.';

revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- Profil public d'une box, lisible **sans être authentifié**.
--
-- L'écran de bienvenue doit afficher le logo et les couleurs de la box avant
-- connexion (critère d'acceptation de P0-005). Les policies étant réservées à
-- `authenticated`, il faut cette porte — délibérément étroite : ni réglages, ni
-- compteurs, ni la moindre donnée personnelle.
create or replace function public.tenant_public_profile(p_slug text)
returns table (slug text, name text, app_name text, logo_url text, primary_color text, radius integer, font text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.slug, t.name, th.app_name, th.logo_url, th.primary_color, th.radius, th.font
  from public.tenants t
  join public.themes th on th.tenant_id = t.id
  where t.slug = p_slug
    and t.status = 'ACTIVE'
    and t.deleted_at is null;
$$;

comment on function public.tenant_public_profile(text) is
  'Branding public d''une box, pour l''écran de bienvenue avant connexion. Aucune donnée personnelle ni réglage.';

revoke execute on function public.tenant_public_profile(text) from public;
grant execute on function public.tenant_public_profile(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mutations de `memberships` — la table n'a aucune policy d'écriture
-- ---------------------------------------------------------------------------

-- Change le rôle d'un membre. `user_id` n'est pas un paramètre : l'identité
-- d'une appartenance est immuable, on ne « déplace » pas une ligne d'une
-- personne à une autre.
create or replace function public.set_member_role(
  p_membership_id uuid,
  p_role public.membership_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.memberships;
  v_actor_role public.membership_role;
  v_owner_count integer;
begin
  select * into v_target from public.memberships where id = p_membership_id;
  if not found then
    raise exception 'Appartenance introuvable.' using errcode = 'no_data_found';
  end if;

  v_actor_role := public.current_tenant_role(v_target.tenant_id);
  if v_actor_role is null or v_actor_role not in ('OWNER', 'MANAGER') then
    raise exception 'Réservé aux propriétaires et gestionnaires.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Un MANAGER ne fabrique ni OWNER ni MANAGER, et ne touche pas à ses pairs
  -- ni à ses supérieurs (spec §5.2). Sans cette borne, il se promeut lui-même.
  if v_actor_role = 'MANAGER' then
    if p_role in ('OWNER', 'MANAGER') then
      raise exception 'Un gestionnaire ne peut accorder que MEMBER ou COACH.'
        using errcode = 'insufficient_privilege';
    end if;
    if v_target.role in ('OWNER', 'MANAGER') then
      raise exception 'Un gestionnaire ne peut pas modifier un propriétaire ni un gestionnaire.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Verrou sur la box avant de compter les propriétaires. Sans lui, en
  -- READ COMMITTED, deux transactions concurrentes voient chacune deux
  -- propriétaires, passent toutes deux la garde, et la box se retrouve à zéro.
  perform 1 from public.tenants where id = v_target.tenant_id for update;

  -- Une box sans propriétaire n'est plus administrable par personne.
  if v_target.role = 'OWNER' and p_role <> 'OWNER' then
    select count(*) into v_owner_count
    from public.memberships
    where tenant_id = v_target.tenant_id and role = 'OWNER' and status = 'ACTIVE';
    if v_owner_count <= 1 then
      raise exception 'Impossible de rétrograder le dernier propriétaire de la box.'
        using errcode = 'check_violation';
    end if;
  end if;

  update public.memberships set role = p_role where id = p_membership_id;
end;
$$;

revoke execute on function public.set_member_role(uuid, public.membership_role) from public, anon;
grant execute on function public.set_member_role(uuid, public.membership_role) to authenticated;

-- Retire un membre. Suppression logique : `status = 'LEFT'`, pas de DELETE
-- (règle 10 de CLAUDE.md).
create or replace function public.remove_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.memberships;
  v_actor_role public.membership_role;
  v_owner_count integer;
begin
  select * into v_target from public.memberships where id = p_membership_id;
  if not found then
    raise exception 'Appartenance introuvable.' using errcode = 'no_data_found';
  end if;

  v_actor_role := public.current_tenant_role(v_target.tenant_id);
  if v_actor_role is null or v_actor_role not in ('OWNER', 'MANAGER') then
    raise exception 'Réservé aux propriétaires et gestionnaires.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_actor_role = 'MANAGER' and v_target.role in ('OWNER', 'MANAGER') then
    raise exception 'Un gestionnaire ne peut pas retirer un propriétaire ni un gestionnaire.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Même verrou que dans `set_member_role` : la garde « dernier propriétaire »
  -- est une lecture puis une écriture, elle doit être sérialisée.
  perform 1 from public.tenants where id = v_target.tenant_id for update;

  if v_target.role = 'OWNER' then
    select count(*) into v_owner_count
    from public.memberships
    where tenant_id = v_target.tenant_id and role = 'OWNER' and status = 'ACTIVE';
    if v_owner_count <= 1 then
      raise exception 'Impossible de retirer le dernier propriétaire de la box.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- `REMOVED`, pas `LEFT` : une exclusion ne s'annule pas en scannant le QR
  -- d'affiliation affiché au mur.
  update public.memberships
  set status = 'REMOVED', left_at = now()
  where id = p_membership_id;
end;
$$;

revoke execute on function public.remove_member(uuid) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;

-- Quitter une box de sa propre initiative. N'agit **que** sur sa propre ligne :
-- `user_id` n'est pas un paramètre, il vient de `auth.uid()`.
create or replace function public.leave_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role public.membership_role;
  v_owner_count integer;
begin
  select role into v_role
  from public.memberships
  where tenant_id = p_tenant_id and user_id = v_user_id and status = 'ACTIVE';

  if v_role is null then
    raise exception 'Aucune appartenance active dans cette box.'
      using errcode = 'no_data_found';
  end if;

  perform 1 from public.tenants where id = p_tenant_id for update;

  if v_role = 'OWNER' then
    select count(*) into v_owner_count
    from public.memberships
    where tenant_id = p_tenant_id and role = 'OWNER' and status = 'ACTIVE';
    if v_owner_count <= 1 then
      raise exception 'Transmettre la propriété de la box avant de la quitter.'
        using errcode = 'check_violation';
    end if;
  end if;

  update public.memberships
  set status = 'LEFT', left_at = now()
  where tenant_id = p_tenant_id and user_id = v_user_id;
end;
$$;

revoke execute on function public.leave_tenant(uuid) from public, anon;
grant execute on function public.leave_tenant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Une box ne reste jamais sans propriétaire
-- ---------------------------------------------------------------------------

-- `set_member_role()`, `remove_member()` et `leave_tenant()` refusent déjà de
-- retirer le dernier propriétaire. Restait une porte : supprimer son compte.
-- La suppression de `auth.users` cascade jusqu'à `memberships` sans passer par
-- aucune de ces fonctions — la box survivait avec zéro propriétaire actif,
-- donc ingérable à vie, et sans que personne l'ait décidé.
--
-- Ce n'est pas un blocage du droit à l'effacement : c'est une étape préalable
-- que la personne peut satisfaire immédiatement, en transmettant la propriété
-- ou en fermant sa box. Le parcours RGPD complet (anonymisation à J+30) est
-- construit en P0-005 et devra proposer ces deux options.
create or replace function public.forbid_orphaning_tenant()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_orphaned text;
begin
  select string_agg(t.name, ', ') into v_orphaned
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = old.id
    and m.role = 'OWNER'
    and m.status = 'ACTIVE'
    and t.status = 'ACTIVE'
    and t.deleted_at is null
    and (
      select count(*) from public.memberships m2
      where m2.tenant_id = m.tenant_id and m2.role = 'OWNER' and m2.status = 'ACTIVE'
    ) = 1;

  if v_orphaned is not null then
    raise exception
      'Compte propriétaire unique de : %. Transmettre la propriété ou fermer la box avant de supprimer le compte.',
      v_orphaned
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

create trigger users_forbid_orphaning_tenant
  before delete on public.users
  for each row execute function public.forbid_orphaning_tenant();

-- ---------------------------------------------------------------------------
-- L'e-mail n'est pas une donnée que l'utilisateur choisit
-- ---------------------------------------------------------------------------

-- `public.users.email` est le reflet de l'identité **vérifiée** par le
-- fournisseur d'authentification. Le laisser modifiable en fait une donnée
-- pilotée par le client, sur laquelle aucun contrôle d'identité ne peut
-- s'appuyer : il suffirait de se donner l'adresse d'un invité pour consommer
-- son invitation nominative captée.
--
-- Un changement d'adresse se fait chez le fournisseur, puis se propage ici.
create or replace function public.forbid_email_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Le changement est autorisé **si et seulement si** la nouvelle valeur est
  -- déjà celle vérifiée par le fournisseur. Autrement dit : on ne choisit pas
  -- son e-mail ici, on ne fait que refléter `auth.users`.
  --
  -- Sans cette exception, le trigger interdisait toute rectification d'adresse
  -- — un droit RGPD — et décrivait en commentaire un chemin de propagation qu'il
  -- rendait lui-même impossible.
  if new.email is distinct from old.email
     and new.email is distinct from (select u.email from auth.users u where u.id = new.id)
  then
    raise exception 'L''adresse e-mail se modifie via le fournisseur d''authentification, pas directement.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger users_forbid_email_change
  before update on public.users
  for each row execute function public.forbid_email_change();

-- ---------------------------------------------------------------------------
-- Les deux ponts avec `auth.users`
-- ---------------------------------------------------------------------------

-- `public.users` n'a **pas** de policy `insert` : sans ce trigger, personne ne
-- pourrait créer sa fiche, donc personne ne pourrait s'inscrire, créer une box
-- ni accepter une invitation. Le parcours principal du produit passe par ici.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;  -- inscription sans e-mail (téléphone) : hors périmètre pour l'instant
  end if;

  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Propagation d'un changement d'adresse validé chez le fournisseur. C'est le
-- chemin que `forbid_email_change` autorise, et le seul.
create or replace function public.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.users set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_user_email();
