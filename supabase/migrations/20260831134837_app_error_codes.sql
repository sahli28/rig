-- Codes d'erreur applicatifs sur les fonctions métier.
--
-- `.claude/rules/api.md` impose que le client réagisse au **code**, jamais au
-- texte. En appel RPC direct (ADR 0004), ce qui remonte au client est le
-- SQLSTATE — et `check_violation` sert déjà à cinq erreurs distinctes :
-- invitation expirée, invitation déjà utilisée, box fermée, dernier
-- propriétaire, quota atteint.
--
-- Sans code applicatif, le client n'aurait que le message **français** à
-- inspecter. Trois écrans plus tard, ce serait acquis et irréversible.
--
-- PostgREST expose `code`, `message`, `details` et `hint` : on fait porter le
-- code applicatif par `detail`, en JSON. `packages/core` tient la
-- correspondance code → message traduit.

-- Lève une erreur métier avec son code applicatif. Un seul endroit où la forme
-- du `detail` est décidée.
create or replace function public.app_error(
  p_code text,
  p_message text,
  p_sqlstate text default 'P0001'
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_message
    using errcode = p_sqlstate,
          detail = json_build_object('code', p_code)::text;
end;
$$;

comment on function public.app_error(text, text, text) is
  'Erreur métier avec code applicatif dans detail. Le client réagit au code, jamais au message.';

-- ---------------------------------------------------------------------------
-- create_tenant
-- ---------------------------------------------------------------------------

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
    perform public.app_error('AUTH_REQUIRED', 'Authentification requise.', '42501');
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    perform public.app_error('TENANT_NAME_REQUIRED', 'Nom de box requis.', '23514');
  end if;

  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    perform public.app_error('TENANT_SLUG_INVALID', 'Nom d''URL invalide.', '23514');
  end if;

  select count(*) into v_owned
  from public.memberships
  where user_id = v_user_id and role = 'OWNER' and status = 'ACTIVE';

  if v_owned >= 3 then
    perform public.app_error('TENANT_QUOTA_REACHED',
      'Limite de boxes atteinte. Contacter le support.', '23514');
  end if;

  if exists (select 1 from public.tenants where slug = p_slug and deleted_at is null) then
    perform public.app_error('TENANT_SLUG_TAKEN', 'Ce nom d''URL est déjà pris.', '23505');
  end if;

  insert into public.tenants (name, slug) values (p_name, p_slug) returning id into v_tenant_id;
  insert into public.tenant_settings (tenant_id) values (v_tenant_id);
  insert into public.themes (tenant_id, app_name) values (v_tenant_id, p_name);
  insert into public.memberships (tenant_id, user_id, role) values (v_tenant_id, v_user_id, 'OWNER');

  return v_tenant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_invitation
-- ---------------------------------------------------------------------------

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
    perform public.app_error('AUTH_REQUIRED', 'Authentification requise.', '42501');
  end if;

  select * into v_invitation from public.invitations where token = p_token;

  if not found then
    perform public.app_error('INVITATION_NOT_FOUND', 'Invitation introuvable.', 'P0002');
  end if;

  -- Verrou réservé à l'invitation nominative, à usage unique. Le QR mural
  -- (`email is null`) n'est jamais modifié : le verrouiller mettrait à la queue
  -- toutes les inscriptions simultanées du jour d'ouverture.
  if v_invitation.email is not null then
    select * into v_invitation from public.invitations where id = v_invitation.id for update;
  end if;

  if v_invitation.status <> 'PENDING' then
    perform public.app_error('INVITATION_ALREADY_USED',
      'Invitation déjà utilisée ou révoquée.', '23514');
  end if;

  if v_invitation.expires_at <= now() then
    update public.invitations set status = 'EXPIRED' where id = v_invitation.id;
    perform public.app_error('INVITATION_EXPIRED', 'Invitation expirée.', '23514');
  end if;

  select * into v_tenant from public.tenants where id = v_invitation.tenant_id;
  if v_tenant.status <> 'ACTIVE' or v_tenant.deleted_at is not null then
    perform public.app_error('TENANT_CLOSED',
      'Cette box n''accepte plus de nouveaux membres.', '23514');
  end if;

  -- Identité comparée à l'e-mail **vérifié du JWT**, jamais à `public.users.email`
  -- que le client pourrait réécrire.
  if v_invitation.email is not null then
    v_user_email := lower((select auth.jwt() ->> 'email'));
    if v_user_email is null or v_user_email <> lower(v_invitation.email::text) then
      perform public.app_error('INVITATION_EMAIL_MISMATCH',
        'Invitation nominative : adresse non correspondante.', '42501');
    end if;
  end if;

  select status into v_existing_status
  from public.memberships
  where tenant_id = v_invitation.tenant_id and user_id = v_user_id
  for update;

  if v_existing_status = 'SUSPENDED' then
    perform public.app_error('MEMBERSHIP_SUSPENDED',
      'Appartenance suspendue : contacter la box.', '42501');
  end if;

  if v_existing_status = 'REMOVED' and v_invitation.email is null then
    perform public.app_error('MEMBERSHIP_REVOKED',
      'Appartenance révoquée : une invitation nominative est requise.', '42501');
  end if;

  if v_existing_status = 'ACTIVE' then
    perform public.app_error('ALREADY_MEMBER',
      'Déjà membre de cette box. Un changement de rôle passe par set_member_role().', '23505');
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_invitation.tenant_id, v_user_id, v_invitation.role)
  on conflict (tenant_id, user_id) do update
    set status = 'ACTIVE', left_at = null, role = excluded.role
    where public.memberships.status in ('LEFT', 'REMOVED');

  if v_invitation.email is not null then
    update public.invitations set status = 'ACCEPTED', accepted_at = now()
    where id = v_invitation.id;
  end if;

  return v_invitation.tenant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_member_role
-- ---------------------------------------------------------------------------

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
    perform public.app_error('MEMBERSHIP_NOT_FOUND', 'Appartenance introuvable.', 'P0002');
  end if;

  v_actor_role := public.current_tenant_role(v_target.tenant_id);
  if v_actor_role is null or v_actor_role not in ('OWNER', 'MANAGER') then
    perform public.app_error('FORBIDDEN_ROLE',
      'Réservé aux propriétaires et gestionnaires.', '42501');
  end if;

  if v_actor_role = 'MANAGER' then
    if p_role in ('OWNER', 'MANAGER') then
      perform public.app_error('MANAGER_CANNOT_GRANT_ROLE',
        'Un gestionnaire ne peut accorder que MEMBER ou COACH.', '42501');
    end if;
    if v_target.role in ('OWNER', 'MANAGER') then
      perform public.app_error('MANAGER_CANNOT_MODIFY_ADMIN',
        'Un gestionnaire ne peut pas modifier un propriétaire ni un gestionnaire.', '42501');
    end if;
  end if;

  perform 1 from public.tenants where id = v_target.tenant_id for update;

  if v_target.role = 'OWNER' and p_role <> 'OWNER' then
    select count(*) into v_owner_count
    from public.memberships
    where tenant_id = v_target.tenant_id and role = 'OWNER' and status = 'ACTIVE';
    if v_owner_count <= 1 then
      perform public.app_error('LAST_OWNER',
        'Impossible de rétrograder le dernier propriétaire de la box.', '23514');
    end if;
  end if;

  update public.memberships set role = p_role where id = p_membership_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- remove_member
-- ---------------------------------------------------------------------------

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
    perform public.app_error('MEMBERSHIP_NOT_FOUND', 'Appartenance introuvable.', 'P0002');
  end if;

  v_actor_role := public.current_tenant_role(v_target.tenant_id);
  if v_actor_role is null or v_actor_role not in ('OWNER', 'MANAGER') then
    perform public.app_error('FORBIDDEN_ROLE',
      'Réservé aux propriétaires et gestionnaires.', '42501');
  end if;

  if v_actor_role = 'MANAGER' and v_target.role in ('OWNER', 'MANAGER') then
    perform public.app_error('MANAGER_CANNOT_MODIFY_ADMIN',
      'Un gestionnaire ne peut pas retirer un propriétaire ni un gestionnaire.', '42501');
  end if;

  perform 1 from public.tenants where id = v_target.tenant_id for update;

  if v_target.role = 'OWNER' then
    select count(*) into v_owner_count
    from public.memberships
    where tenant_id = v_target.tenant_id and role = 'OWNER' and status = 'ACTIVE';
    if v_owner_count <= 1 then
      perform public.app_error('LAST_OWNER',
        'Impossible de retirer le dernier propriétaire de la box.', '23514');
    end if;
  end if;

  update public.memberships set status = 'REMOVED', left_at = now() where id = p_membership_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- leave_tenant
-- ---------------------------------------------------------------------------

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
    perform public.app_error('MEMBERSHIP_NOT_FOUND',
      'Aucune appartenance active dans cette box.', 'P0002');
  end if;

  perform 1 from public.tenants where id = p_tenant_id for update;

  if v_role = 'OWNER' then
    select count(*) into v_owner_count
    from public.memberships
    where tenant_id = p_tenant_id and role = 'OWNER' and status = 'ACTIVE';
    if v_owner_count <= 1 then
      perform public.app_error('LAST_OWNER',
        'Transmettre la propriété de la box avant de la quitter.', '23514');
    end if;
  end if;

  update public.memberships set status = 'LEFT', left_at = now()
  where tenant_id = p_tenant_id and user_id = v_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- log_audit
-- ---------------------------------------------------------------------------

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
    perform public.app_error('NOT_TENANT_MEMBER',
      'Journalisation refusée : pas membre actif de cette box.', '42501');
  end if;

  insert into public.audit_logs (tenant_id, actor_membership_id, action, target_type, target_id, diff, ip)
  values (p_tenant_id, v_membership_id, p_action, p_target_type, p_target_id, p_diff, p_ip)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gardes de schéma — elles remontent aussi au client
-- ---------------------------------------------------------------------------

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
    and m.role = 'OWNER' and m.status = 'ACTIVE'
    and t.status = 'ACTIVE' and t.deleted_at is null
    and (select count(*) from public.memberships m2
         where m2.tenant_id = m.tenant_id and m2.role = 'OWNER' and m2.status = 'ACTIVE') = 1;

  if v_orphaned is not null then
    perform public.app_error('TENANT_WOULD_BE_ORPHANED',
      format('Compte propriétaire unique de : %s. Transmettre la propriété ou fermer la box avant de supprimer le compte.', v_orphaned),
      '23514');
  end if;

  return old;
end;
$$;

create or replace function public.forbid_email_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is distinct from old.email
     and new.email is distinct from (select u.email from auth.users u where u.id = new.id)
  then
    perform public.app_error('EMAIL_IMMUTABLE',
      'L''adresse e-mail se modifie via le fournisseur d''authentification, pas directement.',
      '42501');
  end if;
  return new;
end;
$$;

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
    perform public.app_error('EMAIL_ALREADY_REGISTERED',
      'Un compte existe déjà avec cette adresse.', '23505');
  end if;

  insert into public.users (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.enforce_owner_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owned integer;
begin
  if new.role <> 'OWNER' or new.status <> 'ACTIVE' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.user_id::text));

  select count(*) into v_owned
  from public.memberships
  where user_id = new.user_id and role = 'OWNER' and status = 'ACTIVE' and id <> new.id;

  if v_owned >= 3 then
    perform public.app_error('TENANT_QUOTA_REACHED',
      'Limite de boxes atteinte pour ce compte. Contacter le support.', '23514');
  end if;

  return new;
end;
$$;

create or replace function public.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.app_error('APPEND_ONLY',
    format('%s.%s est append-only : %s interdit. Émettre une contre-écriture.',
           tg_table_schema, tg_table_name, tg_op),
    '23001');
  return null;
end;
$$;
