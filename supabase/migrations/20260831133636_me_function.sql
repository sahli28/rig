-- `me()` — tout ce dont l'app a besoin au démarrage, en un aller-retour.
--
-- Profil, appartenances, box active avec son thème et ses règles de réservation,
-- et les actions restant à accomplir. La forme suit l'exemple JSON de la spec
-- §7.6a, pour que le client n'ait pas à recomposer.

-- Version courante des documents contractuels. Passer à `tenant_settings` ou à
-- une table dédiée le jour où les versions divergent entre boxes ; pour l'instant
-- une constante suffit et se voit.
create or replace function public.current_policy_version()
returns text
language sql
immutable
set search_path = ''
as $$
  select '2026-08-01'::text;
$$;

-- `security invoker` : la fonction est soumise à la RLS comme n'importe quelle
-- requête. Elle ne peut donc rien retourner que l'appelant n'ait le droit de
-- lire — c'est ce qui permet de ne pas réécrire les contrôles ici.
create or replace function public.me(p_tenant_id uuid default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user public.users;
  v_memberships jsonb;
  v_current_tenant jsonb;
  v_active_tenant_id uuid;
  v_actions text[] := array[]::text[];
begin
  if v_user_id is null then
    perform public.app_error('AUTH_REQUIRED', 'Authentification requise.', '42501');
  end if;

  select * into v_user from public.users where id = v_user_id;
  if not found then
    perform public.app_error('PROFILE_NOT_FOUND', 'Profil introuvable.', 'P0002');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'tenant_id', m.tenant_id,
        'tenant_name', t.name,
        'tenant_slug', t.slug,
        'role', m.role,
        'status', m.status,
        'joined_at', m.joined_at
      )
      order by m.joined_at
    ),
    '[]'::jsonb
  )
  into v_memberships
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = v_user_id and m.status = 'ACTIVE';

  -- Box active : **uniquement** celle demandée. Sans `p_tenant_id`, il n'y a pas
  -- de box active — le tenant actif est une décision de l'appelant, pas de la
  -- base (ADR 0002). Choisir « la plus ancienne » inscrirait l'hypothèse mono-box
  -- dans la fonction la plus appelée du produit.
  --
  -- Un `p_tenant_id` où l'appelant n'a pas d'appartenance donne un
  -- `current_tenant` **nul**, et surtout pas un repli silencieux sur une autre
  -- box. Basculer en douce ferait afficher les données de la box A dans une
  -- interface que la personne croit être celle de la box B — précisément la
  -- classe de bug contre laquelle `.claude/rules/api.md` met en garde. Le client
  -- doit traiter ce nul, pas le recevoir déguisé.
  if p_tenant_id is not null then
    select m.tenant_id into v_active_tenant_id
    from public.memberships m
    where m.user_id = v_user_id and m.status = 'ACTIVE' and m.tenant_id = p_tenant_id;
  end if;

  if v_active_tenant_id is not null then
    select jsonb_build_object(
      'id', t.id,
      'slug', t.slug,
      'name', t.name,
      'timezone', t.timezone,
      'currency', t.currency,
      'role', public.current_tenant_role(t.id),
      'theme', jsonb_build_object(
        'app_name', th.app_name,
        'logo_url', th.logo_url,
        'primary', th.primary_color,
        'radius', th.radius,
        'font', th.font
      ),
      'booking_rules', jsonb_build_object(
        'open_days_before', s.open_days_before,
        'close_minutes_before', s.close_minutes_before,
        'cancel_window_minutes', s.cancel_window_minutes,
        'max_upcoming_bookings', s.max_upcoming_bookings
      )
    )
    into v_current_tenant
    from public.tenants t
    join public.themes th on th.tenant_id = t.id
    join public.tenant_settings s on s.tenant_id = t.id
    where t.id = v_active_tenant_id;
  end if;

  -- Actions restantes. Calculées ici pour que le client n'ait pas à connaître
  -- les règles de consentement ni la version courante des documents.
  if v_user.first_name is null or length(trim(v_user.first_name)) = 0 then
    v_actions := array_append(v_actions, 'COMPLETE_PROFILE');
  end if;

  -- Un consentement est acquis si sa **dernière** ligne pour ce couple
  -- (personne, finalité) est `granted`. `consents` étant append-only, une
  -- rétractation est une ligne plus récente à `false`.
  --
  -- Départage sur `id` : `granted_at` vaut `now()`, l'horodatage de la
  -- **transaction**, donc deux consentements posés dans la même transaction
  -- sont indiscernables et l'ordre devient arbitraire. Les identifiants sont
  -- des UUID v7, générés sur `clock_timestamp()` : ils tranchent, même à
  -- l'intérieur d'une transaction. C'est ce pour quoi le v7 a été choisi.
  if exists (
    select 1
    from (values ('TERMS'::public.consent_purpose), ('PRIVACY'::public.consent_purpose)) as required(purpose)
    where coalesce(
      (select c.granted
       from public.consents c
       where c.user_id = v_user_id
         and c.purpose = required.purpose
         and c.policy_version = public.current_policy_version()
       order by c.granted_at desc, c.id desc
       limit 1),
      false
    ) = false
  ) then
    v_actions := array_append(v_actions, 'ACCEPT_CONSENTS');
  end if;

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'first_name', v_user.first_name,
      'last_name', v_user.last_name,
      'locale', v_user.locale,
      'avatar_url', v_user.avatar_url
    ),
    'memberships', v_memberships,
    'current_tenant', v_current_tenant,
    'required_actions', to_jsonb(v_actions)
  );
end;
$$;

comment on function public.me(uuid) is
  'État complet de la session en un aller-retour. security invoker : soumise à la RLS, donc ne peut rien divulguer.';

revoke execute on function public.me(uuid) from public, anon;
grant execute on function public.me(uuid) to authenticated;
