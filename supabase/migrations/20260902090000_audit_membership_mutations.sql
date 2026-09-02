-- Le journal d'audit, enfin écrit.
--
-- `log_audit()` existe depuis P0-004 : sa fonction, ses droits, ses tests, et
-- depuis D-001 une policy de lecture réservée à l'OWNER. **Aucun code ne
-- l'appelait.** Septième occurrence du motif que `.claude/rules/database.md`
-- appelle la règle des sœurs — une moitié posée, sa jumelle jamais écrite.
--
-- Et celle-ci ne se rattrape pas. Un test manquant se réécrit ; **un journal non
-- tenu ne se reconstitue pas.** Ce qui n'est pas tracé pendant l'intervalle est
-- perdu définitivement.
--
-- ---------------------------------------------------------------------------
-- Six fonctions, pas trois
-- ---------------------------------------------------------------------------
--
-- Ne tracer que les trois actions de l'écran Staff & Roles donnerait un journal
-- capable de dire qui a été **exclu**, mais pas qui est **parti**. Or « est-elle
-- partie ou l'a-t-on exclue ? » est exactement la question à laquelle un journal
-- d'audit existe pour répondre. D'où `leave_tenant` et `create_tenant` avec les
-- quatre autres.
--
-- ---------------------------------------------------------------------------
-- Ce qui n'entre JAMAIS dans le `diff`
-- ---------------------------------------------------------------------------
--
-- `audit_logs.diff` est un `jsonb` que la base ne filtre pas, et la table est
-- **append-only** : une erreur y est définitive, on ne peut pas l'en retirer.
--
--   * **jamais le jeton d'invitation.** D-005 vient de consacrer un ticket
--     entier à éliminer tout jeton vivant de la base ; l'écrire ici le
--     réintroduirait en une ligne, silencieusement, dans la seule table dont on
--     ne peut rien effacer ;
--   * **jamais un e-mail**, ni celui de l'invité ni celui du membre
--     (`.claude/rules/privacy.md`).
--
-- `p_ip` reste **nul**, et c'est délibéré : PostgREST expose les en-têtes, mais
-- un `x-forwarded-for` est falsifiable et c'est une donnée personnelle. Un champ
-- vide vaut mieux qu'un champ faux.
--
-- ---------------------------------------------------------------------------
-- L'ordre des instructions devient une question de correction
-- ---------------------------------------------------------------------------
--
-- `log_audit()` **lève** si l'appelant n'a pas d'appartenance *active* dans la
-- box — c'est ce qui l'empêche de journaliser ailleurs que chez soi. Et l'appel
-- est volontairement dans la **même transaction** que l'action : une action non
-- traçable ne doit pas avoir lieu.
--
-- Les deux ensemble font que le placement compte :
--
--   * `leave_tenant` journalise **avant** de passer le statut à `LEFT` — après,
--     l'appelant n'est plus membre actif, la journalisation lèverait, et un
--     départ parfaitement légitime serait annulé ;
--   * `accept_invitation` et `create_tenant` journalisent **après** l'insertion
--     de l'appartenance, qui n'existe pas avant.

-- ---------------------------------------------------------------------------
-- 1. set_member_role
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

  -- L'avant et l'après, et rien d'autre : ni nom, ni e-mail. Le `membership_id`
  -- suffit à retrouver la personne pour qui en a le droit.
  perform public.log_audit(
    v_target.tenant_id,
    'membership.role_changed',
    'membership',
    p_membership_id,
    jsonb_build_object(
      'membership_id', p_membership_id,
      'from', v_target.role,
      'to', p_role
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. remove_member
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

  -- L'acteur reste actif : c'est lui qui exclut, pas lui qui part. L'ordre est
  -- donc libre ici — contrairement à `leave_tenant`.
  perform public.log_audit(
    v_target.tenant_id,
    'membership.removed',
    'membership',
    p_membership_id,
    jsonb_build_object(
      'membership_id', p_membership_id,
      'previous_role', v_target.role,
      'previous_status', v_target.status
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. leave_tenant — le cas où l'ordre est une question de correction
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
  v_membership_id uuid;
  v_owner_count integer;
begin
  select id, role into v_membership_id, v_role
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

  -- **Avant** la mise à jour, et pas par élégance : après, l'appelant n'est plus
  -- membre actif, `log_audit()` lèverait `insufficient_privilege`, et le départ
  -- — parfaitement légitime — serait annulé avec elle.
  perform public.log_audit(
    p_tenant_id,
    'membership.left',
    'membership',
    v_membership_id,
    jsonb_build_object('membership_id', v_membership_id, 'previous_role', v_role)
  );

  update public.memberships set status = 'LEFT', left_at = now()
  where tenant_id = p_tenant_id and user_id = v_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. create_invitation
-- ---------------------------------------------------------------------------

create or replace function public.create_invitation(
  p_tenant_id uuid,
  p_email text default null,
  p_role public.membership_role default 'MEMBER',
  p_expires_in interval default interval '30 days'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_actor_role public.membership_role;
  v_tenant public.tenants;
  v_membership_id uuid;
  v_invitation_id uuid;
  v_email extensions.citext;
  v_token text;
begin
  if v_user_id is null then
    perform public.app_error('AUTH_REQUIRED', 'Authentification requise.', '42501');
  end if;

  v_actor_role := public.current_tenant_role(p_tenant_id);
  if v_actor_role is null or v_actor_role not in ('OWNER', 'MANAGER') then
    perform public.app_error('FORBIDDEN_ROLE',
      'Réservé aux propriétaires et gestionnaires.', '42501');
  end if;

  -- Un gestionnaire n'invite qu'aux rôles qu'il pourrait attribuer (spec §5.2).
  if v_actor_role = 'MANAGER' and p_role in ('OWNER', 'MANAGER') then
    perform public.app_error('MANAGER_CANNOT_GRANT_ROLE',
      'Un gestionnaire ne peut inviter qu''au rôle MEMBER ou COACH.', '42501');
  end if;

  select * into v_tenant from public.tenants where id = p_tenant_id;
  if v_tenant.status <> 'ACTIVE' or v_tenant.deleted_at is not null then
    perform public.app_error('TENANT_CLOSED',
      'Cette box n''accepte plus de nouveaux membres.', '23514');
  end if;

  -- `invited_by` est **dérivé**, pas reçu — même motif que `log_audit()`.
  select m.id into v_membership_id
  from public.memberships m
  where m.user_id = v_user_id and m.tenant_id = p_tenant_id
    and m.status = 'ACTIVE' and m.left_at is null;

  v_email := nullif(lower(trim(p_email)), '');

  -- 24 octets, 48 caractères hexadécimaux : 192 bits d'entropie, et sûr dans une
  -- URL comme dans un QR sans encodage supplémentaire.
  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.invitations (tenant_id, email, role, token_hash, expires_at, invited_by)
  values (
    p_tenant_id,
    v_email,
    p_role,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    now() + p_expires_in,
    v_membership_id
  )
  returning id into v_invitation_id;

  -- **Ni le jeton, ni l'e-mail** : un booléen suffit à distinguer une invitation
  -- nominative du QR mural, et c'est tout ce que le journal a besoin de savoir.
  perform public.log_audit(
    p_tenant_id,
    'invitation.created',
    'invitation',
    v_invitation_id,
    jsonb_build_object(
      'invitation_id', v_invitation_id,
      'role', p_role,
      'nominative', v_email is not null
    )
  );

  -- Le seul et unique moment où le jeton en clair existe.
  return v_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. accept_invitation
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
  v_hash text;
begin
  if v_user_id is null then
    perform public.app_error('AUTH_REQUIRED', 'Authentification requise.', '42501');
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_invitation from public.invitations where token_hash = v_hash;

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

  -- **Après** l'insertion : avant, l'arrivant n'a pas d'appartenance active et
  -- `log_audit()` refuserait de journaliser dans une box dont il n'est pas
  -- membre — ce qui est précisément sa garantie.
  perform public.log_audit(
    v_invitation.tenant_id,
    'invitation.accepted',
    'invitation',
    v_invitation.id,
    jsonb_build_object('invitation_id', v_invitation.id, 'role', v_invitation.role)
  );

  return v_invitation.tenant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. create_tenant
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

  -- Après l'appartenance, pour la même raison qu'`accept_invitation`. Le `slug`
  -- est public par destination — il est dans l'URL — donc il peut entrer ici.
  perform public.log_audit(
    v_tenant_id,
    'tenant.created',
    'tenant',
    v_tenant_id,
    jsonb_build_object('slug', p_slug)
  );

  return v_tenant_id;
end;
$$;
