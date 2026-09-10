-- P1-007 — La décision « peut-on envoyer cette notification à ce membre,
-- maintenant ? »
--
-- Le cœur testable du push. Chaque producteur (l'annulation, la promotion de
-- liste d'attente, le job de rappel J-1) l'appelle **avant d'enfiler** une
-- notification : si la réponse n'est pas `OK`, rien n'est mis en file. L'émetteur
-- n'a donc à décider de rien — il transporte.
--
-- **Renvoie un code de raison**, pas un booléen : chaque cause a son assertion
-- pgTAP, et un producteur peut journaliser *pourquoi* il a sauté. Un wrapper
-- booléen n'est pas nécessaire — `= 'OK'` suffit à l'appelant.
--
-- `security definer` et **révoquée de tous les rôles applicatifs** (comme
-- `mark_no_shows`) : elle lit la consommation et les quiet hours d'un membre —
-- un oracle si un client pouvait l'appeler sur l'appartenance d'autrui. Ses
-- appelants sont des fonctions `security definer` (annulation, jobs) exécutées
-- sous le propriétaire, et les tests sous `postgres`.
create or replace function public.notification_eligibility(
  p_membership_id uuid,
  p_category public.notification_category,
  p_now timestamptz default now()
) returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
  v_tz text;
  v_consent boolean;
  v_hour integer;
begin
  -- Résolution unique depuis l'appartenance : user, tenant, et le fuseau avec
  -- son repli box (`coalesce(users.timezone, tenants.timezone)`). Passer par
  -- l'appartenance rend toute incohérence tenant/user impossible.
  select m.user_id, m.tenant_id, coalesce(u.timezone, t.timezone)
  into v_user_id, v_tenant_id, v_tz
  from public.memberships m
  join public.users u on u.id = m.user_id
  join public.tenants t on t.id = m.tenant_id
  where m.id = p_membership_id;

  -- Appartenance inconnue (supprimée entre l'enfilage et la relecture) : rien à
  -- envoyer, sans erreur — un producteur ne doit pas planter sur une ligne
  -- périmée.
  if v_user_id is null then
    return 'NO_MEMBERSHIP';
  end if;

  -- 1. Consentement PUSH — obligatoire pour le canal push, quelle que soit la
  --    catégorie. « Le transactionnel reste en e-mail même push coupé » vise
  --    l'e-mail (D-008), hors périmètre. PUSH est un consentement **de box**
  --    (`tenant_id` non null). Dernière ligne fait foi, motif de `me()`.
  select coalesce(
    (select c.granted from public.consents c
     where c.user_id = v_user_id and c.tenant_id = v_tenant_id and c.purpose = 'PUSH'
     order by c.granted_at desc, c.id desc
     limit 1),
    false
  ) into v_consent;

  if not v_consent then
    return 'NO_PUSH_CONSENT';
  end if;

  -- 2. Préférence de catégorie (opt-out : l'absence de ligne vaut activé).
  if exists (
    select 1 from public.notification_preferences p
    where p.membership_id = p_membership_id
      and p.category = p_category
      and p.enabled = false
  ) then
    return 'CATEGORY_DISABLED';
  end if;

  -- 3. Quiet hours 21 h–7 h **en heure locale du membre**, sauf catégorie
  --    exemptée (l'annulation d'un cours passe la nuit).
  v_hour := extract(hour from (p_now at time zone v_tz));
  if (v_hour >= 21 or v_hour < 7) and public.notification_respects_quiet_hours(p_category) then
    return 'QUIET_HOURS';
  end if;

  -- 4. Plafond marketing sur la fenêtre glissante de 7 jours. Le transactionnel
  --    ne consulte jamais ce compteur.
  if public.notification_counts_toward_cap(p_category)
     and public.notification_marketing_count_7d(p_membership_id, p_now) >= 2 then
    return 'MARKETING_CAP';
  end if;

  return 'OK';
end;
$$;

revoke execute on function public.notification_eligibility(uuid, public.notification_category, timestamptz)
  from public, anon, authenticated;
