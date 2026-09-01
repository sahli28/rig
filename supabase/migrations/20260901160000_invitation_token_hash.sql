-- Les jetons d'invitation deviennent des empreintes.
--
-- `invitations.token` était stocké **en clair**, avec un index unique dessus.
-- Chaque ligne était donc un identifiant **vivant** : présenter ce jeton à
-- `accept_invitation()` ouvre une appartenance dans une box, au rôle inscrit
-- dans la ligne. Un dump, une sauvegarde, un accès support ou une vue mal cadrée
-- les livrait tous d'un coup.
--
-- L'exposition était bornée — seuls OWNER et MANAGER lisent la table — mais
-- c'est le raisonnement que D-006 vient de démonter : une seule couche.
--
-- Arbitrage retenu : **tout est haché, y compris le QR mural**. Réimprimer une
-- affiche devient « régénérer le QR », ce qui invalide les précédentes. On perd
-- la réédition à l'identique, on gagne qu'aucun jeton vivant ne dort en base,
-- quelle qu'en soit la nature.

-- ---------------------------------------------------------------------------
-- 1. La colonne
-- ---------------------------------------------------------------------------

-- Renommée, pas réinterprétée : une colonne qui ne contient plus ce que son nom
-- annonce est une invitation à s'en servir mal.
alter table public.invitations rename column token to token_hash;
alter index public.invitations_token_key rename to invitations_token_hash_key;

-- Les invitations **en vol sont préservées** : on hache l'existant au lieu de
-- l'effacer. Une migration ne doit pas invalider les liens déjà envoyés.
update public.invitations
set token_hash = encode(extensions.digest(token_hash, 'sha256'), 'hex');

comment on column public.invitations.token_hash is
  'SHA-256 hexadécimal du jeton. Le jeton en clair n''existe qu''une fois, dans le retour de create_invitation(). Non salé : la recherche se fait par empreinte, et un jeton est une valeur aléatoire de 192 bits, pas un mot de passe.';

-- ---------------------------------------------------------------------------
-- 2. create_invitation() — désormais la seule porte d'entrée
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

  -- Même matrice que la policy `invitations_insert` qu'on supprime plus bas :
  -- un gestionnaire n'invite qu'aux rôles qu'il pourrait attribuer (spec §5.2).
  if v_actor_role = 'MANAGER' and p_role in ('OWNER', 'MANAGER') then
    perform public.app_error('MANAGER_CANNOT_GRANT_ROLE',
      'Un gestionnaire ne peut inviter qu''au rôle MEMBER ou COACH.', '42501');
  end if;

  select * into v_tenant from public.tenants where id = p_tenant_id;
  if v_tenant.status <> 'ACTIVE' or v_tenant.deleted_at is not null then
    perform public.app_error('TENANT_CLOSED',
      'Cette box n''accepte plus de nouveaux membres.', '23514');
  end if;

  -- `invited_by` est **dérivé**, pas reçu. L'`insert` direct laissait l'appelant
  -- écrire n'importe quel invitant, ou aucun — même motif que `log_audit()`.
  select m.id into v_membership_id
  from public.memberships m
  where m.user_id = v_user_id and m.tenant_id = p_tenant_id
    and m.status = 'ACTIVE' and m.left_at is null;

  -- 24 octets, 48 caractères hexadécimaux : 192 bits d'entropie, et sûr dans une
  -- URL comme dans un QR sans encodage supplémentaire.
  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.invitations (tenant_id, email, role, token_hash, expires_at, invited_by)
  values (
    p_tenant_id,
    nullif(lower(trim(p_email)), ''),
    p_role,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    now() + p_expires_in,
    v_membership_id
  );

  -- Le seul et unique moment où le jeton en clair existe.
  return v_token;
end;
$$;

comment on function public.create_invitation(uuid, text, public.membership_role, interval) is
  'Crée une invitation et rend son jeton en clair UNE SEULE FOIS. Seule la base garde l''empreinte : le jeton n''est pas récupérable ensuite, il faut en régénérer un.';

revoke execute on function public.create_invitation(uuid, text, public.membership_role, interval)
  from public, anon;
grant execute on function public.create_invitation(uuid, text, public.membership_role, interval)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. accept_invitation() cherche par empreinte
-- ---------------------------------------------------------------------------

-- Une seule ligne change — la recherche. Le reste est repris à l'identique :
-- verrou sur l'invitation nominative, comparaison à l'e-mail **vérifié du JWT**,
-- statuts, box fermée. Le client, lui, continue d'envoyer le jeton en clair : la
-- fonction étant `security definer`, le hachage ne lui coûte rien et la
-- signature côté TypeScript ne bouge pas.
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

  return v_invitation.tenant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Fermer l'insertion directe
-- ---------------------------------------------------------------------------

-- La policy **et** le droit, ensemble. Depuis D-006, `rls_leak_test.sql` exige
-- que les deux couches se correspondent et signalerait l'une sans l'autre —
-- c'est précisément l'intérêt de cet invariant.
--
-- `update` et `delete` restent : révoquer une invitation est un `update status`,
-- et c'est un besoin réel de P1-001. Restreindre `update` aux seules colonnes
-- utiles a été examiné puis écarté : le seul abus concevable serait qu'un OWNER
-- réécrive une invitation de sa propre box, ce qu'il peut déjà créer — et
-- l'escalade qui compterait, un MANAGER promouvant une invitation en OWNER, est
-- déjà bloquée par le `with check` de `invitations_update`.
drop policy invitations_insert on public.invitations;
revoke insert on public.invitations from authenticated;
