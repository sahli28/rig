-- Rejoindre une box **sans détenir le jeton**, et une invitation par personne.
--
-- L'import CSV (P1-001d) crée une invitation par ligne. Distribuer 200 jetons
-- vivants dans un tableur serait exactement ce que D-005 a consacré un ticket
-- entier à empêcher — et le produit n'envoie pas d'e-mail.
--
-- La sortie : on accepte une invitation nominative **en se connectant avec
-- l'adresse invitée**. Le jeton n'a jamais été qu'une commodité ; la garantie
-- réelle est le contrôle de la boîte mail, la même que pour un lien magique, et
-- `accept_invitation()` compare **déjà** l'adresse au JWT vérifié. Le retirer
-- n'affaiblit rien.
--
-- Mais cela ouvre une **deuxième porte vers `memberships`**, alors que l'ADR
-- 0002 n'en voulait que deux. D'où les précautions ci-dessous, dont deux sont
-- des invariants.

-- ---------------------------------------------------------------------------
-- 1. Le nom, tant qu'à importer une liste de membres
-- ---------------------------------------------------------------------------

-- Une box qui migre importe un **effectif**, pas une liste d'adresses. Sans ces
-- deux colonnes, le mapping de colonnes du ticket n'aurait qu'un champ à mapper
-- et l'annuaire n'afficherait que des e-mails jusqu'à ce que chacun remplisse
-- son profil.
--
-- Ce sont des données que la box détient déjà — elle vient de les téléverser.
-- Elles servent une fois, à l'acceptation, pour pré-remplir un profil **vide**,
-- et ne remplacent jamais ce que la personne a saisi elle-même.
alter table public.invitations add column first_name text;
alter table public.invitations add column last_name text;

comment on column public.invitations.first_name is
  'Pré-remplissage du profil à l''acceptation, quand il est vide. Vient de l''import CSV de la box.';

-- ---------------------------------------------------------------------------
-- 2. Une seule invitation en attente par personne et par box
-- ---------------------------------------------------------------------------

-- Il y avait un index unique sur `token_hash`, **aucun** sur (box, adresse).
-- Un import rejoué — et il le sera, c'est le propre d'un import — créait une
-- deuxième puis une troisième invitation pour la même personne.
--
-- L'index ne peut pas porter sur l'expiration (`now()` n'est pas immutable) :
-- une invitation périmée mais toujours `PENDING` bloquerait donc une nouvelle.
-- D'où `expire_stale_invitations()` juste en dessous, appelée avant toute
-- émission : elle constate l'expiration au lieu de la laisser traîner.
create unique index invitations_pending_email_key
  on public.invitations (tenant_id, lower(email::text))
  where status = 'PENDING' and email is not null;

create or replace function public.expire_stale_invitations(p_tenant_id uuid, p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invitations
  set status = 'EXPIRED'
  where tenant_id = p_tenant_id
    and status = 'PENDING'
    and email is not null
    and lower(email::text) = lower(p_email)
    and expires_at <= now();
$$;

revoke execute on function public.expire_stale_invitations(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. L'insertion, en un seul endroit
-- ---------------------------------------------------------------------------

-- Partagée par `create_invitation()` (une à la fois, avec son jeton) et
-- `import_members()` (par centaines, sans jeton). Les contrôles de rôle
-- appartiennent aux appelants ; celle-ci n'écrit que la ligne.
create or replace function public.insert_invitation(
  p_tenant_id uuid,
  p_email text,
  p_role public.membership_role,
  p_expires_in interval,
  p_invited_by uuid,
  p_first_name text default null,
  p_last_name text default null
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_id uuid;
begin
  -- 24 octets, 48 caractères hexadécimaux : 192 bits d'entropie, et sûr dans
  -- une URL comme dans un QR sans encodage supplémentaire.
  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.invitations (
    tenant_id, email, role, token_hash, expires_at, invited_by, first_name, last_name
  )
  values (
    p_tenant_id,
    nullif(lower(trim(p_email)), ''),
    p_role,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    now() + p_expires_in,
    p_invited_by,
    nullif(trim(p_first_name), ''),
    nullif(trim(p_last_name), '')
  )
  returning id into v_id;

  return query select v_id, v_token;
end;
$$;

revoke execute on function public.insert_invitation(uuid, text, public.membership_role, interval, uuid, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. claim_invitation — le corps commun des deux portes
-- ---------------------------------------------------------------------------

-- **L'invariant qui compte.** `accept_invitation(token)` et la voie par identité
-- vérifient exactement la même chose : statut, expiration, box active,
-- appartenance ni suspendue ni révoquée-sans-invitation-nominative, ni déjà
-- active, et l'adresse du JWT qui correspond.
--
-- Si les deux listes divergeaient d'un seul contrôle, ce serait un
-- contournement — et **personne ne le verrait**, les deux fonctions passant
-- leurs tests séparément. Le corps est donc ici, et les deux portes l'appellent.
--
-- Révoquée de tous : elle ne vérifie pas *comment* on est arrivé jusqu'à une
-- invitation, seulement qu'on a le droit de la consommer. C'est aux portes de
-- prouver qu'elles l'ont résolue légitimement.
create or replace function public.claim_invitation(p_invitation_id uuid)
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

  select * into v_invitation from public.invitations where id = p_invitation_id;
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
  -- que le client pourrait réécrire (piège 7 de `.claude/rules/database.md`).
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

  -- Le nom venu de l'import ne sert qu'à **remplir un vide**. Il ne remplace
  -- jamais ce que la personne a saisi : c'est son profil, pas celui de la box.
  if v_invitation.first_name is not null then
    update public.users
    set first_name = coalesce(nullif(trim(first_name), ''), v_invitation.first_name),
        last_name = coalesce(nullif(trim(last_name), ''), v_invitation.last_name)
    where id = v_user_id;
  end if;

  -- **Après** l'insertion de l'appartenance : avant, `log_audit()` refuserait de
  -- journaliser dans une box dont l'appelant n'est pas membre.
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

revoke execute on function public.claim_invitation(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Les deux portes
-- ---------------------------------------------------------------------------

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if v_id is null then
    perform public.app_error('INVITATION_NOT_FOUND', 'Invitation introuvable.', 'P0002');
  end if;

  return public.claim_invitation(v_id);
end;
$$;

-- La voie sans jeton : on ne résout **que parmi ses propres invitations**.
--
-- Le filtre sur l'adresse du JWT est ici, et pas seulement dans
-- `claim_invitation()`, pour ne pas transformer la fonction en oracle : sans
-- lui, un identifiant deviné distinguerait « invitation inexistante » de
-- « invitation qui n'est pas pour vous ». Les UUID v7 portent un horodatage,
-- donc ils se devinent mieux qu'on ne le croit.
create or replace function public.accept_pending_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_email text := lower((select auth.jwt() ->> 'email'));
begin
  if v_email is null then
    perform public.app_error('AUTH_REQUIRED', 'Authentification requise.', '42501');
  end if;

  select id into v_id
  from public.invitations
  where id = p_invitation_id
    and email is not null
    and lower(email::text) = v_email;

  if v_id is null then
    perform public.app_error('INVITATION_NOT_FOUND', 'Invitation introuvable.', 'P0002');
  end if;

  return public.claim_invitation(v_id);
end;
$$;

revoke execute on function public.accept_pending_invitation(uuid) from public, anon;
grant execute on function public.accept_pending_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. pending_invitations_for_me — **aucun paramètre**, et c'est l'invariant
-- ---------------------------------------------------------------------------

-- Même règle que `current_tenant_ids()`, pour la même raison. Avec un paramètre
-- d'adresse, n'importe qui demanderait « est-ce que `marie@cabinet-x.fr` est
-- invitée quelque part » : ce serait un annuaire d'invitations lisible à travers
-- **tous** les tenants, servi par une fonction `security definer`.
--
-- Sans paramètre, elle ne peut structurellement rendre que les invitations de
-- l'adresse vérifiée de son appelant. Lui en ajouter un en ferait une faille.
create or replace function public.pending_invitations_for_me()
returns table (
  invitation_id uuid,
  tenant_slug text,
  tenant_name text,
  role public.membership_role,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, t.slug, t.name, i.role, i.expires_at
  from public.invitations i
  join public.tenants t on t.id = i.tenant_id
  where i.email is not null
    and lower(i.email::text) = lower((select auth.jwt() ->> 'email'))
    and i.status = 'PENDING'
    and i.expires_at > now()
    and t.status = 'ACTIVE'
    and t.deleted_at is null
  order by i.created_at;
$$;

comment on function public.pending_invitations_for_me() is
  'Invitations en attente pour l''adresse vérifiée de l''appelant. SANS PARAMÈTRE, comme current_tenant_ids() : un paramètre en ferait un annuaire d''invitations inter-tenants.';

revoke execute on function public.pending_invitations_for_me() from public, anon;
grant execute on function public.pending_invitations_for_me() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. create_invitation — dédoublonnage et insertion partagée
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
  v_email text := nullif(lower(trim(p_email)), '');
  v_invitation_id uuid;
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

  if v_email is not null then
    -- Constater les périmées avant de refuser : sans ça, une invitation morte
    -- depuis six mois empêcherait d'en émettre une nouvelle, par l'index.
    perform public.expire_stale_invitations(p_tenant_id, v_email);

    if exists (
      select 1 from public.invitations
      where tenant_id = p_tenant_id and status = 'PENDING'
        and email is not null and lower(email::text) = v_email
    ) then
      perform public.app_error('INVITATION_ALREADY_PENDING',
        'Une invitation est déjà en attente pour cette adresse.', '23505');
    end if;
  end if;

  -- `invited_by` est **dérivé**, pas reçu — même motif que `log_audit()`.
  select m.id into v_membership_id
  from public.memberships m
  where m.user_id = v_user_id and m.tenant_id = p_tenant_id
    and m.status = 'ACTIVE' and m.left_at is null;

  select i.invitation_id, i.token into v_invitation_id, v_token
  from public.insert_invitation(p_tenant_id, v_email, p_role, p_expires_in, v_membership_id) i;

  -- **Ni le jeton, ni l'e-mail** : un booléen suffit à distinguer une invitation
  -- nominative du QR mural.
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
