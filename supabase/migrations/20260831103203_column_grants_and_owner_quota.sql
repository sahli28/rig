-- Troisième tour de corrections. Les trois défauts trouvés à la sixième passe
-- d'audit sont la même leçon, répétée : **la RLS est row-level**. Autoriser
-- l'écriture d'une ligne autorise l'écriture de toutes ses colonnes.

-- ---------------------------------------------------------------------------
-- 1. `users_self_update` exposait des colonnes de gouvernance
-- ---------------------------------------------------------------------------

-- Même motif que `tenants_member_update`, une table plus loin : le prédicat de
-- ligne est juste (`id = auth.uid()`), mais rien ne borne les colonnes. Un
-- utilisateur pouvait donc écrire :
--
--   update users set deleted_at = now()      -- déclencher sa propre anonymisation
--   update users set deleted_at = null       -- annuler une suppression en cours
--   update users set created_at = '2000-01-01'  -- fausser les échéances de rétention
--
-- `deleted_at` est précisément le drapeau sur lequel le parcours RGPD de P0-005
-- va s'appuyer. Rien ne le lit encore, donc l'effet est différé — c'est ce qui
-- rend ce genre de trou si facile à laisser passer.
--
-- Le bon outil Postgres pour ce besoin est le droit **au niveau colonne**. Il
-- s'ajoute à la policy : la policy dit *quelles lignes*, le grant dit *quelles
-- colonnes*. Les deux sont nécessaires.
revoke update on public.users from authenticated;
grant update (first_name, last_name, birthdate, gender, locale, avatar_url)
  on public.users to authenticated;

-- `email` reste exclu de cette liste **et** gelé par `forbid_email_change` :
-- deux verrous, parce qu'un contrôle d'identité s'appuie dessus.
-- `id`, `created_at`, `updated_at` et `deleted_at` ne sont écrits que par le
-- serveur ou par les triggers.

-- ---------------------------------------------------------------------------
-- 2. Le plafond de boxes n'était pas un invariant
-- ---------------------------------------------------------------------------

-- Le contrôle vivait dans `create_tenant` seulement. Il se contournait donc en
-- acceptant une invitation nominative `OWNER`, ou en se faisant promouvoir
-- `OWNER` par le propriétaire d'une autre box — et se raçait faute de verrou.
--
-- Un contrôle porté par une seule fonction n'est pas un invariant : il faut le
-- placer là où l'état change, c'est-à-dire sur la table. Le trigger couvre les
-- trois chemins d'un coup, y compris ceux qu'on écrira plus tard.
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

  -- Sérialise par utilisateur : sans ce verrou, N transactions concurrentes
  -- lisent toutes le même compte et passent toutes la garde.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));

  select count(*) into v_owned
  from public.memberships
  where user_id = new.user_id
    and role = 'OWNER'
    and status = 'ACTIVE'
    and id <> new.id;

  if v_owned >= 3 then
    raise exception 'Limite de boxes atteinte pour ce compte. Contacter le support.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger memberships_enforce_owner_quota
  before insert or update on public.memberships
  for each row execute function public.enforce_owner_quota();

-- ---------------------------------------------------------------------------
-- 3. `invitations` en `FOR ALL` débordait sur les invitations OWNER
-- ---------------------------------------------------------------------------

-- Le `with check` bornait le rôle **résultant** d'une invitation créée par un
-- MANAGER, mais le `using` d'un `FOR ALL` couvre aussi DELETE et UPDATE : un
-- gestionnaire pouvait donc supprimer, ou rétrograder, une invitation `OWNER`
-- émise par le propriétaire. Pas d'élévation — mais une révocation que §5.2
-- réserve à l'OWNER.
--
-- Troisième occurrence du même piège : un `for all` est trop grossier dès qu'une
-- garde de rôle entre en jeu.
drop policy invitations_write on public.invitations;

create policy invitations_select on public.invitations for select to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and public.current_tenant_role(tenant_id) in ('OWNER', 'MANAGER')
  );

create policy invitations_insert on public.invitations for insert to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and (
      public.current_tenant_role(tenant_id) = 'OWNER'
      or (public.current_tenant_role(tenant_id) = 'MANAGER' and role in ('MEMBER', 'COACH'))
    )
  );

-- Un MANAGER ne modifie que des invitations qu'il aurait pu créer, et ne peut
-- pas en faire une invitation OWNER.
create policy invitations_update on public.invitations for update to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and (
      public.current_tenant_role(tenant_id) = 'OWNER'
      or (public.current_tenant_role(tenant_id) = 'MANAGER' and role in ('MEMBER', 'COACH'))
    )
  )
  with check (
    tenant_id in (select public.current_tenant_ids())
    and (
      public.current_tenant_role(tenant_id) = 'OWNER'
      or (public.current_tenant_role(tenant_id) = 'MANAGER' and role in ('MEMBER', 'COACH'))
    )
  );

create policy invitations_delete on public.invitations for delete to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    and (
      public.current_tenant_role(tenant_id) = 'OWNER'
      or (public.current_tenant_role(tenant_id) = 'MANAGER' and role in ('MEMBER', 'COACH'))
    )
  );
