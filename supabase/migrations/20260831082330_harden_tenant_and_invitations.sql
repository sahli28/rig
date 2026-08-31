-- Durcissement issu de la relecture de la PR #4.
--
-- Les trois migrations de P0-004 sont versionnées : on corrige par une nouvelle
-- migration, jamais en les modifiant. La règle ne vaut que parce qu'elle ne
-- souffre pas d'exception.

-- ---------------------------------------------------------------------------
-- 1. `tenants` était la seule table sans garde de rôle
-- ---------------------------------------------------------------------------

-- `tenant_settings`, `themes`, `locations` et `rooms` ont toutes reçu une garde
-- OWNER/MANAGER — et `tenants`, non. Un simple MEMBER pouvait donc :
--
--   update tenants set timezone = 'Pacific/Auckland' …  -- décale la fenêtre
--                                                       -- d'annulation (RM2.4)
--   update tenants set slug = 'lol' …                   -- casse le QR, les liens
--                                                       -- d'invitation et
--                                                       -- tenant_public_profile()
--   update tenants set status = 'CLOSED', deleted_at = now() …  -- fait disparaître
--                                                               -- la box pour tous
--
-- `timezone` fait strictement pire que `tenant_settings.cancel_window_minutes`,
-- que l'on venait pourtant de protéger.
drop policy tenants_member_update on public.tenants;

create policy tenants_admin_update on public.tenants for update to authenticated
  using (
    id in (select public.current_tenant_ids())
    and public.current_tenant_role(id) in ('OWNER', 'MANAGER')
  )
  with check (
    id in (select public.current_tenant_ids())
    and public.current_tenant_role(id) in ('OWNER', 'MANAGER')
  );

-- ---------------------------------------------------------------------------
-- 2. `forbid_orphaning_tenant` était un garde-fou potentiellement inerte
-- ---------------------------------------------------------------------------

-- Le trigger lit `memberships` et `tenants`, toutes deux en RLS `force`, et
-- s'exécute sous le rôle qui supprime `auth.users` — `supabase_auth_admin` ou un
-- job d'administration. Si ce rôle n'a pas `bypassrls`, son `select` ne voit
-- rien, `v_orphaned` vaut `null`, et le garde passe **exactement dans le cas
-- qu'il devait empêcher**.
--
-- C'est le piège de la récursion en miroir : la RLS qui vide silencieusement le
-- résultat d'un contrôle de sécurité. Un contrôle qui lit des tables protégées
-- doit être `security definer`.
create or replace function public.forbid_orphaning_tenant()
returns trigger
language plpgsql
security definer
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

-- ---------------------------------------------------------------------------
-- 3. `accept_invitation` réussissait en silence sans rien faire
-- ---------------------------------------------------------------------------

-- Le `where memberships.status in ('LEFT','REMOVED')` protégeait bien un membre
-- actif d'une rétrogradation. Mais quand l'appartenance existe et qu'elle est
-- `ACTIVE`, le `do update` ne touchait rien, aucune erreur n'était levée,
-- l'invitation passait `ACCEPTED` et la fonction retournait un succès.
--
-- Scénario banal : une adhérente devient coach, la box lui envoie une invitation
-- nominative COACH. Elle clique, l'app affiche « bienvenue », le jeton est brûlé,
-- et elle est toujours MEMBER. Le succès silencieux est le pire des deux mondes.
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
  v_tenant public.tenants;
begin
  if v_user_id is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  -- Lecture sans verrou d'abord. Le QR d'affiliation d'une box (`email is null`)
  -- n'est jamais modifié : le verrouiller mettrait toutes les inscriptions
  -- simultanées à la queue. Le jour de l'ouverture, trente personnes scannent en
  -- même temps. Seule l'invitation nominative, à usage unique, mérite un verrou.
  select * into v_invitation from public.invitations where token = p_token;

  if not found then
    raise exception 'Invitation introuvable.' using errcode = 'no_data_found';
  end if;

  if v_invitation.email is not null then
    select * into v_invitation
    from public.invitations where id = v_invitation.id
    for update;
  end if;

  if v_invitation.status <> 'PENDING' then
    raise exception 'Invitation déjà utilisée ou révoquée.' using errcode = 'check_violation';
  end if;

  if v_invitation.expires_at <= now() then
    update public.invitations set status = 'EXPIRED' where id = v_invitation.id;
    raise exception 'Invitation expirée.' using errcode = 'check_violation';
  end if;

  -- On ne rejoint pas une box fermée.
  select * into v_tenant from public.tenants where id = v_invitation.tenant_id;
  if v_tenant.status <> 'ACTIVE' or v_tenant.deleted_at is not null then
    raise exception 'Cette box n''accepte plus de nouveaux membres.'
      using errcode = 'check_violation';
  end if;

  -- Contrôle d'identité sur l'e-mail **vérifié du JWT**, jamais sur
  -- `public.users.email` que le client pourrait réécrire.
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

  if v_existing_status = 'SUSPENDED' then
    raise exception 'Appartenance suspendue : contacter la box.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_existing_status = 'REMOVED' and v_invitation.email is null then
    raise exception 'Appartenance révoquée : une invitation nominative est requise.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Refus explicite plutôt que no-op. Un changement de rôle passe par
  -- `set_member_role()`, pas par une invitation.
  if v_existing_status = 'ACTIVE' then
    raise exception 'Déjà membre de cette box. Un changement de rôle passe par set_member_role().'
      using errcode = 'unique_violation';
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_invitation.tenant_id, v_user_id, v_invitation.role)
  on conflict (tenant_id, user_id) do update
    set status = 'ACTIVE', left_at = null, role = excluded.role;

  if v_invitation.email is not null then
    update public.invitations
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invitation.id;
  end if;

  return v_invitation.tenant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. `create_tenant` était illimité
-- ---------------------------------------------------------------------------

-- Un tenant est un client facturé : sans plafond, c'est un trou de facturation
-- et un vecteur de spam, chaque appel créant quatre lignes.
create or replace function public.create_tenant(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_tenant_id uuid;
  v_owned integer;
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

  select count(*) into v_owned
  from public.memberships
  where user_id = v_user_id and role = 'OWNER' and status = 'ACTIVE';

  if v_owned >= 3 then
    raise exception 'Limite de boxes atteinte. Contacter le support.'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.tenants where slug = p_slug and deleted_at is null) then
    raise exception 'Ce nom d''URL est déjà pris : %', p_slug using errcode = 'unique_violation';
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

-- ---------------------------------------------------------------------------
-- 5. Collision d'adresse à l'inscription
-- ---------------------------------------------------------------------------

-- `on conflict (id) do nothing` couvrait la collision d'identifiant, pas celle
-- d'adresse : deux comptes `auth.users` distincts portant le même e-mail
-- violaient `users_email_key` dans un trigger `after insert`, et l'inscription
-- échouait sur une erreur opaque.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  if exists (select 1 from public.users where email = new.email and deleted_at is null) then
    raise exception 'Un compte existe déjà avec cette adresse.'
      using errcode = 'unique_violation';
  end if;

  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;
