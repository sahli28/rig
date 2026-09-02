-- La langue par défaut de la box.
--
-- Elle va sur `tenants`, à côté de `timezone` et `currency`, parce qu'elle est
-- de la même nature qu'elles : un paramètre d'identité, pas de marque. `themes`
-- porte la marque — `app_name`, `logo_url`, `primary_color`, `radius`, `font` —
-- et rien d'autre.
--
-- Elle répond à la question « dans quelle langue s'adresse-t-on à quelqu'un dont
-- on ne sait rien encore ? » : page publique de la box, e-mail d'invitation,
-- notification à un compte qui n'a pas encore choisi. Ses consommateurs
-- viendront (D-003 pour le SSR public, P1-007 pour les push) ; la colonne
-- existe d'abord parce que l'écran de réglages la demande.

alter table public.tenants
  add column default_locale text not null default 'fr';

alter table public.tenants
  add constraint tenants_default_locale_supported check (default_locale in ('fr', 'en'));

comment on column public.tenants.default_locale is
  'Langue employée quand la personne n''en a pas encore choisi une. Même nature que timezone et currency.';

-- ---------------------------------------------------------------------------
-- me() rend la nouvelle colonne
-- ---------------------------------------------------------------------------

-- Un champ éditable que personne ne lit est une moitié de chemin — la forme
-- exacte des cinq trous relevés depuis P0-004. Il entre donc dans `me()` dans
-- la **même** migration que la colonne, pas « plus tard ».
--
-- Seul `current_tenant` change ; le reste du corps est repris tel quel, un
-- `create or replace` ne pouvant pas être partiel.
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
  -- base (ADR 0002). Un `p_tenant_id` où l'appelant n'a pas d'appartenance donne
  -- un `current_tenant` nul, jamais un repli silencieux sur une autre box.
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
      'default_locale', t.default_locale,
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

  if v_user.first_name is null or length(trim(v_user.first_name)) = 0 then
    v_actions := array_append(v_actions, 'COMPLETE_PROFILE');
  end if;

  -- Un consentement est acquis si sa **dernière** ligne pour ce couple
  -- (personne, finalité) est `granted`. Départage sur `id` : `granted_at` vaut
  -- `now()`, l'horodatage de la transaction, donc deux consentements posés dans
  -- la même transaction sont indiscernables. Les UUID v7, eux, tranchent.
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
