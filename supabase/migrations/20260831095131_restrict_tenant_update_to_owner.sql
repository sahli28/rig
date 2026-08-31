-- Second tour de corrections issu de la relecture de la PR #4.

-- ---------------------------------------------------------------------------
-- 1. Le curseur avait bougé, mais pas au bon endroit
-- ---------------------------------------------------------------------------

-- La correction précédente a fait passer `tenants` de « tout membre » à
-- « OWNER ou MANAGER ». Mais **la RLS est row-level, pas column-level** :
-- autoriser un MANAGER à écrire sur la ligne, c'est l'autoriser à tout y écrire,
-- donc à faire
--
--   update tenants set status = 'CLOSED', deleted_at = now() …
--
-- c'est-à-dire fermer la box. La spec §5.2 dit « Créer / supprimer une box —
-- MANAGER ❌ ».
--
-- On réserve donc `tenants` au propriétaire. Ce n'est pas une restriction
-- gênante : les réglages qu'un gestionnaire doit réellement toucher vivent dans
-- `tenant_settings`, où il a déjà le droit d'écrire.
--
-- L'alternative serait du column-level — `revoke update on tenants from
-- authenticated; grant update (name, timezone) on tenants to authenticated` —
-- qui est le bon outil Postgres pour ce besoin, mais ajoute une surface à
-- maintenir à chaque colonne ajoutée. À reconsidérer si un gestionnaire doit un
-- jour éditer le nom ou le fuseau.
drop policy tenants_admin_update on public.tenants;

create policy tenants_owner_update on public.tenants for update to authenticated
  using (
    id in (select public.current_tenant_ids())
    and public.current_tenant_role(id) = 'OWNER'
  )
  with check (
    id in (select public.current_tenant_ids())
    and public.current_tenant_role(id) = 'OWNER'
  );

-- ---------------------------------------------------------------------------
-- 2. `accept_invitation` était devenue un check-then-act sans verrou
-- ---------------------------------------------------------------------------

-- En ajoutant le refus explicite d'une appartenance déjà `ACTIVE`, le
-- `where memberships.status in ('LEFT','REMOVED')` du `on conflict` a disparu —
-- or il servait de filet : c'est lui qui rendait la mise à jour atomique.
--
-- Restait donc une lecture du statut, puis une écriture, sans rien entre les
-- deux. Deux acceptations concurrentes pouvaient lire toutes deux un statut
-- non-actif et procéder. Le `for update` sur la ligne d'appartenance, quand elle
-- existe, referme la fenêtre — même raisonnement que le verrou sur `tenants`
-- avant de compter les propriétaires.
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

  -- Lecture sans verrou : le QR d'affiliation (`email is null`) n'est jamais
  -- modifié, le verrouiller mettrait à la queue toutes les inscriptions
  -- simultanées du jour d'ouverture.
  select * into v_invitation from public.invitations where token = p_token;

  if not found then
    raise exception 'Invitation introuvable.' using errcode = 'no_data_found';
  end if;

  -- Seule l'invitation nominative, à usage unique, mérite un verrou.
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

  select * into v_tenant from public.tenants where id = v_invitation.tenant_id;
  if v_tenant.status <> 'ACTIVE' or v_tenant.deleted_at is not null then
    raise exception 'Cette box n''accepte plus de nouveaux membres.'
      using errcode = 'check_violation';
  end if;

  if v_invitation.email is not null then
    v_user_email := lower((select auth.jwt() ->> 'email'));
    if v_user_email is null or v_user_email <> lower(v_invitation.email::text) then
      raise exception 'Invitation nominative : adresse non correspondante.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- `for update` : la lecture du statut et l'écriture qui en dépend doivent être
  -- sérialisées. Si la ligne n'existe pas encore, la contrainte d'unicité et le
  -- `on conflict` prennent le relais.
  select status into v_existing_status
  from public.memberships
  where tenant_id = v_invitation.tenant_id and user_id = v_user_id
  for update;

  if v_existing_status = 'SUSPENDED' then
    raise exception 'Appartenance suspendue : contacter la box.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_existing_status = 'REMOVED' and v_invitation.email is null then
    raise exception 'Appartenance révoquée : une invitation nominative est requise.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_existing_status = 'ACTIVE' then
    raise exception 'Déjà membre de cette box. Un changement de rôle passe par set_member_role().'
      using errcode = 'unique_violation';
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_invitation.tenant_id, v_user_id, v_invitation.role)
  on conflict (tenant_id, user_id) do update
    set status = 'ACTIVE', left_at = null, role = excluded.role
    where public.memberships.status in ('LEFT', 'REMOVED');

  if v_invitation.email is not null then
    update public.invitations
    set status = 'ACCEPTED', accepted_at = now()
    where id = v_invitation.id;
  end if;

  return v_invitation.tenant_id;
end;
$$;
