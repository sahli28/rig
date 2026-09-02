-- L'import d'un effectif, en **une** transaction.
--
-- Le critère du ticket dit « rien ne se crée en cas d'erreur bloquante ». Deux
-- cents `create_invitation()` successifs ne peuvent pas le tenir : chacun
-- s'engage seul, et une erreur à la centième laisse quatre-vingt-dix-neuf
-- invitations derrière elle. La fonction prend donc le tableau entier.
--
-- ---------------------------------------------------------------------------
-- Ce qui est bloquant, et ce qui ne l'est pas
-- ---------------------------------------------------------------------------
--
--   * **bloquant** : une ligne illisible — adresse invalide, rôle inconnu, rôle
--     qu'un gestionnaire n'a pas le droit d'accorder. Tout l'import échoue, rien
--     n'est écrit, la box corrige son fichier ;
--   * **non bloquant** : une personne déjà membre, ou déjà invitée. Elle est
--     **ignorée et comptée**. Réimporter est le cas normal d'un import — faire
--     échouer 199 lignes parce qu'une personne a déjà rejoint serait absurde.
--
-- ---------------------------------------------------------------------------
-- Aucun jeton n'en sort
-- ---------------------------------------------------------------------------
--
-- Les invitations créées ici ne rendent pas leur jeton : les personnes
-- importées rejoignent par `accept_pending_invitation()`, en se connectant avec
-- l'adresse invitée. C'est ce qui évite de faire circuler deux cents secrets
-- vivants dans un tableur — ce que D-005 a consacré un ticket à empêcher.
--
-- Expiration à **90 jours** et non 30 : sur un effectif entier, celles et ceux
-- qui ne se connectent pas dans le mois se retrouveraient bloqués sans que la
-- box le sache.

create or replace function public.import_members(
  p_tenant_id uuid,
  p_rows jsonb,
  p_expires_in interval default interval '90 days'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_actor_role public.membership_role;
  v_tenant public.tenants;
  v_membership_id uuid;
  v_row jsonb;
  v_index integer := 0;
  v_email text;
  v_role public.membership_role;
  v_created integer := 0;
  v_deja_membre integer := 0;
  v_deja_invitee integer := 0;
begin
  if v_user_id is null then
    perform public.app_error('AUTH_REQUIRED', 'Authentification requise.', '42501');
  end if;

  v_actor_role := public.current_tenant_role(p_tenant_id);
  if v_actor_role is null or v_actor_role not in ('OWNER', 'MANAGER') then
    perform public.app_error('FORBIDDEN_ROLE',
      'Réservé aux propriétaires et gestionnaires.', '42501');
  end if;

  select * into v_tenant from public.tenants where id = p_tenant_id;
  if v_tenant.status <> 'ACTIVE' or v_tenant.deleted_at is not null then
    perform public.app_error('TENANT_CLOSED',
      'Cette box n''accepte plus de nouveaux membres.', '23514');
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    perform public.app_error('IMPORT_EMPTY', 'Aucune ligne à importer.', '23514');
  end if;

  -- Plafond volontaire : au-delà, l'écran doit découper. Une transaction qui
  -- tient dix mille verrous de ligne est une transaction qui bloque la box.
  if jsonb_array_length(p_rows) > 1000 then
    perform public.app_error('IMPORT_TOO_LARGE',
      'Import limité à 1000 lignes à la fois.', '23514');
  end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.user_id = v_user_id and m.tenant_id = p_tenant_id
    and m.status = 'ACTIVE' and m.left_at is null;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    v_email := nullif(lower(trim(v_row ->> 'email')), '');

    -- Le contrôle d'adresse est volontairement grossier : la validation fine est
    -- côté Zod, et une expression régulière d'e-mail « complète » rejette des
    -- adresses parfaitement valides. Ici on refuse ce qui ne peut pas en être une.
    if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      perform public.app_error('IMPORT_INVALID_ROW',
        format('Ligne %s : adresse e-mail invalide.', v_index), '23514');
    end if;

    v_role := coalesce(nullif(v_row ->> 'role', ''), 'MEMBER')::public.membership_role;

    if v_actor_role = 'MANAGER' and v_role in ('OWNER', 'MANAGER') then
      perform public.app_error('MANAGER_CANNOT_GRANT_ROLE',
        format('Ligne %s : un gestionnaire ne peut inviter qu''au rôle MEMBER ou COACH.', v_index),
        '42501');
    end if;

    -- Déjà membre actif : on passe. C'est le cas d'un réimport, pas une erreur.
    if exists (
      select 1
      from public.memberships m
      join public.users u on u.id = m.user_id
      where m.tenant_id = p_tenant_id
        and m.status = 'ACTIVE'
        and lower(u.email::text) = v_email
    ) then
      v_deja_membre := v_deja_membre + 1;
      continue;
    end if;

    perform public.expire_stale_invitations(p_tenant_id, v_email);

    if exists (
      select 1 from public.invitations
      where tenant_id = p_tenant_id and status = 'PENDING'
        and email is not null and lower(email::text) = v_email
    ) then
      v_deja_invitee := v_deja_invitee + 1;
      continue;
    end if;

    -- Le jeton rendu est ignoré, et c'est le point : personne n'a à le
    -- transporter. L'invitation se réclame par l'adresse.
    perform public.insert_invitation(
      p_tenant_id,
      v_email,
      v_role,
      p_expires_in,
      v_membership_id,
      v_row ->> 'first_name',
      v_row ->> 'last_name'
    );

    v_created := v_created + 1;
  end loop;

  -- **Une** entrée, pas deux cents. Le premier import rendrait sinon
  -- `audit_logs` illisible pour toujours — et c'est une table dont on ne peut
  -- rien retirer. Des nombres, aucune adresse (`.claude/rules/privacy.md`).
  perform public.log_audit(
    p_tenant_id,
    'members.imported',
    'tenant',
    p_tenant_id,
    jsonb_build_object(
      'rows', jsonb_array_length(p_rows),
      'created', v_created,
      'already_member', v_deja_membre,
      'already_invited', v_deja_invitee
    )
  );

  return jsonb_build_object(
    'rows', jsonb_array_length(p_rows),
    'created', v_created,
    'already_member', v_deja_membre,
    'already_invited', v_deja_invitee
  );
end;
$$;

comment on function public.import_members(uuid, jsonb, interval) is
  'Importe un effectif en une transaction : une ligne illisible annule tout, une personne déjà membre ou déjà invitée est ignorée et comptée. Aucun jeton n''en sort — les personnes importées rejoignent par accept_pending_invitation().';

revoke execute on function public.import_members(uuid, jsonb, interval) from public, anon;
grant execute on function public.import_members(uuid, jsonb, interval) to authenticated;
